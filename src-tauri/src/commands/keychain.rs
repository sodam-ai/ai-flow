use crate::models::provider::ApiKeyStatus;
use crate::services;
use crate::AppState;
use tauri::State;

/// Save API key to OS keychain with validation (PRD §05: validate before save)
#[tauri::command]
pub async fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<(), String> {
    // Step 1: Format + API validation (PRD §05 mandatory)
    services::key_validator::validate_api_key(&provider, &key).await?;

    // Step 2: Save to OS keychain (only after validation succeeds)
    services::keychain::save_key(&provider, &key)?;

    // Step 3: Audit log
    services::audit::log_event(&state.db, "api_key_saved", "INFO", Some(&provider));

    log::info!("API key validated and saved for provider: {}", provider);
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

/// Validate API key without saving (for "Test Connection" button)
#[tauri::command]
pub async fn validate_api_key_only(
    provider: String,
    key: String,
) -> Result<(), String> {
    services::key_validator::validate_api_key(&provider, &key).await
}
