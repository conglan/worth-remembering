use std::path::{Path, PathBuf};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use rand_core::OsRng;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;
use crate::db;
use crate::model::{ActiveSession, AppState, SafeUser, UserRecord};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub has_users: bool,
    pub current_user: Option<SafeUser>,
}

pub fn current_session(state: &State<'_, AppState>) -> Result<ActiveSession, String> {
    state.session.read().map_err(|_| "会话读取失败")?.clone().ok_or_else(|| "请先登录".into())
}

pub fn require_admin(state: &State<'_, AppState>) -> Result<ActiveSession, String> {
    let session = current_session(state)?;
    if session.user.role != "admin" {
        return Err("只有管理员可以执行此操作".into());
    }
    Ok(session)
}

/// 新存储路径已保存但还没重启时，拒绝写入，避免数据写进即将被替换的旧目录。
pub fn ensure_storage_applied(state: &State<'_, AppState>) -> Result<(), String> {
    let configured = crate::settings::read_roots(&state.settings_path, &state.app_dir)?;
    if configured.database != state.database_root || configured.image != state.image_root {
        return Err("存储路径已更改，请重启应用后再继续操作".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_status(state: State<'_, AppState>) -> Result<AuthStatus, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.system_pool)
        .await
        .map_err(|error| error.to_string())?;
    let current_user = state.session.read().map_err(|_| "会话读取失败")?.as_ref().map(|session| session.user.clone());
    Ok(AuthStatus { has_users: count > 0, current_user })
}

#[tauri::command]
pub async fn register(
    state: State<'_, AppState>,
    username: String,
    display_name: Option<String>,
    password: String,
) -> Result<SafeUser, String> {
    ensure_storage_applied(&state)?;
    validate_credentials(&username, &password)?;
    let role = next_role(&state.system_pool).await?;
    let user = insert_user(&state, username, display_name, password, role).await?;
    match db::open_user_session(&state.database_root, &state.image_root, user.clone()).await {
        Ok(session) => {
            replace_session(&state, Some(session)).await;
            Ok(user)
        }
        Err(error) => {
            let _ = sqlx::query("DELETE FROM users WHERE id = ?").bind(&user.id).execute(&state.system_pool).await;
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn login(state: State<'_, AppState>, username: String, password: String) -> Result<SafeUser, String> {
    let user = authenticate(&state.system_pool, &username, &password).await?;
    let session = db::open_user_session(&state.database_root, &state.image_root, user.clone()).await?;
    replace_session(&state, Some(session)).await;
    Ok(user)
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    replace_session(&state, None).await;
    Ok(())
}

#[tauri::command]
pub async fn list_users(state: State<'_, AppState>) -> Result<Vec<SafeUser>, String> {
    require_admin(&state)?;
    sqlx::query_as::<_, SafeUser>(
        "SELECT id, username, display_name, role, status, created_at, updated_at, last_login_at FROM users ORDER BY created_at",
    )
    .fetch_all(&state.system_pool)
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn create_user(
    state: State<'_, AppState>,
    username: String,
    display_name: Option<String>,
    password: String,
) -> Result<SafeUser, String> {
    require_admin(&state)?;
    ensure_storage_applied(&state)?;
    validate_credentials(&username, &password)?;
    let user = insert_user(&state, username, display_name, password, "user").await?;
    match db::open_user_session(&state.database_root, &state.image_root, user.clone()).await {
        Ok(session) => {
            session.pool.close().await;
            Ok(user)
        }
        Err(error) => {
            let _ = sqlx::query("DELETE FROM users WHERE id = ?").bind(&user.id).execute(&state.system_pool).await;
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn set_user_status(state: State<'_, AppState>, user_id: String, status: String) -> Result<(), String> {
    let admin = require_admin(&state)?;
    ensure_storage_applied(&state)?;
    if admin.user.id == user_id {
        return Err("不能禁用当前登录的管理员账号".into());
    }
    if !["active", "disabled"].contains(&status.as_str()) {
        return Err("用户状态不正确".into());
    }
    update_user_row(&state, &user_id, "status", &status).await
}

#[tauri::command]
pub async fn reset_user_password(state: State<'_, AppState>, user_id: String, password: String) -> Result<(), String> {
    require_admin(&state)?;
    ensure_storage_applied(&state)?;
    validate_password(&password)?;
    let hash = hash_password(password).await?;
    update_user_row(&state, &user_id, "password_hash", &hash).await
}

#[tauri::command]
pub async fn delete_user(state: State<'_, AppState>, user_id: String) -> Result<(), String> {
    let admin = require_admin(&state)?;
    ensure_storage_applied(&state)?;
    if admin.user.id == user_id {
        return Err("不能删除当前登录的管理员账号".into());
    }
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(&state.system_pool)
        .await
        .map_err(|error| error.to_string())?;
    if exists.is_none() {
        return Err("用户不存在".into());
    }
    let db_moved = match archive_user_data(&state.database_root, &user_id) {
        Ok(moved) => moved,
        Err(error) => return Err(error),
    };
    let image_moved = if state.image_root == state.database_root {
        None
    } else {
        match archive_user_data(&state.image_root, &user_id) {
            Ok(moved) => moved,
            Err(error) => {
                restore_user_data(db_moved.as_ref());
                return Err(error);
            }
        }
    };
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&user_id)
        .execute(&state.system_pool)
        .await;
    if let Err(error) = result {
        restore_user_data(db_moved.as_ref());
        restore_user_data(image_moved.as_ref());
        return Err(error.to_string());
    }
    Ok(())
}

fn archive_user_data(root: &Path, user_id: &str) -> Result<Option<(PathBuf, PathBuf)>, String> {
    let source = root.join("users").join(user_id);
    if !source.exists() {
        return Ok(None);
    }
    let archive_root = root.join("deleted-users");
    std::fs::create_dir_all(&archive_root).map_err(|error| error.to_string())?;
    let target = archive_root.join(user_id);
    if target.exists() {
        return Err("归档目录中已存在同名用户数据，请先处理后再删除".into());
    }
    std::fs::rename(&source, &target).map_err(|error| format!("归档用户数据失败：{error}"))?;
    Ok(Some((source, target)))
}

fn restore_user_data(moved: Option<&(PathBuf, PathBuf)>) {
    if let Some((source, target)) = moved {
        if target.exists() {
            if let Some(parent) = source.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::rename(target, source);
        }
    }
}

#[tauri::command]
pub async fn update_profile(state: State<'_, AppState>, display_name: String) -> Result<SafeUser, String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    let display_name = validate_display_name(display_name)?;
    sqlx::query("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
        .bind(&display_name)
        .bind(now())
        .bind(&session.user.id)
        .execute(&state.system_pool)
        .await
        .map_err(|error| error.to_string())?;
    let mut guard = state.session.write().map_err(|_| "会话写入失败")?;
    let current = guard.as_mut().ok_or("请先登录")?;
    current.user.display_name = display_name;
    current.user.updated_at = now();
    Ok(current.user.clone())
}

#[tauri::command]
pub async fn change_password(state: State<'_, AppState>, current_password: String, new_password: String) -> Result<(), String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    validate_password(&new_password)?;
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = ?")
        .bind(&session.user.id)
        .fetch_one(&state.system_pool)
        .await
        .map_err(|error| error.to_string())?;
    if !verify_password(&current_password, &hash).await? {
        return Err("当前密码不正确".into());
    }
    let new_hash = hash_password(new_password).await?;
    update_user_row(&state, &session.user.id, "password_hash", &new_hash).await
}

async fn insert_user(
    state: &AppState,
    username: String,
    display_name: Option<String>,
    password: String,
    role: &str,
) -> Result<SafeUser, String> {
    let username = username.trim().to_string();
    let normalized = normalize_username(&username);
    let display_name = validate_display_name(display_name.unwrap_or_else(|| username.clone()))?;
    let password_hash = hash_password(password).await?;
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    sqlx::query(
        "INSERT INTO users (id, username, normalized_username, display_name, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)",
    )
    .bind(&id)
    .bind(&username)
    .bind(&normalized)
    .bind(&display_name)
    .bind(password_hash)
    .bind(role)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&state.system_pool)
    .await
    .map_err(|error| if error.to_string().contains("UNIQUE") { "用户名已存在".into() } else { error.to_string() })?;
    Ok(SafeUser {
        id,
        username,
        display_name,
        role: role.into(),
        status: "active".into(),
        created_at: timestamp.clone(),
        updated_at: timestamp,
        last_login_at: None,
    })
}

async fn next_role(pool: &sqlx::SqlitePool) -> Result<&'static str, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(if count == 0 { "admin" } else { "user" })
}

async fn authenticate(pool: &sqlx::SqlitePool, username: &str, password: &str) -> Result<SafeUser, String> {
    let record = sqlx::query_as::<_, UserRecord>("SELECT * FROM users WHERE normalized_username = ?")
        .bind(normalize_username(username))
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;
    let Some(record) = record else {
        return Err("用户名或密码不正确".into());
    };
    if !verify_password(password, &record.password_hash).await? || record.status != "active" {
        return Err("用户名或密码不正确，或账号已被禁用".into());
    }
    let timestamp = now();
    sqlx::query("UPDATE users SET last_login_at = ? WHERE id = ?")
        .bind(&timestamp)
        .bind(&record.id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    let mut user: SafeUser = record.into();
    user.last_login_at = Some(timestamp);
    Ok(user)
}

async fn update_user_row(state: &State<'_, AppState>, user_id: &str, column: &str, value: &str) -> Result<(), String> {
    if !["status", "password_hash"].contains(&column) {
        return Err("不支持的用户字段".into());
    }
    let statement = format!("UPDATE users SET {column} = ?, updated_at = ? WHERE id = ?");
    let result = sqlx::query(&statement)
        .bind(value)
        .bind(now())
        .bind(user_id)
        .execute(&state.system_pool)
        .await
        .map_err(|error| error.to_string())?;
    if result.rows_affected() == 0 {
        return Err("用户不存在".into());
    }
    Ok(())
}

async fn replace_session(state: &State<'_, AppState>, next: Option<ActiveSession>) {
    let previous = state.session.write().ok().map(|mut session| std::mem::replace(&mut *session, next));
    if let Some(previous) = previous.flatten() {
        previous.pool.close().await;
    }
}

fn normalize_username(username: &str) -> String {
    username.trim().to_lowercase()
}

fn validate_credentials(username: &str, password: &str) -> Result<(), String> {
    let username = username.trim();
    let length = username.chars().count();
    if !(3..=32).contains(&length) || username.chars().any(|character| character.is_whitespace() || character.is_control()) {
        return Err("用户名需为 3–32 个字符，且不能包含空格".into());
    }
    validate_password(password)
}

fn validate_password(password: &str) -> Result<(), String> {
    let length = password.chars().count();
    if !(8..=128).contains(&length) {
        return Err("密码需为 8–128 个字符".into());
    }
    Ok(())
}

fn validate_display_name(value: String) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() || value.chars().count() > 30 {
        return Err("显示名称需为 1–30 个字符".into());
    }
    Ok(value)
}

async fn hash_password(password: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let password = password.to_string();
    let hash = hash.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let parsed = PasswordHash::new(&hash).map_err(|error| error.to_string())?;
        Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_hash_does_not_contain_plaintext_and_verifies() {
        tauri::async_runtime::block_on(async {
            let hash = hash_password("correct-horse".into()).await.unwrap();
            assert!(!hash.contains("correct-horse"));
            assert!(verify_password("correct-horse", &hash).await.unwrap());
            assert!(!verify_password("wrong-password", &hash).await.unwrap());
        });
    }

    #[test]
    fn usernames_are_case_insensitive() {
        assert_eq!(normalize_username("  Alice  "), "alice");
        assert!(validate_credentials("ab", "12345678").is_err());
        assert!(validate_credentials("alice", "12345678").is_ok());
    }

    #[test]
    fn accounts_enforce_roles_unique_names_and_disabled_login() {
        tauri::async_runtime::block_on(async {
            let directory = tempfile::tempdir().unwrap();
            let pool = crate::db::initialize_system(&directory.path().join("system.db")).await.unwrap();
            let state = AppState {
                system_pool: pool.clone(),
                database_root: directory.path().join("databases"),
                image_root: directory.path().join("images"),
                app_dir: directory.path().into(),
                settings_path: directory.path().join("settings.json"),
                session: std::sync::RwLock::new(None),
            };
            assert_eq!(next_role(&pool).await.unwrap(), "admin");
            let admin = insert_user(&state, "Alice".into(), None, "12345678".into(), "admin").await.unwrap();
            assert_eq!(next_role(&pool).await.unwrap(), "user");
            assert!(insert_user(&state, "alice".into(), None, "12345678".into(), "user").await.is_err());
            assert!(authenticate(&pool, "ALICE", "12345678").await.is_ok());
            assert!(authenticate(&pool, "alice", "wrong-password").await.is_err());

            sqlx::query("UPDATE users SET status = 'disabled' WHERE id = ?").bind(&admin.id).execute(&pool).await.unwrap();
            assert!(authenticate(&pool, "alice", "12345678").await.is_err());
            let session = crate::db::open_user_session(&state.database_root, &state.image_root, admin.clone()).await.unwrap();
            assert!(crate::db::user_database_path(&state.database_root, &admin.id).is_file());
            assert_eq!(session.image_dir, crate::db::user_image_dir(&state.image_root, &admin.id));
            assert!(session.image_dir.is_dir());
            session.pool.close().await;
            pool.close().await;
        });
    }
}
