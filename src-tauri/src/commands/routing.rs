use crate::AppState;
use crate::models::routing::RoutingSuggestion;
use tauri::State;

/// Get smart routing suggestion for a prompt
#[tauri::command]
pub async fn get_routing_suggestion(
    state: State<'_, AppState>,
    prompt: String,
    has_file: bool,
    has_code: bool,
) -> Result<RoutingSuggestion, String> {
    crate::services::routing::suggest_route(&state.db, &prompt, has_file, has_code)
}

/// Get all routing rules
#[tauri::command]
pub async fn get_routing_rules(
    state: State<'_, AppState>,
) -> Result<Vec<crate::models::routing::RoutingRule>, String> {
    crate::services::routing::get_rules(&state.db)
}

/// Stream AI with smart routing (auto-selects best AI + fallback chain)
#[tauri::command]
pub async fn stream_routed_message(
    state: State<'_, AppState>,
    conversation_id: String,
    content: String,
    stream_id: String,
    has_file: bool,
    has_code: bool,
    persona_id: Option<String>,
    kb_ids: Option<Vec<i64>>, // Smart Context Injection: KB IDs to auto-search
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Get routing suggestion
    let suggestion = crate::services::routing::suggest_route(
        &state.db, &content, has_file, has_code,
    )?;

    // Notify frontend which AI was selected and why
    let _ = channel.send(serde_json::json!({
        "type": "routing_info",
        "complexityScore": suggestion.complexity_score,
        "complexityLabel": suggestion.complexity_label,
        "selectedProvider": suggestion.suggested_provider_id,
        "selectedModel": suggestion.suggested_model_id,
        "selectedModelName": suggestion.suggested_model_name,
        "potentialSavings": suggestion.potential_savings_usd,
    }));

    // Try main provider, then fallback chain
    let mut providers_to_try = vec![
        (suggestion.suggested_provider_id.clone(), suggestion.suggested_model_id.clone()),
    ];
    for fb in &suggestion.fallback_chain {
        providers_to_try.push((fb.provider_id.clone(), fb.model_id.clone()));
    }

    // Save user message
    let _user_msg = crate::services::chat::save_message(
        &state.db, &conversation_id, "user", &content, None, None, None,
    )?;

    let messages = crate::services::chat::get_messages(&state.db, &conversation_id, 50)?;
    let persona_system = persona_id.as_ref().and_then(|pid| {
        crate::services::persona::get_persona(&state.db, pid)
            .ok()
            .map(|p| p.system_prompt)
    });

    // Smart Context Injection — same pattern as stream_ai_message
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
            let combined = match &persona_system {
                Some(p) => format!("{}\n\n{}", kb_context, p),
                None => kb_context,
            };
            Some(combined)
        } else {
            persona_system
        }
    };
    let system_prompt = injected_system;

    let cancel_rx = state.streams.register(&stream_id)?;

    // We only have one cancel_rx, so we can only try the first provider with cancellation.
    // For fallbacks, we create new attempts without cancellation support.
    let result = crate::services::ai_client::stream_chat(
        &providers_to_try[0].0,
        &providers_to_try[0].1,
        &crate::services::keychain::get_key_internal(&providers_to_try[0].0)?,
        &messages,
        system_prompt.as_deref(),
        None,
        &channel,
        cancel_rx,
    ).await;

    match result {
        Ok((full_content, usage)) => {
            let cost = crate::services::cost::calc_cost_full(
                &providers_to_try[0].0,
                &providers_to_try[0].1,
                usage.input_tokens,
                usage.output_tokens,
                None,
            );

            let _assistant_msg = crate::services::chat::save_message(
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
                "routed_stream_completed",
                "INFO",
                Some(&format!(
                    "{}:{} complexity={} cost=${:.6} savings=${:.6}",
                    providers_to_try[0].0, providers_to_try[0].1,
                    suggestion.complexity_score, cost.usd, suggestion.potential_savings_usd
                )),
            );

            let _ = channel.send(serde_json::json!({
                "type": "done",
                "inputTokens": usage.input_tokens,
                "outputTokens": usage.output_tokens,
                "costUsd": cost.usd,
                "costKrw": cost.krw,
                "complexityScore": suggestion.complexity_score,
                "costSavedUsd": suggestion.potential_savings_usd,
            }));

            state.streams.remove(&stream_id);

            Ok(serde_json::json!({
                "provider": providers_to_try[0].0,
                "model": providers_to_try[0].1,
                "complexityScore": suggestion.complexity_score,
                "costSavedUsd": suggestion.potential_savings_usd,
            }))
        }
        Err(e) => {
            // Try fallback providers
            let last_error = e.clone();
            let mut attempt = 0;
            let _ = channel.send(serde_json::json!({
                "type": "fallback_triggered",
                "failedProvider": providers_to_try[0].0,
                "error": &e,
            }));

            for (fb_provider, fb_model) in providers_to_try.iter().skip(1) {
                attempt += 1;
                let _ = channel.send(serde_json::json!({
                    "type": "fallback_attempt",
                    "attempt": attempt,
                    "provider": fb_provider,
                    "model": fb_model,
                }));

                let api_key = match crate::services::keychain::get_key_internal(fb_provider) {
                    Ok(k) => k,
                    Err(_) => continue, // No key for this fallback, skip
                };

                let (_, cancel_rx_fb) = tokio::sync::oneshot::channel::<()>();
                let fb_result = crate::services::ai_client::stream_chat(
                    fb_provider, fb_model, &api_key, &messages,
                    system_prompt.as_deref(), None, &channel, cancel_rx_fb,
                ).await;

                if let Ok((content, usage)) = fb_result {
                    let cost = crate::services::cost::calc_cost_full(
                        fb_provider, fb_model,
                        usage.input_tokens, usage.output_tokens, None,
                    );

                    let _ = crate::services::chat::save_message(
                        &state.db, &conversation_id, "assistant",
                        &content, Some(usage.input_tokens), Some(usage.output_tokens), Some(cost.usd),
                    );

                    let _ = channel.send(serde_json::json!({
                        "type": "done",
                        "inputTokens": usage.input_tokens,
                        "outputTokens": usage.output_tokens,
                        "costUsd": cost.usd,
                        "costKrw": cost.krw,
                        "fallbackUsed": true,
                        "originalProvider": providers_to_try[0].0,
                        "actualProvider": fb_provider,
                    }));

                    state.streams.remove(&stream_id);
                    return Ok(serde_json::json!({
                        "provider": fb_provider,
                        "model": fb_model,
                        "fallbackUsed": true,
                    }));
                }
            }

            state.streams.remove(&stream_id);
            Err(format!("ROUTING_002: All providers failed. Last error: {}", last_error))
        }
    }
}
