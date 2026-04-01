use crate::models::conversation::{Conversation, Message, MessageVersion};
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

#[tauri::command]
pub async fn get_message_versions(
    state: State<'_, AppState>,
    message_id: String,
) -> Result<Vec<MessageVersion>, String> {
    services::chat::get_message_versions(&state.db, &message_id)
}

#[tauri::command]
pub async fn search_messages(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<Message>, String> {
    let limit = limit.unwrap_or(20).min(50);
    services::chat::search_messages(&state.db, &query, limit)
}

/// Export a conversation as Markdown or JSON string (for Save As / clipboard)
#[tauri::command]
pub async fn export_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
    format: String, // "markdown" | "json"
) -> Result<String, String> {
    // Validate format
    if format != "markdown" && format != "json" {
        return Err("format은 'markdown' 또는 'json' 이어야 합니다.".into());
    }

    // Load conversation metadata
    let conv = state.db.read(|conn| {
        conn.query_row(
            "SELECT id, title, provider_id, model_id, created_at FROM conversations WHERE id=?1",
            rusqlite::params![conversation_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        )
    }).map_err(|_| "대화를 찾을 수 없습니다.".to_string())?;

    let messages = services::chat::get_messages(&state.db, &conversation_id, 500)?;

    match format.as_str() {
        "json" => {
            let payload = serde_json::json!({
                "id": conv.0,
                "title": conv.1,
                "provider": conv.2,
                "model": conv.3,
                "createdAt": conv.4,
                "messages": messages.iter().map(|m| serde_json::json!({
                    "role": m.role,
                    "content": m.content,
                    "createdAt": m.created_at,
                    "inputTokens": m.input_tokens,
                    "outputTokens": m.output_tokens,
                    "costUsd": m.cost_usd,
                })).collect::<Vec<_>>()
            });
            serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
        }
        _ => {
            // Markdown format
            let mut md = format!("# {}\n\n", conv.1);
            md.push_str(&format!("**모델**: {}/{} · **생성**: {}\n\n", conv.2, conv.3, &conv.4[..10]));
            md.push_str("---\n\n");
            for msg in &messages {
                let role_label = if msg.role == "user" { "**사용자**" } else { "**AI**" };
                md.push_str(&format!("## {}\n\n{}\n\n", role_label, msg.content));
                if msg.role == "assistant" {
                    if let (Some(inp), Some(out)) = (msg.input_tokens, msg.output_tokens) {
                        md.push_str(&format!("*토큰: in={} out={}*\n\n", inp, out));
                    }
                }
                md.push_str("---\n\n");
            }
            Ok(md)
        }
    }
}
