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
            // Calculate cost
            let cost_usd = crate::services::cost::calc_cost(
                &provider_id,
                &model_id,
                usage.input_tokens,
                usage.output_tokens,
            );

            // Save assistant message with usage stats
            let _assistant_msg = crate::services::chat::save_message(
                &state.db,
                &conversation_id,
                "assistant",
                &full_content,
                Some(usage.input_tokens),
                Some(usage.output_tokens),
                Some(cost_usd),
            )?;

            // Send completion event
            let _ = channel.send(serde_json::json!({
                "type": "done",
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "costUsd": cost_usd,
            }));
        }
        Err(e) => {
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
