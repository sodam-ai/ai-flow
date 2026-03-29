use tauri::State;

use crate::error::{CommandResult, ErrorCode, IpcError};
use crate::models::conversation::{Conversation, MessagePageResult};
use crate::AppState;

#[tauri::command]
pub async fn create_conversation(
    state: State<'_, AppState>,
    provider_id: String,
    model_id: String,
) -> CommandResult<Conversation> {
    state
        .chat
        .create_conversation(provider_id, model_id)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to create conversation").with_detail(e.to_string()))
}

#[tauri::command]
pub fn list_conversations(state: State<'_, AppState>) -> CommandResult<Vec<Conversation>> {
    state
        .chat
        .list_conversations()
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to list conversations").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn delete_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
) -> CommandResult<()> {
    let cid = conversation_id.clone();
    state
        .chat
        .delete_conversation(conversation_id)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to delete conversation").with_detail(e.to_string()))?;

    state
        .audit
        .log(crate::services::audit::AuditEvent::ConversationDeleted {
            conversation_id: cid,
        })
        .await;

    Ok(())
}

#[tauri::command]
pub async fn rename_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
    title: String,
) -> CommandResult<()> {
    state
        .chat
        .rename_conversation(conversation_id, title)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to rename conversation").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn toggle_pin_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
) -> CommandResult<bool> {
    state
        .chat
        .toggle_pin_conversation(conversation_id)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to toggle pin").with_detail(e.to_string()))
}

#[tauri::command]
pub fn get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
    before_id: Option<String>,
    limit: Option<u32>,
) -> CommandResult<MessagePageResult> {
    let limit = limit.unwrap_or(50).min(100);
    state
        .chat
        .get_messages(&conversation_id, before_id.as_deref(), limit)
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to get messages").with_detail(e.to_string()))
}
