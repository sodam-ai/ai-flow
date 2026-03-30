use crate::models::prompt::{CreatePromptInput, PromptTemplate, UpdatePromptInput};
use crate::services;
use crate::AppState;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn list_prompts(
    state: State<'_, AppState>,
    tag: Option<String>,
) -> Result<Vec<PromptTemplate>, String> {
    services::prompt::list_prompts(&state.db, tag.as_deref())
}

#[tauri::command]
pub async fn get_prompt(state: State<'_, AppState>, id: String) -> Result<PromptTemplate, String> {
    services::prompt::get_prompt(&state.db, &id)
}

#[tauri::command]
pub async fn create_prompt(
    state: State<'_, AppState>,
    input: CreatePromptInput,
) -> Result<PromptTemplate, String> {
    let prompt = services::prompt::create_prompt(&state.db, input)?;
    services::audit::log_event(
        &state.db,
        "prompt_created",
        "INFO",
        Some(&prompt.title),
    );
    Ok(prompt)
}

#[tauri::command]
pub async fn update_prompt(
    state: State<'_, AppState>,
    id: String,
    input: UpdatePromptInput,
) -> Result<PromptTemplate, String> {
    let prompt = services::prompt::update_prompt(&state.db, &id, input)?;
    services::audit::log_event(
        &state.db,
        "prompt_updated",
        "INFO",
        Some(&prompt.title),
    );
    Ok(prompt)
}

#[tauri::command]
pub async fn delete_prompt(state: State<'_, AppState>, id: String) -> Result<(), String> {
    services::prompt::delete_prompt(&state.db, &id)?;
    services::audit::log_event(&state.db, "prompt_deleted", "INFO", Some(&id));
    Ok(())
}

#[tauri::command]
pub async fn use_prompt(
    state: State<'_, AppState>,
    id: String,
    variables: HashMap<String, String>,
) -> Result<String, String> {
    let prompt = services::prompt::get_prompt(&state.db, &id)?;
    services::prompt::increment_use_count(&state.db, &id)?;
    let result = services::prompt::apply_variables(&prompt.content, &variables);
    services::audit::log_event(&state.db, "prompt_used", "INFO", Some(&prompt.title));
    Ok(result)
}
