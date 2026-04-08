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

// ── Phase 10 — Per-conversation active KB persistence ─────────────────────

/// Max number of KB IDs that can be active on a single conversation.
/// Defensive bound against UI bugs or malicious callers trying to store
/// oversized arrays. 20 is ~10x realistic usage.
const MAX_ACTIVE_KB_IDS: usize = 20;

/// Load the persisted active KB IDs for a conversation.
///
/// Returns an empty vec if:
///   - conversation does not exist
///   - stored JSON is malformed (defensive — treat as reset)
///   - no column value (shouldn't happen due to DEFAULT '[]')
#[tauri::command]
pub async fn get_conversation_kb_ids(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<i64>, String> {
    state.db.read(|conn| {
        let json: String = conn
            .query_row(
                "SELECT active_kb_ids FROM conversations WHERE id = ?1",
                rusqlite::params![conversation_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "[]".to_string());

        // Defensive parse — if stored JSON is corrupt, return empty (don't error)
        let ids: Vec<i64> = serde_json::from_str(&json).unwrap_or_default();

        // Filter out any non-positive IDs that may have crept in from older rows
        Ok(ids.into_iter().filter(|&id| id > 0).collect())
    })
}

/// Persist the active KB IDs for a conversation.
///
/// Security (ASVS 5.1.1 — Input validation):
///   - Max 20 IDs enforced
///   - All IDs must be positive (> 0)
///   - Duplicate IDs are deduplicated
///   - Ordering preserved (first occurrence wins)
///   - Serialized via serde_json (no string interpolation — prevents injection)
///   - Parameterized SQL (rusqlite params)
///   - Returns error if conversation_id does not exist (rows_affected == 0)
#[tauri::command]
pub async fn save_conversation_kb_ids(
    state: State<'_, AppState>,
    conversation_id: String,
    kb_ids: Vec<i64>,
) -> Result<(), String> {
    // ── Input validation ─────────────────────────────────────────────────
    if kb_ids.len() > MAX_ACTIVE_KB_IDS {
        return Err(format!(
            "Too many active KBs: {} (max {})",
            kb_ids.len(),
            MAX_ACTIVE_KB_IDS
        ));
    }

    // Reject non-positive IDs and deduplicate (preserve first-seen order)
    let mut seen: std::collections::HashSet<i64> = std::collections::HashSet::new();
    let mut clean_ids: Vec<i64> = Vec::with_capacity(kb_ids.len());
    for id in kb_ids {
        if id <= 0 {
            return Err(format!("Invalid KB id: {} (must be positive)", id));
        }
        if seen.insert(id) {
            clean_ids.push(id);
        }
    }

    // Serialize as JSON array — serde_json guarantees valid JSON output
    let json = serde_json::to_string(&clean_ids)
        .map_err(|e| format!("Failed to serialize KB IDs: {}", e))?;

    state.db.write(|conn| {
        let affected = conn.execute(
            "UPDATE conversations SET active_kb_ids = ?2, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![conversation_id, json],
        )?;

        if affected == 0 {
            // Tauri command errors are strings, so we can't return a typed error here
            // — just signal via rusqlite error which services wrap into String.
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    })
}
