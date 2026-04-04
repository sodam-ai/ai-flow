use crate::AppState;
use tauri::State;

/// Log PII detection from frontend (after OpenRedaction scan)
#[tauri::command]
pub async fn log_pii_detection(
    state: State<'_, AppState>,
    conversation_id: String,
    message_id: Option<String>,
    pii_type: String,
    pii_count: i32,
    was_masked: bool,
) -> Result<(), String> {
    crate::services::privacy::log_detection(
        &state.db,
        &conversation_id,
        message_id.as_deref(),
        &pii_type,
        pii_count,
        was_masked,
    )
}

/// Get privacy stats for a conversation
#[tauri::command]
pub async fn get_privacy_stats(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<crate::services::privacy::PiiStat>, String> {
    crate::services::privacy::get_stats(&state.db, &conversation_id)
}

/// Get global privacy stats (all conversations combined) for dashboard
#[tauri::command]
pub async fn get_global_privacy_stats(
    state: State<'_, AppState>,
) -> Result<crate::services::privacy::GlobalPrivacyStats, String> {
    crate::services::privacy::get_global_stats(&state.db)
}

/// Get audit log entries (read-only, newest first)
#[tauri::command]
pub async fn get_audit_log(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<crate::services::audit::AuditEntry>, String> {
    crate::services::audit::get_entries(&state.db, limit.unwrap_or(100), offset.unwrap_or(0))
}
