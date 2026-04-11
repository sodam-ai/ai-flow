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
    persona_id: Option<String>,
    kb_ids: Option<Vec<i64>>,      // Smart Context Injection: KB IDs to auto-search
    image_data: Option<String>,    // Phase 6: base64 PNG for Vision AI (screenshot)
    temperature: Option<f64>,      // Generation control: 0.0=precise, 1.0=balanced, 2.0=creative
    max_tokens: Option<u32>,       // Response length cap; None = provider default
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

    // Smart Context Injection — auto-search KB and prepend to system prompt
    let persona_system = persona_id.as_ref().and_then(|pid| {
        crate::services::persona::get_persona(&state.db, pid)
            .ok()
            .map(|p| p.system_prompt)
    });

    let injected_system: Option<String> = {
        let kb_context = if let Some(ids) = &kb_ids {
            if !ids.is_empty() {
                crate::services::knowledge_base::auto_kb_context(&state.db, &content, ids, 5)
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        if !kb_context.is_empty() {
            // KB context prepended before persona prompt (if any)
            let combined = match &persona_system {
                Some(p) => format!("{}\n\n{}", kb_context, p),
                None => kb_context,
            };
            Some(combined)
        } else {
            persona_system
        }
    };

    // Stream AI response (pass image_data for Vision AI if present)
    let result = crate::services::ai_client::stream_chat(
        &provider_id,
        &model_id,
        &api_key,
        &messages,
        injected_system.as_deref(),
        image_data.as_deref(),
        temperature,
        max_tokens,
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

    // Trim at word boundary (char-safe: collect to String first)
    let truncated: String = cleaned.chars().take(40).collect();
    match truncated.rfind(' ') {
        Some(pos) if pos > 20 => format!("{}...", &truncated[..pos]),
        _ => format!("{}...", truncated),
    }
}

/// Regenerate an AI response — saves current as version, streams new response
#[tauri::command]
pub async fn regenerate_ai_message(
    state: State<'_, AppState>,
    message_id: String,
    conversation_id: String,
    provider_id: String,
    model_id: String,
    stream_id: String,
    persona_id: Option<String>,
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<(), String> {
    // Save current message content as a version
    crate::services::chat::save_message_version(&state.db, &message_id)?;

    // Register stream for cancellation
    let cancel_rx = state.streams.register(&stream_id)?;

    // Get API key
    let api_key = crate::services::keychain::get_key_internal(&provider_id)?;

    // Load conversation messages (excluding the message being regenerated)
    let messages = crate::services::chat::get_messages(&state.db, &conversation_id, 50)?;
    let context_messages: Vec<_> = messages
        .into_iter()
        .filter(|m| m.id != message_id)
        .collect();

    // Get persona system prompt if set
    let system_prompt = persona_id.as_ref().and_then(|pid| {
        crate::services::persona::get_persona(&state.db, pid)
            .ok()
            .map(|p| p.system_prompt)
    });

    // Stream new AI response (regeneration — no image data, preserve original temperature)
    let result = crate::services::ai_client::stream_chat(
        &provider_id,
        &model_id,
        &api_key,
        &context_messages,
        system_prompt.as_deref(),
        None,
        None,  // temperature: use provider default on regeneration
        None,  // max_tokens: use provider default
        &channel,
        cancel_rx,
    )
    .await;

    drop(api_key);

    match result {
        Ok((full_content, usage)) => {
            let cost = crate::services::cost::calc_cost_full(
                &provider_id,
                &model_id,
                usage.input_tokens,
                usage.output_tokens,
                None,
            );

            // Update the message with new content (increments version_count)
            let new_version = crate::services::chat::update_message_for_regeneration(
                &state.db,
                &message_id,
                &full_content,
                Some(usage.input_tokens),
                Some(usage.output_tokens),
                Some(cost.usd),
            )?;

            crate::services::audit::log_event(
                &state.db,
                "ai_regenerated",
                "INFO",
                Some(&format!("msg={} version={}", &message_id[..8], new_version)),
            );

            let _ = channel.send(serde_json::json!({
                "type": "done",
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "costUsd": cost.usd,
                "costKrw": cost.krw,
                "exchangeRate": cost.exchange_rate,
                "newVersion": new_version,
            }));
        }
        Err(e) => {
            let _ = channel.send(serde_json::json!({
                "type": "error",
                "error": e,
            }));
        }
    }

    state.streams.remove(&stream_id);
    Ok(())
}

/// Edit a user message then stream a fresh AI response (no new user message saved)
#[tauri::command]
pub async fn edit_and_stream_message(
    state: State<'_, AppState>,
    message_id: String,
    conversation_id: String,
    new_content: String,
    provider_id: String,
    model_id: String,
    stream_id: String,
    persona_id: Option<String>,
    temperature: Option<f64>,
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<(), String> {
    // 1. Update user message content (role='user' guard in service)
    crate::services::chat::update_user_message_content(&state.db, &message_id, &new_content)?;

    // 2. Remove AI response(s) that followed the edited message
    crate::services::chat::truncate_messages_after(&state.db, &conversation_id, &message_id)?;

    // 3. Register stream for cancellation
    let cancel_rx = state.streams.register(&stream_id)?;

    // 4. Get API key (never sent to frontend)
    let api_key = crate::services::keychain::get_key_internal(&provider_id)?;

    // 5. Load updated conversation context
    let messages = crate::services::chat::get_messages(&state.db, &conversation_id, 50)?;

    // 6. Resolve persona system prompt
    let system_prompt = persona_id.as_ref().and_then(|pid| {
        crate::services::persona::get_persona(&state.db, pid)
            .ok()
            .map(|p| p.system_prompt)
    });

    crate::services::audit::log_event(
        &state.db,
        "ai_edit_stream_started",
        "INFO",
        Some(&format!("{}:{}", provider_id, model_id)),
    );

    // 7. Stream AI response
    let result = crate::services::ai_client::stream_chat(
        &provider_id,
        &model_id,
        &api_key,
        &messages,
        system_prompt.as_deref(),
        None,
        temperature,
        None,
        &channel,
        cancel_rx,
    )
    .await;

    drop(api_key);

    match result {
        Ok((full_content, usage)) => {
            let cost = crate::services::cost::calc_cost_full(
                &provider_id,
                &model_id,
                usage.input_tokens,
                usage.output_tokens,
                None,
            );

            crate::services::chat::save_message(
                &state.db,
                &conversation_id,
                "assistant",
                &full_content,
                Some(usage.input_tokens),
                Some(usage.output_tokens),
                Some(cost.usd),
            )?;

            crate::services::audit::log_event(
                &state.db,
                "ai_edit_stream_completed",
                "INFO",
                Some(&format!(
                    "{}:{} in={} out={} cost=${:.6}",
                    provider_id, model_id, usage.input_tokens, usage.output_tokens, cost.usd
                )),
            );

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
            let _ = channel.send(serde_json::json!({
                "type": "error",
                "error": e,
            }));
        }
    }

    state.streams.remove(&stream_id);
    Ok(())
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
