use crate::models::persona::{CreatePersonaInput, Persona, UpdatePersonaInput};
use crate::services;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_personas(state: State<'_, AppState>) -> Result<Vec<Persona>, String> {
    services::persona::list_personas(&state.db)
}

#[tauri::command]
pub async fn get_persona(state: State<'_, AppState>, id: String) -> Result<Persona, String> {
    services::persona::get_persona(&state.db, &id)
}

#[tauri::command]
pub async fn create_persona(
    state: State<'_, AppState>,
    input: CreatePersonaInput,
) -> Result<Persona, String> {
    let persona = services::persona::create_persona(&state.db, input)?;
    services::audit::log_event(
        &state.db,
        "persona_created",
        "INFO",
        Some(&persona.name),
    );
    Ok(persona)
}

#[tauri::command]
pub async fn update_persona(
    state: State<'_, AppState>,
    id: String,
    input: UpdatePersonaInput,
) -> Result<Persona, String> {
    let persona = services::persona::update_persona(&state.db, &id, input)?;
    services::audit::log_event(
        &state.db,
        "persona_updated",
        "INFO",
        Some(&persona.name),
    );
    Ok(persona)
}

#[tauri::command]
pub async fn delete_persona(state: State<'_, AppState>, id: String) -> Result<(), String> {
    services::persona::delete_persona(&state.db, &id)?;
    services::audit::log_event(&state.db, "persona_deleted", "INFO", Some(&id));
    Ok(())
}
