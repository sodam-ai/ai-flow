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

    // TODO: Implement actual AI API streaming with Provider Trait
    // For now, send a placeholder response
    let _ = channel.send(serde_json::json!({
        "type": "token",
        "token": "AI streaming will be implemented next. Provider: "
    }));
    let _ = channel.send(serde_json::json!({
        "type": "token",
        "token": &provider_id
    }));
    let _ = channel.send(serde_json::json!({
        "type": "done",
        "inputTokens": 10,
        "outputTokens": 8,
        "costUsd": 0.0001
    }));

    // Clean up
    drop(api_key);
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
