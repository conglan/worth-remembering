mod auth;
mod commands;
mod db;
mod model;
mod settings;

use model::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let executable = std::env::current_exe()?;
            let app_dir = executable.parent().ok_or("无法确定应用目录")?.to_path_buf();
            let settings_path = app_dir.join(settings::SETTINGS_FILE);
            let roots = settings::read_roots(&settings_path, &app_dir)?;
            std::fs::create_dir_all(&roots.database)?;
            std::fs::create_dir_all(&roots.image)?;
            let system_pool = tauri::async_runtime::block_on(db::initialize_system(&roots.database.join("system.db")))
                .map_err(|error| format!("用户数据库初始化失败：{error}"))?;
            app.manage(AppState {
                system_pool,
                database_root: roots.database,
                image_root: roots.image,
                app_dir,
                settings_path,
                session: std::sync::RwLock::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::auth_status,
            auth::register,
            auth::login,
            auth::logout,
            auth::list_users,
            auth::create_user,
            auth::set_user_status,
            auth::reset_user_password,
            auth::delete_user,
            auth::update_profile,
            auth::change_password,
            commands::get_storage_settings,
            commands::update_storage_settings,
            commands::restart_app,
            commands::list_assets,
            commands::save_asset,
            commands::replace_assets,
            commands::append_assets,
            commands::delete_asset,
            commands::save_asset_image,
            commands::normalize_asset_image,
            commands::read_asset_image,
            commands::save_backup,
        ])
        .run(tauri::generate_context!())
        .expect("运行值得记应用时发生错误");
}
