use std::path::{Path, PathBuf};
use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, SqlitePool};
use crate::model::ActiveSession;

pub async fn initialize_system(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let pool = connect(path).await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            normalized_username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login_at TEXT
        )
        "#,
    )
    .execute(&pool)
    .await?;
    Ok(pool)
}

pub async fn initialize_assets(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let pool = connect(path).await?;
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            brand TEXT NOT NULL,
            name TEXT NOT NULL,
            image TEXT,
            price REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            purchase_date TEXT NOT NULL,
            purchase_location TEXT NOT NULL DEFAULT '',
            retired INTEGER NOT NULL DEFAULT 0,
            retirement_date TEXT,
            sold INTEGER NOT NULL DEFAULT 0,
            sale_price REAL,
            sale_currency TEXT NOT NULL DEFAULT 'CNY',
            sale_note TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(&pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_assets_purchase_date ON assets(purchase_date DESC)")
        .execute(&pool)
        .await?;
    Ok(pool)
}

async fn connect(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(sqlx::Error::Io)?;
    }
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true);
    SqlitePool::connect_with(options.disable_statement_logging()).await
}

pub async fn open_user_session(
    database_root: &Path,
    image_root: &Path,
    user: crate::model::SafeUser,
) -> Result<ActiveSession, String> {
    let image_dir = user_image_dir(image_root, &user.id);
    std::fs::create_dir_all(&image_dir).map_err(|error| format!("创建用户图片目录失败：{error}"))?;
    let pool = initialize_assets(&user_database_path(database_root, &user.id)).await
        .map_err(|error| format!("初始化用户数据库失败：{error}"))?;
    normalize_image_paths(&pool).await.map_err(|error| format!("整理图片路径失败：{error}"))?;
    Ok(ActiveSession { user, pool, image_dir })
}

async fn normalize_image_paths(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT id, image FROM assets WHERE image IS NOT NULL")
        .fetch_all(pool)
        .await?;
    for (id, image) in rows {
        if image.starts_with('/') || image.starts_with("data:") || Path::new(&image).components().count() == 1 {
            continue;
        }
        if let Some(filename) = Path::new(&image).file_name().and_then(|value| value.to_str()) {
            sqlx::query("UPDATE assets SET image = ? WHERE id = ?")
                .bind(filename)
                .bind(id)
                .execute(pool)
                .await?;
        }
    }
    Ok(())
}

pub fn user_database_path(database_root: &Path, user_id: &str) -> PathBuf {
    database_root.join("users").join(user_id).join("assets.db")
}

pub fn user_image_dir(image_root: &Path, user_id: &str) -> PathBuf {
    image_root.join("users").join(user_id).join("images")
}
