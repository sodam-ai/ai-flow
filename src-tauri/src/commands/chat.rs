use crate::models::conversation::{Conversation, Message};
use crate::services;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn create_conversation(
    state: State<'_, AppState>,
    provider_id: String,
    model_id: String,
) -> Result<Conversation, String> {
    services::chat::create_conversation(&state.db, &provider_id, &model_id)
}

#[tauri::command]
pub async fn get_conversations(
    state: State<'_, AppState>,
) -> Result<Vec<Conversation>, String> {
    services::chat::get_conversations(&state.db)
}

#[tauri::command]
pub async fn get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
    limit: Option<i64>,
) -> Result<Vec<Message>, String> {
    let limit = limit.unwrap_or(50).min(100);
    services::chat::get_messages(&state.db, &conversation_id, limit)
}

#[tauri::command]
pub async fn delete_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    state.db.write(|conn| {
        conn.execute(
            "DELETE FROM conversations WHERE id = ?1",
            rusqlite::params![conversation_id],
        )?;
        Ok(())
    })?;
    services::audit::log_event(&state.db, "conversation_deleted", "INFO", Some(&conversation_id));
    Ok(())
}

#[tauri::command]
pub async fn rename_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
    title: String,
) -> Result<(), String> {
    state.db.write(|conn| {
        conn.execute(
            "UPDATE conversations SET title = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![conversation_id, title],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub async fn toggle_pin(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    state.db.write(|conn| {
        conn.execute(
            "UPDATE conversations SET is_pinned = NOT is_pinned, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![conversation_id],
        )?;
        Ok(())
    })
}
