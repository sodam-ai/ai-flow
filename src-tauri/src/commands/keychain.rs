use tauri::State;

use crate::error::{CommandResult, ErrorCode, IpcError};
use crate::models::provider::ApiKeyStatus;
use crate::AppState;

/// API 키 저장 — 실제 키는 OS 키체인에만 저장 (DB/IPC에 절대 노출 안 함)
#[tauri::command]
pub async fn set_api_key(
    state: State<'_, AppState>,
    provider_id: String,
    api_key: String,
) -> CommandResult<ApiKeyStatus> {
    // 입력 검증 — 최소 길이
    if api_key.trim().len() < 10 {
        return Err(IpcError::new(
            ErrorCode::Keychain001,
            "API key too short",
        ));
    }

    let service = "aiflow";
    let account = format!("{}_api_key", provider_id);

    state
        .keychain
        .set_secret(service, &account, &api_key)
        .map_err(|e| {
            IpcError::new(ErrorCode::Keychain001, "Failed to save API key").with_detail(e.to_string())
        })?;

    state
        .audit
        .log(crate::services::audit::AuditEvent::ApiKeySet {
            provider: provider_id.clone(),
        })
        .await;

    Ok(ApiKeyStatus::is_set(provider_id, &api_key))
}

/// API 키 상태 조회 — 마스킹 미리보기만 반환 (실제 키값 절대 IPC 통과 안 함)
/// 04_PROJECT_SPEC.md C-1: get_api_key IPC 제거, get_api_key_status만 허용
#[tauri::command]
pub fn get_api_key_status(
    state: State<'_, AppState>,
    provider_id: String,
) -> CommandResult<ApiKeyStatus> {
    let account = format!("{}_api_key", provider_id);

    match state.keychain.get_secret("aiflow", &account) {
        Ok(Some(key)) => Ok(ApiKeyStatus::is_set(provider_id, key.as_str())),
        Ok(None) => Ok(ApiKeyStatus::not_set(provider_id)),
        Err(e) => Err(
            IpcError::new(ErrorCode::Keychain001, "Keychain access failed")
                .with_detail(e.to_string()),
        ),
    }
}

/// API 키 삭제
#[tauri::command]
pub async fn delete_api_key(
    state: State<'_, AppState>,
    provider_id: String,
) -> CommandResult<()> {
    let account = format!("{}_api_key", provider_id);

    state
        .keychain
        .delete_secret("aiflow", &account)
        .map_err(|e| {
            IpcError::new(ErrorCode::Keychain001, "Failed to delete API key")
                .with_detail(e.to_string())
        })?;

    state
        .audit
        .log(crate::services::audit::AuditEvent::ApiKeyDeleted {
            provider: provider_id,
        })
        .await;

    Ok(())
}
