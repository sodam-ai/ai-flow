use crate::models::provider::ApiKeyStatus;
use crate::services;
use crate::AppState;
use tauri::State;

/// Save API key to OS keychain (PRD: NEVER store in DB)
#[tauri::command]
pub async fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<(), String> {
    // Format validation
    if key.trim().is_empty() {
        return Err("VAL_001: API key cannot be empty".to_string());
    }

    services::keychain::save_key(&provider, &key)?;

    // Audit log
    services::audit::log_event(&state.db, "api_key_saved", "INFO", Some(&provider));

    Ok(())
}

/// Get API key status (masked preview only — NEVER returns full key)
#[tauri::command]
pub async fn get_api_key_status(provider: String) -> Result<ApiKeyStatus, String> {
    Ok(services::keychain::get_status(&provider))
}

/// Delete API key from OS keychain
#[tauri::command]
pub async fn delete_api_key(
    state: State<'_, AppState>,
    provider: String,
) -> Result<(), String> {
    services::keychain::delete_key(&provider)?;
    services::audit::log_event(&state.db, "api_key_deleted", "INFO", Some(&provider));
    Ok(())
}
