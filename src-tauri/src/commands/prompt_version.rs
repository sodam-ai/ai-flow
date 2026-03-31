use crate::AppState;
use tauri::State;

/// Get all versions of a prompt
#[tauri::command]
pub async fn get_prompt_versions(
    state: State<'_, AppState>,
    prompt_id: String,
) -> Result<Vec<crate::services::prompt_version::PromptVersion>, String> {
    crate::services::prompt_version::get_versions(&state.db, &prompt_id)
}

/// Restore a specific version of a prompt
#[tauri::command]
pub async fn restore_prompt_version(
    state: State<'_, AppState>,
    prompt_id: String,
    version_id: String,
) -> Result<(), String> {
    crate::services::prompt_version::restore_version(&state.db, &prompt_id, &version_id)?;

    crate::services::audit::log_event(
        &state.db,
        "prompt_version_restored",
        "INFO",
        Some(&format!("prompt={} version={}", &prompt_id[..8.min(prompt_id.len())], &version_id[..8.min(version_id.len())])),
    );

    Ok(())
}
