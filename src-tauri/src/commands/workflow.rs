use crate::{models::workflow::*, services, AppState};
use tauri::{State, AppHandle};

// ─── Templates ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_workflow_templates(state: State<'_, AppState>) -> Result<Vec<WorkflowTemplate>, String> {
    services::workflow::list_templates(&state.db)
}

// ─── Workflows ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_workflows(state: State<'_, AppState>) -> Result<Vec<Workflow>, String> {
    services::workflow::list_workflows(&state.db)
}

#[tauri::command]
pub fn create_workflow(
    state: State<'_, AppState>,
    req: CreateWorkflowRequest,
) -> Result<Workflow, String> {
    services::workflow::create_workflow(&state.db, req)
}

#[tauri::command]
pub fn get_workflow(state: State<'_, AppState>, id: i64) -> Result<Workflow, String> {
    services::workflow::get_workflow(&state.db, id)
}

#[tauri::command]
pub fn delete_workflow(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    services::workflow::delete_workflow(&state.db, id)
}

/// 워크플로우 실행 — 비동기, 진행 상황은 이벤트로 emit
#[tauri::command]
pub async fn run_workflow(
    state: State<'_, AppState>,
    app: AppHandle,
    req: RunWorkflowRequest,
) -> Result<WorkflowRun, String> {
    let db = state.db.clone();
    let http = state.http_client.clone();
    services::workflow::run_workflow(db, app, http, req).await
}

#[tauri::command]
pub fn get_workflow_run(state: State<'_, AppState>, run_id: i64) -> Result<WorkflowRun, String> {
    services::workflow::get_workflow_run(&state.db, run_id)
}

#[tauri::command]
pub fn list_workflow_runs(
    state: State<'_, AppState>,
    workflow_id: i64,
) -> Result<Vec<WorkflowRun>, String> {
    services::workflow::list_workflow_runs(&state.db, workflow_id)
}

// ─── Batch ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_batch_jobs(state: State<'_, AppState>) -> Result<Vec<BatchJob>, String> {
    services::workflow::list_batch_jobs(&state.db)
}

#[tauri::command]
pub fn create_batch_job(
    state: State<'_, AppState>,
    req: CreateBatchJobRequest,
) -> Result<BatchJob, String> {
    services::workflow::create_batch_job(&state.db, req)
}

#[tauri::command]
pub fn get_batch_job(state: State<'_, AppState>, id: i64) -> Result<BatchJob, String> {
    services::workflow::get_batch_job(&state.db, id)
}

#[tauri::command]
pub fn get_batch_items(state: State<'_, AppState>, job_id: i64) -> Result<Vec<BatchItem>, String> {
    services::workflow::get_batch_items(&state.db, job_id)
}

/// 배치 실행 — Tokio spawn으로 백그라운드 처리
#[tauri::command]
pub async fn run_batch_job(
    state: State<'_, AppState>,
    app: AppHandle,
    job_id: i64,
) -> Result<(), String> {
    let db = state.db.clone();
    let http = state.http_client.clone();
    // 별도 태스크로 실행 (커맨드 핸들러가 블록되지 않도록)
    tokio::spawn(async move {
        if let Err(e) = services::workflow::run_batch_job(db, app, http, job_id).await {
            log::error!("Batch job {} failed: {}", job_id, e);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_batch_job(state: State<'_, AppState>, job_id: i64) -> Result<(), String> {
    services::workflow::cancel_batch_job(&state.db, job_id)
}
