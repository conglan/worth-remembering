use std::path::{Path, PathBuf};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sqlx::{Executor, Sqlite};
use tauri::State;
use crate::auth::{current_session, ensure_storage_applied, require_admin};
use crate::model::{AppState, Asset};
use crate::settings::{self, StorageSettingsInfo};

const INSERT_SQL: &str = r#"
    INSERT INTO assets (
        id, brand, name, image, price, currency, purchase_date, purchase_location,
        retired, retirement_date, sold, sale_price, sale_currency, sale_note, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"#;

const UPDATE_CONFLICT_SQL: &str = r#"
    ON CONFLICT(id) DO UPDATE SET
        brand = excluded.brand, name = excluded.name, image = excluded.image,
        price = excluded.price, currency = excluded.currency, purchase_date = excluded.purchase_date,
        purchase_location = excluded.purchase_location, retired = excluded.retired,
        retirement_date = excluded.retirement_date, sold = excluded.sold, sale_price = excluded.sale_price,
        sale_currency = excluded.sale_currency, sale_note = excluded.sale_note, note = excluded.note,
        updated_at = excluded.updated_at
"#;

async fn insert<'a, E>(executor: E, asset: &Asset, conflict_sql: &str) -> Result<(), sqlx::Error>
where
    E: Executor<'a, Database = Sqlite>,
{
    let statement = format!("{INSERT_SQL} {conflict_sql}");
    sqlx::query(&statement)
        .bind(&asset.id)
        .bind(&asset.brand)
        .bind(&asset.name)
        .bind(&asset.image)
        .bind(asset.price)
        .bind(&asset.currency)
        .bind(&asset.purchase_date)
        .bind(&asset.purchase_location)
        .bind(asset.retired)
        .bind(&asset.retirement_date)
        .bind(asset.sold)
        .bind(asset.sale_price)
        .bind(&asset.sale_currency)
        .bind(&asset.sale_note)
        .bind(&asset.note)
        .bind(&asset.created_at)
        .bind(&asset.updated_at)
        .execute(executor)
        .await?;
    Ok(())
}

async fn upsert<'a, E>(executor: E, asset: &Asset) -> Result<(), sqlx::Error>
where
    E: Executor<'a, Database = Sqlite>,
{
    insert(executor, asset, UPDATE_CONFLICT_SQL).await
}

#[tauri::command]
pub async fn list_assets(state: State<'_, AppState>) -> Result<Vec<Asset>, String> {
    let session = current_session(&state)?;
    sqlx::query_as::<_, Asset>("SELECT * FROM assets ORDER BY purchase_date DESC, created_at DESC")
        .fetch_all(&session.pool)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_asset(state: State<'_, AppState>, asset: Asset) -> Result<(), String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    upsert(&session.pool, &asset).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn replace_assets(state: State<'_, AppState>, assets: Vec<Asset>) -> Result<(), String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    let mut transaction = session.pool.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM assets")
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    for asset in assets {
        upsert(&mut *transaction, &asset).await.map_err(|error| error.to_string())?;
    }
    transaction.commit().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn append_assets(state: State<'_, AppState>, assets: Vec<Asset>) -> Result<(), String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    let mut transaction = session.pool.begin().await.map_err(|error| error.to_string())?;
    for asset in assets {
        insert(&mut *transaction, &asset, "ON CONFLICT(id) DO NOTHING")
            .await
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_asset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    sqlx::query("DELETE FROM assets WHERE id = ?")
        .bind(id)
        .execute(&session.pool)
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn save_asset_image(state: State<'_, AppState>, asset_id: String, data_url: String) -> Result<String, String> {
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    let safe_id = safe_asset_id(&asset_id)?;
    let (_, encoded) = data_url.split_once(',').ok_or("图片数据格式不正确")?;
    let bytes = STANDARD.decode(encoded).map_err(|error| error.to_string())?;
    let filename = format!("{safe_id}.webp");
    let path = session.image_dir.join(&filename);
    tauri::async_runtime::spawn_blocking(move || std::fs::write(&path, bytes))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;
    Ok(filename)
}

#[tauri::command]
pub async fn normalize_asset_image(state: State<'_, AppState>, asset_id: String, path: String) -> Result<String, String> {
    if path.starts_with('/') {
        return Ok(path);
    }
    let session = current_session(&state)?;
    ensure_storage_applied(&state)?;
    let safe_id = safe_asset_id(&asset_id)?;
    let source = PathBuf::from(&path);
    if !source.is_absolute() {
        if source.components().count() != 1 {
            return Err("图片相对路径只能包含文件名".into());
        }
        return Ok(path);
    }
    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("webp").to_ascii_lowercase();
    if !["png", "jpg", "jpeg", "gif", "webp"].contains(&extension.as_str()) {
        return Err("不支持的图片格式".into());
    }
    let filename = format!("{safe_id}.{extension}");
    let target = session.image_dir.join(&filename);
    tauri::async_runtime::spawn_blocking(move || {
        if !source.is_file() {
            return Err("图片文件不存在".into());
        }
        if source != target {
            std::fs::copy(source, target).map_err(|error| format!("复制图片失败：{error}"))?;
        }
        Ok(filename)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn read_asset_image(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let session = current_session(&state)?;
    let requested = PathBuf::from(path);
    if requested.is_absolute() || requested.components().count() != 1 {
        return Err("图片路径只能包含文件名".into());
    }
    let image_dir = session.image_dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let root = image_dir.canonicalize().map_err(|error| error.to_string())?;
        let path = root.join(requested).canonicalize().map_err(|_| "图片文件不存在".to_string())?;
        if !path.starts_with(&root) || !path.is_file() {
            return Err("只允许读取当前用户的资产图片".into());
        }
        let mime = image_mime(&path)?;
        let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
        Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn save_backup(state: State<'_, AppState>, path: String, content_base64: String) -> Result<(), String> {
    current_session(&state)?;
    if path.trim().is_empty() {
        return Err("备份保存路径不能为空".into());
    }
    let bytes = STANDARD.decode(content_base64).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || std::fs::write(path, bytes))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_storage_settings(state: State<'_, AppState>) -> Result<StorageSettingsInfo, String> {
    require_admin(&state)?;
    storage_info(&state)
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.request_restart();
}

#[tauri::command]
pub async fn update_storage_settings(
    state: State<'_, AppState>,
    database_root: String,
    image_root: String,
) -> Result<StorageSettingsInfo, String> {
    let session = require_admin(&state)?;
    let target_database = settings::resolve_root(&state.app_dir, &database_root)?;
    let target_image = settings::resolve_root(&state.app_dir, &image_root)?;
    validate_storage_targets(&state, &target_database, &target_image)?;
    std::fs::create_dir_all(&target_database).map_err(|error| format!("创建数据库目录失败：{error}"))?;
    std::fs::create_dir_all(&target_image).map_err(|error| format!("创建图片目录失败：{error}"))?;

    if target_database != state.database_root {
        let target_system = target_database.join("system.db");
        if !target_system.exists() {
            vacuum_into(&state.system_pool, &target_system).await?;
        }
        let target_user_db = crate::db::user_database_path(&target_database, &session.user.id);
        if !target_user_db.exists() {
            if let Some(parent) = target_user_db.parent() {
                std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            vacuum_into(&session.pool, &target_user_db).await?;
        }
        let source = state.database_root.clone();
        let target = target_database.clone();
        tauri::async_runtime::spawn_blocking(move || settings::copy_directory(&source, &target))
            .await
            .map_err(|error| error.to_string())??;
    }

    if target_image != state.image_root {
        let source = state.image_root.clone();
        let target = target_image.clone();
        tauri::async_runtime::spawn_blocking(move || settings::copy_directory(&source, &target))
            .await
            .map_err(|error| error.to_string())??;
    }

    settings::save_roots(&state.settings_path, &target_database, &target_image)?;
    storage_info(&state)
}

fn validate_storage_targets(state: &State<'_, AppState>, target_database: &Path, target_image: &Path) -> Result<(), String> {
    for (source, target, label) in [
        (&state.database_root, target_database, "数据库"),
        (&state.image_root, target_image, "图片"),
    ] {
        if target != source && (target.starts_with(source) || source.starts_with(target)) {
            return Err(format!("{label}新旧目录不能互相包含，请选择独立目录"));
        }
    }
    Ok(())
}

async fn vacuum_into(pool: &sqlx::SqlitePool, path: &Path) -> Result<(), String> {
    sqlx::query("VACUUM INTO ?")
        .bind(path.to_string_lossy().into_owned())
        .execute(pool)
        .await
        .map_err(|error| format!("复制数据库失败：{error}"))?;
    Ok(())
}

fn storage_info(state: &State<'_, AppState>) -> Result<StorageSettingsInfo, String> {
    let configured = settings::read_roots(&state.settings_path, &state.app_dir)?;
    let default = settings::default_root(&state.app_dir);
    Ok(StorageSettingsInfo {
        database_root: configured.database.to_string_lossy().into_owned(),
        image_root: configured.image.to_string_lossy().into_owned(),
        active_database_root: state.database_root.to_string_lossy().into_owned(),
        active_image_root: state.image_root.to_string_lossy().into_owned(),
        default_database_root: default.to_string_lossy().into_owned(),
        default_image_root: default.to_string_lossy().into_owned(),
        settings_path: state.settings_path.to_string_lossy().into_owned(),
        restart_required: configured.database != state.database_root || configured.image != state.image_root,
    })
}

fn safe_asset_id(asset_id: &str) -> Result<String, String> {
    let safe_id: String = asset_id.chars().filter(|character| character.is_ascii_alphanumeric() || *character == '-' || *character == '_').collect();
    if safe_id.is_empty() {
        Err("资产 ID 不合法".into())
    } else {
        Ok(safe_id)
    }
}

fn image_mime(path: &Path) -> Result<&'static str, String> {
    match path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase().as_str() {
        "png" => Ok("image/png"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "gif" => Ok("image/gif"),
        "webp" => Ok("image/webp"),
        _ => Err("不支持的图片格式".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(id: &str, name: &str) -> Asset {
        Asset {
            id: id.into(), brand: "测试品牌".into(), name: name.into(), image: None,
            price: 100.0, currency: "CNY".into(), purchase_date: "2026-01-01".into(),
            purchase_location: String::new(), retired: false, retirement_date: None,
            sold: false, sale_price: None, sale_currency: "CNY".into(),
            sale_note: String::new(), note: String::new(),
            created_at: "2026-01-01 08:00:00".into(), updated_at: "2026-01-01 08:00:00".into(),
        }
    }

    #[test]
    fn append_skips_existing_ids_without_overwriting() {
        tauri::async_runtime::block_on(async {
            let directory = tempfile::tempdir().expect("创建临时数据库目录");
            let pool = crate::db::initialize_assets(&directory.path().join("assets.db")).await.expect("初始化数据库");
            upsert(&pool, &asset("same-id", "原始资产")).await.expect("写入原始资产");
            insert(&pool, &asset("same-id", "导入覆盖"), "ON CONFLICT(id) DO NOTHING").await.expect("跳过相同 ID");
            insert(&pool, &asset("new-id", "新增资产"), "ON CONFLICT(id) DO NOTHING").await.expect("写入新增资产");

            let name: String = sqlx::query_scalar("SELECT name FROM assets WHERE id = 'same-id'")
                .fetch_one(&pool).await.expect("读取原始资产");
            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
                .fetch_one(&pool).await.expect("统计资产");
            assert_eq!(name, "原始资产");
            assert_eq!(count, 2);
            pool.close().await;
        });
    }

    #[test]
    fn separate_user_databases_do_not_share_assets() {
        tauri::async_runtime::block_on(async {
            let directory = tempfile::tempdir().unwrap();
            let first = crate::db::initialize_assets(&directory.path().join("first.db")).await.unwrap();
            let second = crate::db::initialize_assets(&directory.path().join("second.db")).await.unwrap();
            upsert(&first, &asset("shared-id", "用户一")).await.unwrap();
            upsert(&second, &asset("shared-id", "用户二")).await.unwrap();
            let first_name: String = sqlx::query_scalar("SELECT name FROM assets WHERE id = 'shared-id'").fetch_one(&first).await.unwrap();
            let second_name: String = sqlx::query_scalar("SELECT name FROM assets WHERE id = 'shared-id'").fetch_one(&second).await.unwrap();
            assert_eq!(first_name, "用户一");
            assert_eq!(second_name, "用户二");
            first.close().await;
            second.close().await;
        });
    }

    #[test]
    fn vacuum_copy_preserves_the_user_database() {
        tauri::async_runtime::block_on(async {
            let directory = tempfile::tempdir().unwrap();
            let source = crate::db::initialize_assets(&directory.path().join("source.db")).await.unwrap();
            upsert(&source, &asset("asset-id", "迁移资产")).await.unwrap();
            let target_path = directory.path().join("target.db");
            vacuum_into(&source, &target_path).await.unwrap();
            let target = crate::db::initialize_assets(&target_path).await.unwrap();
            let name: String = sqlx::query_scalar("SELECT name FROM assets WHERE id = 'asset-id'").fetch_one(&target).await.unwrap();
            assert_eq!(name, "迁移资产");
            source.close().await;
            target.close().await;
        });
    }
}
