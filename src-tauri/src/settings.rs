use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

pub const SETTINGS_FILE: &str = "worth-remembering-settings.json";
const DEFAULT_DIR: &str = "worth-remembering-data";

#[derive(Debug, Clone)]
pub struct StorageRoots {
    pub database: PathBuf,
    pub image: PathBuf,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSettings {
    #[serde(default)]
    data_root: Option<String>,
    #[serde(default)]
    database_root: Option<String>,
    #[serde(default)]
    image_root: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedSettings {
    database_root: String,
    image_root: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSettingsInfo {
    pub database_root: String,
    pub image_root: String,
    pub active_database_root: String,
    pub active_image_root: String,
    pub default_database_root: String,
    pub default_image_root: String,
    pub settings_path: String,
    pub restart_required: bool,
}

pub fn default_root(app_dir: &Path) -> PathBuf {
    app_dir.join(DEFAULT_DIR)
}

pub fn read_roots(settings_path: &Path, app_dir: &Path) -> Result<StorageRoots, String> {
    let default = default_root(app_dir);
    if !settings_path.exists() {
        return Ok(StorageRoots { database: default.clone(), image: default });
    }
    let content = std::fs::read_to_string(settings_path)
        .map_err(|error| format!("读取存储设置失败：{error}"))?;
    let settings: StoredSettings = serde_json::from_str(&content)
        .map_err(|error| format!("存储设置格式不正确：{error}"))?;
    let fallback = settings.data_root.as_deref();
    let database = settings.database_root.as_deref().or(fallback).unwrap_or(DEFAULT_DIR);
    let image = settings.image_root.as_deref().or(fallback).unwrap_or(DEFAULT_DIR);
    Ok(StorageRoots {
        database: resolve_root(app_dir, database)?,
        image: resolve_root(app_dir, image)?,
    })
}

pub fn resolve_root(app_dir: &Path, value: &str) -> Result<PathBuf, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("数据根目录不能为空".into());
    }
    let path = PathBuf::from(value);
    let root = if path.is_absolute() { path } else { app_dir.join(path) };
    if root.exists() && !root.is_dir() {
        return Err("数据根目录必须是一个文件夹".into());
    }
    Ok(root)
}

pub fn save_roots(settings_path: &Path, database_root: &Path, image_root: &Path) -> Result<(), String> {
    let settings = PersistedSettings {
        database_root: database_root.to_string_lossy().into_owned(),
        image_root: image_root.to_string_lossy().into_owned(),
    };
    let content = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    std::fs::write(settings_path, format!("{content}\n"))
        .map_err(|error| format!("保存存储设置失败：{error}"))
}

pub fn copy_directory(source: &Path, target: &Path) -> Result<(), String> {
    if source == target || !source.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in std::fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let target_path = target.join(entry.file_name());
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            copy_directory(&entry.path(), &target_path)?;
        } else if !target_path.exists() {
            std::fs::copy(entry.path(), &target_path)
                .map_err(|error| format!("复制 {} 失败：{error}", entry.path().display()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_roots_use_executable_directory() {
        let app_dir = Path::new(r"D:\worth-remembering");
        assert_eq!(resolve_root(app_dir, r"data\shared").unwrap(), app_dir.join(r"data\shared"));
    }

    #[test]
    fn legacy_data_root_applies_to_database_and_images() {
        let temp = tempfile::tempdir().unwrap();
        let app_dir = temp.path();
        let settings_path = app_dir.join(SETTINGS_FILE);
        std::fs::write(&settings_path, r#"{ "dataRoot": "legacy-data" }"#).unwrap();
        let roots = read_roots(&settings_path, app_dir).unwrap();
        assert_eq!(roots.database, app_dir.join("legacy-data"));
        assert_eq!(roots.image, app_dir.join("legacy-data"));
    }

    #[test]
    fn database_and_image_roots_can_be_independent() {
        let temp = tempfile::tempdir().unwrap();
        let app_dir = temp.path();
        let settings_path = app_dir.join(SETTINGS_FILE);
        std::fs::write(&settings_path, r#"{ "databaseRoot": "databases", "imageRoot": "images" }"#).unwrap();
        let roots = read_roots(&settings_path, app_dir).unwrap();
        assert_eq!(roots.database, app_dir.join("databases"));
        assert_eq!(roots.image, app_dir.join("images"));
    }

    #[test]
    fn directory_copy_does_not_overwrite_existing_files() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let target = temp.path().join("target");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(source.join("value.txt"), "new").unwrap();
        std::fs::write(target.join("value.txt"), "existing").unwrap();
        copy_directory(&source, &target).unwrap();
        assert_eq!(std::fs::read_to_string(target.join("value.txt")).unwrap(), "existing");
    }
}
