use crate::services;
use crate::services::file_handler::FileContent;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn validate_and_read_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<FileContent, String> {
    let file = services::file_handler::read_file_content(&path)?;
    services::audit::log_event(
        &state.db,
        "file_read",
        "INFO",
        Some(&format!("{} ({}KB)", file.info.name, file.info.size / 1024)),
    );
    Ok(file)
}

#[tauri::command]
pub async fn read_clipboard_content(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    let content = app
        .clipboard()
        .read_text()
        .map_err(|e| format!("CLIP_001: Cannot read clipboard: {}", e))?;

    if content.is_empty() {
        Err("CLIP_002: Clipboard is empty".to_string())
    } else {
        Ok(content)
    }
}
