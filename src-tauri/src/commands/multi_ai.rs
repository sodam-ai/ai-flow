use crate::AppState;
use crate::models::routing::StreamTarget;
use tauri::State;

/// Stream 2~3 AI models simultaneously for side-by-side comparison
#[tauri::command]
pub async fn stream_multi_ai(
    state: State<'_, AppState>,
    conversation_id: String,
    content: String,
    targets: Vec<StreamTarget>,
    persona_id: Option<String>,
    temperature: Option<f64>,
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Validate target count
    if targets.len() < 2 || targets.len() > 3 {
        return Err("MULTI_001: Must select 2~3 AI models for comparison".into());
    }

    // Save user message
    let user_msg = crate::services::chat::save_message(
        &state.db, &conversation_id, "user", &content, None, None, None,
    )?;

    // Audit
    let target_str: Vec<String> = targets.iter()
        .map(|t| format!("{}:{}", t.provider_id, t.model_id))
        .collect();
    crate::services::audit::log_event(
        &state.db,
        "multi_stream_started",
        "INFO",
        Some(&format!("targets=[{}]", target_str.join(", "))),
    );

    // Load conversation context
    let messages = crate::services::chat::get_messages(&state.db, &conversation_id, 50)?;

    // Get persona system prompt
    let system_prompt = persona_id.as_ref().and_then(|pid| {
        crate::services::persona::get_persona(&state.db, pid)
            .ok()
            .map(|p| p.system_prompt)
    });

    // Create cancel receivers for each stream
    let mut cancel_rxs = Vec::new();
    let stream_ids: Vec<String> = targets.iter().enumerate()
        .map(|(i, _)| format!("multi_{}_{}", conversation_id.chars().take(8).collect::<String>(), i))
        .collect();

    for sid in &stream_ids {
        let rx = state.streams.register(sid)?;
        cancel_rxs.push(rx);
    }

    // Stream all simultaneously
    let results = crate::services::multi_stream::stream_multi(
        &targets,
        &messages,
        system_prompt.as_deref(),
        temperature,
        &channel,
        cancel_rxs,
    )
    .await;

    // Save comparison group
    let group_id = crate::services::multi_stream::save_comparison_group(
        &state.db,
        &conversation_id,
        &user_msg.id,
        &results,
    )?;

    // Clean up stream registrations
    for sid in &stream_ids {
        state.streams.remove(sid);
    }

    // Audit completion
    let total_cost: f64 = results.iter().map(|r| r.cost_usd).sum();
    crate::services::audit::log_event(
        &state.db,
        "multi_stream_completed",
        "INFO",
        Some(&format!("group={} streams={} cost=${:.6}", group_id.get(..8).unwrap_or(&group_id), results.len(), total_cost)),
    );

    Ok(serde_json::json!({
        "groupId": group_id,
        "userMessageId": user_msg.id,
        "streamCount": results.len(),
    }))
}

/// Adopt a specific response from a comparison group
#[tauri::command]
pub async fn adopt_comparison(
    state: State<'_, AppState>,
    group_id: String,
    message_id: String,
) -> Result<(), String> {
    crate::services::multi_stream::adopt_comparison_message(
        &state.db, &group_id, &message_id,
    )?;

    crate::services::audit::log_event(
        &state.db,
        "comparison_adopted",
        "INFO",
        Some(&format!("group={} msg={}", &group_id[..8], &message_id[..8])),
    );

    Ok(())
}
