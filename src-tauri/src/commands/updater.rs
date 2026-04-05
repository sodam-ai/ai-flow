use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Returned to the frontend after checking for updates
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
    pub current_version: String,
}

/// Check GitHub Releases for a newer version.
///
/// ASVS 10.3.1: Update metadata is verified against the Ed25519 pubkey
/// embedded in tauri.conf.json — unsigned or tampered payloads are rejected
/// before this function returns.
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("UPDATE_001: {e}"))?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
            current_version: current,
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: None,
            notes: None,
            date: None,
            current_version: current,
        }),
        // Network errors or no configured endpoint are non-fatal — silently return unavailable
        Err(e) => {
            log::warn!("Update check failed (non-fatal): {}", e);
            Ok(UpdateInfo {
                available: false,
                version: None,
                notes: None,
                date: None,
                current_version: current,
            })
        }
    }
}

/// Download and install the latest release.
///
/// ASVS 10.3.2: Only artifacts whose Ed25519 signature matches the bundled
/// pubkey are installed. The plugin verifies the signature before writing
/// any bytes to disk.
///
/// Emits "aiflow://update-progress" events with `{ downloaded: u64, total: Option<u64> }`
/// so the frontend can show a progress bar.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("UPDATE_001: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("UPDATE_001: {e}"))?
        .ok_or_else(|| "UPDATE_003: No update available".to_string())?;

    let app_handle = app.clone();
    update
        .download_and_install(
            move |downloaded, total| {
                let _ = app_handle.emit(
                    "aiflow://update-progress",
                    serde_json::json!({ "downloaded": downloaded, "total": total }),
                );
            },
            || {
                log::info!("Update download complete — preparing install");
            },
        )
        .await
        .map_err(|e| format!("UPDATE_002: {e}"))
}
