use crate::AppState;
use tauri::State;

/// Stream AI response via ipc::Channel (PRD: NEVER use EventSystem)
#[tauri::command]
pub async fn stream_ai_message(
    state: State<'_, AppState>,
    conversation_id: String,
    content: String,
    provider_id: String,
    model_id: String,
    stream_id: String,
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<(), String> {
    // Register stream for cancellation
    let cancel_rx = state.streams.register(&stream_id)?;

    // Save user message
    let _user_msg = crate::services::chat::save_message(
        &state.db, &conversation_id, "user", &content, None, None, None,
    )?;

    // Get API key from keychain (internal only, never sent to frontend)
    let api_key = crate::services::keychain::get_key_internal(&provider_id)?;

    // Audit: stream started
    crate::services::audit::log_event(
        &state.db,
        "ai_stream_started",
        "INFO",
        Some(&format!("{}:{}", provider_id, model_id)),
    );

    // Load conversation messages for context
    let messages = crate::services::chat::get_messages(&state.db, &conversation_id, 50)?;

    // Stream AI response
    let result = crate::services::ai_client::stream_chat(
        &provider_id,
        &model_id,
        &api_key,
        &messages,
        None, // TODO: persona system prompt (Phase 1b)
        &channel,
        cancel_rx,
    )
    .await;

    // Zeroize API key reference
    drop(api_key);

    match result {
        Ok((full_content, usage)) => {
            // Calculate cost with KRW (PRD: USD + KRW dual display)
            let cost = crate::services::cost::calc_cost_full(
                &provider_id,
                &model_id,
                usage.input_tokens,
                usage.output_tokens,
                None, // TODO: cached exchange rate from API
            );

            // Save assistant message with usage stats
            let _assistant_msg = crate::services::chat::save_message(
                &state.db,
                &conversation_id,
                "assistant",
                &full_content,
                Some(usage.input_tokens),
                Some(usage.output_tokens),
                Some(cost.usd),
            )?;

            // Auto-generate conversation title from first user message
            auto_title_if_needed(&state.db, &conversation_id, &content);

            // Audit: stream completed
            crate::services::audit::log_event(
                &state.db,
                "ai_stream_completed",
                "INFO",
                Some(&format!(
                    "{}:{} in={} out={} cost=${:.6}",
                    provider_id, model_id, usage.input_tokens, usage.output_tokens, cost.usd
                )),
            );

            // Send completion event with dual currency
            let _ = channel.send(serde_json::json!({
                "type": "done",
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "costUsd": cost.usd,
                "costKrw": cost.krw,
                "exchangeRate": cost.exchange_rate,
            }));
        }
        Err(e) => {
            // Audit: stream failed
            crate::services::audit::log_event(
                &state.db,
                "ai_stream_failed",
                "ERROR",
                Some(&format!("{}:{} error={}", provider_id, model_id, &e[..e.len().min(200)])),
            );

            let _ = channel.send(serde_json::json!({
                "type": "error",
                "error": e,
            }));
        }
    }

    // Clean up stream registry
    state.streams.remove(&stream_id);

    Ok(())
}

/// Cancel an active AI stream
#[tauri::command]
pub async fn cancel_stream(
    state: State<'_, AppState>,
    stream_id: String,
) -> Result<(), String> {
    state.streams.cancel(&stream_id);
    Ok(())
}

/// Auto-generate conversation title from first user message
/// Only updates if current title is "New Chat" (default)
fn auto_title_if_needed(
    db: &crate::db::pool::Database,
    conversation_id: &str,
    user_message: &str,
) {
    // Check if title is still default
    let is_default = db
        .read(|conn| {
            let title: String = conn.query_row(
                "SELECT title FROM conversations WHERE id = ?1",
                rusqlite::params![conversation_id],
                |row| row.get(0),
            )?;
            Ok(title == "New Chat")
        })
        .unwrap_or(false);

    if !is_default {
        return;
    }

    // Generate title: first 40 chars of user message, trimmed at word boundary
    let title = generate_title(user_message);

    let _ = db.write(|conn| {
        conn.execute(
            "UPDATE conversations SET title = ?1 WHERE id = ?2 AND title = 'New Chat'",
            rusqlite::params![title, conversation_id],
        )?;
        Ok(())
    });
}

fn generate_title(message: &str) -> String {
    let cleaned = message
        .lines()
        .next()
        .unwrap_or(message)
        .trim();

    if cleaned.len() <= 40 {
        return cleaned.to_string();
    }

    // Trim at word boundary
    let truncated = &cleaned[..40];
    match truncated.rfind(' ') {
        Some(pos) if pos > 20 => format!("{}...", &truncated[..pos]),
        _ => format!("{}...", truncated),
    }
}

/// Get model catalog for a specific provider (or all providers)
#[tauri::command]
pub async fn get_model_catalog(
    provider_id: Option<String>,
) -> Result<Vec<crate::models::provider::ModelInfo>, String> {
    use crate::services::providers;

    let provider_ids: Vec<&str> = match &provider_id {
        Some(id) => vec![id.as_str()],
        None => vec!["openai", "anthropic", "google"],
    };

    let mut all_models = Vec::new();
    for pid in provider_ids {
        if let Ok(provider) = providers::get_provider(pid) {
            all_models.extend(provider.model_catalog());
        }
    }

    Ok(all_models)
}
