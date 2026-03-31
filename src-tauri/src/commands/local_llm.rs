use crate::AppState;
use crate::models::local_llm::LocalLlmDetectionResult;
use tauri::State;

/// Detect running local LLM servers (Ollama, LM Studio)
#[tauri::command]
pub async fn detect_local_llms(
    state: State<'_, AppState>,
) -> Result<Vec<LocalLlmDetectionResult>, String> {
    let results = crate::services::local_llm::detect_all(&state.db).await;

    let running_count = results.iter().filter(|r| r.is_running).count();
    let model_count: usize = results.iter().map(|r| r.models.len()).sum();

    crate::services::audit::log_event(
        &state.db,
        "local_llm_scan",
        "INFO",
        Some(&format!("found {} endpoints, {} models", running_count, model_count)),
    );

    Ok(results)
}

/// Get saved local LLM endpoints from DB
#[tauri::command]
pub async fn get_local_endpoints(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::local_llm::LocalLlmEndpoint>, String> {
    crate::services::local_llm::get_endpoints(&state.db)
}
