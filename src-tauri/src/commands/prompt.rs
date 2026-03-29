use tauri::State;

use crate::error::{CommandResult, ErrorCode, IpcError};
use crate::models::prompt::Prompt;
use crate::AppState;

#[tauri::command]
pub fn list_prompts(
    state: State<'_, AppState>,
    category: Option<String>,
) -> CommandResult<Vec<Prompt>> {
    state
        .prompt
        .list_prompts(category)
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to list prompts").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn create_prompt(
    state: State<'_, AppState>,
    title: String,
    content: String,
    category: Option<String>,
    tags: Vec<String>,
) -> CommandResult<Prompt> {
    state
        .prompt
        .create_prompt(title, content, category, tags)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to create prompt").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn update_prompt(
    state: State<'_, AppState>,
    id: String,
    title: String,
    content: String,
    category: Option<String>,
    tags: Vec<String>,
) -> CommandResult<Prompt> {
    state
        .prompt
        .update_prompt(id, title, content, category, tags)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to update prompt").with_detail(e.to_string()))
}

#[tauri::command]
pub async fn delete_prompt(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<()> {
    state
        .prompt
        .delete_prompt(id)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to delete prompt").with_detail(e.to_string()))
}

/// 프롬프트 사용 — use_count 증가 후 프롬프트 반환
/// 프론트엔드가 이 커맨드를 호출하면 빈도 통계가 자동으로 쌓임
#[tauri::command]
pub async fn use_prompt(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<()> {
    state
        .prompt
        .increment_use_count(id)
        .await
        .map_err(|e| IpcError::new(ErrorCode::Db003, "Failed to record prompt usage").with_detail(e.to_string()))
}
