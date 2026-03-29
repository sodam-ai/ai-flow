use crate::models::provider::{mask_api_key, ApiKeyStatus};

const SERVICE: &str = "aiflow";

/// Save API key to OS keychain
pub fn save_key(provider: &str, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, provider)
        .map_err(|e| format!("KEYCHAIN_002: {}", e))?;
    entry
        .set_password(key)
        .map_err(|e| format!("KEYCHAIN_002: Failed to save key: {}", e))?;
    log::info!("API key saved for provider: {}", provider);
    Ok(())
}

/// Get API key status (masked, never returns full key to frontend)
pub fn get_status(provider: &str) -> ApiKeyStatus {
    let entry = match keyring::Entry::new(SERVICE, provider) {
        Ok(e) => e,
        Err(_) => return ApiKeyStatus { is_set: false, masked_preview: None },
    };

    match entry.get_password() {
        Ok(key) => ApiKeyStatus {
            is_set: true,
            masked_preview: Some(mask_api_key(&key)),
        },
        Err(_) => ApiKeyStatus {
            is_set: false,
            masked_preview: None,
        },
    }
}

/// Get raw API key (internal use only — NEVER expose via IPC)
pub fn get_key_internal(provider: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE, provider)
        .map_err(|e| format!("KEYCHAIN_001: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("KEYCHAIN_001: Cannot load key: {}", e))
}

/// Delete API key from OS keychain
pub fn delete_key(provider: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, provider)
        .map_err(|e| format!("KEYCHAIN_003: {}", e))?;
    entry
        .delete_credential()
        .map_err(|e| format!("KEYCHAIN_003: Failed to delete: {}", e))?;
    log::info!("API key deleted for provider: {}", provider);
    Ok(())
}
