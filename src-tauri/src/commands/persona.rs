use tauri::State;

use crate::error::{CommandResult, ErrorCode, IpcError};
use crate::models::persona::Persona;
use crate::AppState;

#[tauri::command]
pub fn list_personas(state: State<'_, AppState>) -> CommandResult<Vec<Persona>> {
    state
        .persona
        .list_personas()
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to list personas").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn create_persona(
    state: State<'_, AppState>,
    name: String,
    system_prompt: String,
    avatar_emoji: String,
) -> CommandResult<Persona> {
    state
        .persona
        .create_persona(name, system_prompt, avatar_emoji)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to create persona").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn update_persona(
    state: State<'_, AppState>,
    id: String,
    name: String,
    system_prompt: String,
    avatar_emoji: String,
) -> CommandResult<Persona> {
    state
        .persona
        .update_persona(id, name, system_prompt, avatar_emoji)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to update persona").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn delete_persona(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<()> {
    state
        .persona
        .delete_persona(id)
        .await
        .map_err(|e| {
            // 기본 페르소나 삭제 시도는 Db003으로 노출 (UI에서 버튼 비활성화로 방지하지만 방어적 처리)
            IpcError::new(ErrorCode::Db003, "Failed to delete persona").with_detail(e.to_string())
        })
}
