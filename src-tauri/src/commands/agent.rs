use crate::{
    models::agent::*,
    services::agent,
    AppState,
};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn start_agent_run(
    req: StartAgentRequest,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<AgentRun, String> {
    let db = Arc::clone(&state.db);
    let http_client = Arc::clone(&state.http_client);
    agent::start_agent_run(db, app, http_client, req).await
}

#[tauri::command]
pub async fn resume_agent_run(
    run_id: i64,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<AgentRun, String> {
    let db = Arc::clone(&state.db);
    let http_client = Arc::clone(&state.http_client);
    agent::resume_agent_run(db, app, http_client, run_id).await
}

#[tauri::command]
pub fn approve_agent_step(
    req: ApproveAgentStepRequest,
    state: State<AppState>,
) -> Result<AgentStep, String> {
    agent::approve_step(&state.db, req)
}

#[tauri::command]
pub fn cancel_agent_run(run_id: i64, state: State<AppState>) -> Result<(), String> {
    agent::cancel_agent_run(&state.db, run_id)
}

#[tauri::command]
pub fn list_agent_runs(state: State<AppState>) -> Result<Vec<AgentRun>, String> {
    agent::list_agent_runs(&state.db)
}

#[tauri::command]
pub fn get_agent_run(run_id: i64, state: State<AppState>) -> Result<AgentRun, String> {
    agent::get_agent_run(&state.db, run_id)
}

// ─── Conversation Branching ───────────────────────────────────────────────

#[tauri::command]
pub fn create_conversation_branch(
    req: CreateBranchRequest,
    state: State<AppState>,
) -> Result<ConversationBranch, String> {
    agent::create_branch(&state.db, req)
}

#[tauri::command]
pub fn list_conversation_branches(
    conversation_id: String,
    state: State<AppState>,
) -> Result<Vec<ConversationBranch>, String> {
    agent::list_branches(&state.db, &conversation_id)
}

// ─── Workflow Export/Import ───────────────────────────────────────────────

#[tauri::command]
pub fn export_workflow(workflow_id: i64, state: State<AppState>) -> Result<String, String> {
    crate::services::workflow::export_workflow(&state.db, workflow_id)
}

#[tauri::command]
pub fn import_workflow(json_str: String, state: State<AppState>) -> Result<crate::models::workflow::Workflow, String> {
    crate::services::workflow::import_workflow(&state.db, &json_str)
}
