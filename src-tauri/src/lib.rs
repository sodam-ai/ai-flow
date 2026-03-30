pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;

use std::sync::Arc;
use services::ai_client::get_http_client;

/// Global app state — managed by Tauri
pub struct AppState {
    pub db: Arc<db::pool::Database>,
    pub http_client: Arc<reqwest::Client>,
    pub streams: Arc<services::stream_registry::StreamRegistry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            use tauri::Manager;
            let app_handle = app.handle().clone();

            // Initialize database
            let database = db::pool::Database::init(&app_handle)?;

            // Initialize app state
            let state = AppState {
                db: Arc::new(database),
                http_client: Arc::new(get_http_client()),
                streams: Arc::new(services::stream_registry::StreamRegistry::new()),
            };
            app.manage(state);

            log::info!("AIFlow initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::keychain::save_api_key,
            commands::keychain::get_api_key_status,
            commands::keychain::delete_api_key,
            commands::keychain::validate_api_key_only,
            commands::chat::create_conversation,
            commands::chat::get_conversations,
            commands::chat::get_messages,
            commands::chat::delete_conversation,
            commands::chat::rename_conversation,
            commands::chat::toggle_pin,
            commands::ai::stream_ai_message,
            commands::ai::cancel_stream,
            commands::ai::get_model_catalog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
