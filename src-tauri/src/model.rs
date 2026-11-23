use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub brand: String,
    pub name: String,
    pub image: Option<String>,
    pub price: f64,
    pub currency: String,
    pub purchase_date: String,
    pub purchase_location: String,
    pub retired: bool,
    pub retirement_date: Option<String>,
    pub sold: bool,
    pub sale_price: Option<f64>,
    pub sale_currency: String,
    pub sale_note: String,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SafeUser {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRecord {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub password_hash: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_login_at: Option<String>,
}

impl From<UserRecord> for SafeUser {
    fn from(user: UserRecord) -> Self {
        Self {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            status: user.status,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login_at: user.last_login_at,
        }
    }
}

#[derive(Clone)]
pub struct ActiveSession {
    pub user: SafeUser,
    pub pool: SqlitePool,
    pub image_dir: PathBuf,
}

pub struct AppState {
    pub system_pool: SqlitePool,
    pub database_root: PathBuf,
    pub image_root: PathBuf,
    pub app_dir: PathBuf,
    pub settings_path: PathBuf,
    pub session: std::sync::RwLock<Option<ActiveSession>>,
}
