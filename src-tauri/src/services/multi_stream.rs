use std::sync::Arc;
use futures::StreamExt;
use tokio::sync::oneshot;

use crate::db::pool::Database;
use crate::models::conversation::Message;
use crate::models::provider::UsageStats;
use crate::models::routing::StreamTarget;
use crate::services::{cost, keychain, providers};
use crate::services::provider_trait::SseParseResult;

/// Result from a single stream in a multi-stream comparison
#[derive(Debug)]
pub struct StreamResult {
    pub stream_index: usize,
    pub provider_id: String,
    pub model_id: String,
    pub content: String,
    pub usage: UsageStats,
    pub cost_usd: f64,
    pub cost_krw: f64,
    pub error: Option<String>,
}

/// Stream multiple AI providers simultaneously for side-by-side comparison.
///
/// Each provider streams independently via tokio::spawn. All tokens are
/// relayed through a single ipc::Channel with `streamIndex` to identify
/// which column the token belongs to in the UI.
pub async fn stream_multi(
    targets: &[StreamTarget],
    messages: &[Message],
    system_prompt: Option<&str>,
    channel: &tauri::ipc::Channel<serde_json::Value>,
    cancel_rxs: Vec<oneshot::Receiver<()>>,
) -> Vec<StreamResult> {
    if targets.len() < 2 || targets.len() > 3 {
        let _ = channel.send(serde_json::json!({
            "type": "error",
            "error": "MULTI_001: Must select 2~3 AI models for comparison",
        }));
        return vec![];
    }

    // Notify frontend: multi-stream starting
    let _ = channel.send(serde_json::json!({
        "type": "multi_start",
        "count": targets.len(),
        "targets": targets.iter().enumerate().map(|(i, t)| {
            serde_json::json!({
                "streamIndex": i,
                "providerId": t.provider_id,
                "modelId": t.model_id,
            })
        }).collect::<Vec<_>>(),
    }));

    let messages_arc = Arc::new(messages.to_vec());
    let sys_prompt = system_prompt.map(|s| s.to_string());

    // Spawn parallel streams — each stream sends tokens with its streamIndex
    let mut handles = Vec::new();

    for (idx, (target, cancel_rx)) in targets.iter().zip(cancel_rxs).enumerate() {
        let provider_id = target.provider_id.clone();
        let model_id = target.model_id.clone();
        let msgs = Arc::clone(&messages_arc);
        let sp = sys_prompt.clone();
        let ch = channel.clone();

        handles.push(tokio::spawn(async move {
            stream_single_indexed(idx, &provider_id, &model_id, &msgs, sp.as_deref(), &ch, cancel_rx).await
        }));
    }

    // Collect results
    let mut results = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(result) => results.push(result),
            Err(e) => log::error!("Stream task panicked: {}", e),
        }
    }

    // Final multi_done event
    let total_cost_usd: f64 = results.iter().map(|r| r.cost_usd).sum();
    let total_cost_krw: f64 = results.iter().map(|r| r.cost_krw).sum();
    let _ = channel.send(serde_json::json!({
        "type": "multi_done",
        "totalCostUsd": total_cost_usd,
        "totalCostKrw": total_cost_krw,
        "streamCount": results.len(),
    }));

    results
}

/// Stream a single AI with indexed events (streamIndex in every token).
/// This is a self-contained SSE stream that directly uses the provider trait,
/// bypassing ai_client::stream_chat to add streamIndex to each token event.
async fn stream_single_indexed(
    idx: usize,
    provider_id: &str,
    model_id: &str,
    messages: &[Message],
    system_prompt: Option<&str>,
    channel: &tauri::ipc::Channel<serde_json::Value>,
    cancel_rx: oneshot::Receiver<()>,
) -> StreamResult {
    // Get API key
    let api_key = match keychain::get_key_internal(provider_id) {
        Ok(key) => key,
        Err(e) => {
            let _ = channel.send(serde_json::json!({
                "type": "stream_error", "streamIndex": idx,
                "error": format!("API key not found for {}: {}", provider_id, e),
            }));
            return make_error_result(idx, provider_id, model_id, e);
        }
    };

    // Get provider
    let provider = match providers::get_provider(provider_id) {
        Ok(p) => p,
        Err(e) => {
            let _ = channel.send(serde_json::json!({
                "type": "stream_error", "streamIndex": idx, "error": &e,
            }));
            return make_error_result(idx, provider_id, model_id, e);
        }
    };

    // Build request
    let mut endpoint = provider.chat_endpoint(model_id);
    let body = provider.build_request_body(messages, model_id, system_prompt);
    let auth_headers = provider.auth_headers(&api_key);

    if provider_id == "google" {
        let sep = if endpoint.contains('?') { "&" } else { "?" };
        endpoint = format!("{}{}key={}", endpoint, sep, api_key);
    }

    let client = crate::services::ai_client::get_http_client();
    let mut req = client.post(&endpoint).header("Content-Type", "application/json");
    for (name, value) in &auth_headers {
        req = req.header(name, value);
    }

    let response = match req.json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            let err = format!("AI_001: HTTP request failed: {}", e);
            let _ = channel.send(serde_json::json!({
                "type": "stream_error", "streamIndex": idx, "error": &err,
            }));
            return make_error_result(idx, provider_id, model_id, err);
        }
    };

    let status = response.status();
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        let err = format!("AI_002: {} returned {}: {}", provider_id, status.as_u16(),
            &error_body[..error_body.len().min(300)]);
        let _ = channel.send(serde_json::json!({
            "type": "stream_error", "streamIndex": idx, "error": &err,
        }));
        return make_error_result(idx, provider_id, model_id, err);
    }

    // Stream SSE with indexed tokens
    let mut stream = response.bytes_stream();
    let mut usage = UsageStats::default();
    let mut full_content = String::new();
    let mut line_buffer = String::new();

    tokio::pin!(cancel_rx);

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                let _ = channel.send(serde_json::json!({
                    "type": "stream_cancelled", "streamIndex": idx,
                }));
                break;
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        line_buffer.push_str(&text);

                        while let Some(pos) = line_buffer.find('\n') {
                            let line = line_buffer[..pos].to_string();
                            line_buffer = line_buffer[pos + 1..].to_string();

                            match provider.parse_sse_line(&line) {
                                SseParseResult::Token(token) => {
                                    full_content.push_str(&token.content);
                                    // KEY: streamIndex in every token
                                    let _ = channel.send(serde_json::json!({
                                        "type": "token",
                                        "streamIndex": idx,
                                        "token": token.content,
                                    }));
                                }
                                SseParseResult::Usage { input_tokens, output_tokens } => {
                                    if input_tokens > 0 { usage.input_tokens = input_tokens; }
                                    if output_tokens > 0 { usage.output_tokens = output_tokens; }
                                }
                                SseParseResult::Done => {
                                    let cost_result = cost::calc_cost_full(
                                        provider_id, model_id,
                                        usage.input_tokens, usage.output_tokens, None,
                                    );
                                    let _ = channel.send(serde_json::json!({
                                        "type": "stream_done",
                                        "streamIndex": idx,
                                        "providerId": provider_id,
                                        "modelId": model_id,
                                        "inputTokens": usage.input_tokens,
                                        "outputTokens": usage.output_tokens,
                                        "costUsd": cost_result.usd,
                                        "costKrw": cost_result.krw,
                                    }));
                                    return StreamResult {
                                        stream_index: idx,
                                        provider_id: provider_id.to_string(),
                                        model_id: model_id.to_string(),
                                        content: full_content,
                                        usage,
                                        cost_usd: cost_result.usd,
                                        cost_krw: cost_result.krw,
                                        error: None,
                                    };
                                }
                                SseParseResult::Skip => {}
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let err = format!("AI_003: Stream error: {}", e);
                        let _ = channel.send(serde_json::json!({
                            "type": "stream_error", "streamIndex": idx, "error": &err,
                        }));
                        return make_error_result(idx, provider_id, model_id, err);
                    }
                    None => break, // Stream ended without [DONE]
                }
            }
        }
    }

    // Stream ended (cancelled or no [DONE])
    let cost_result = cost::calc_cost_full(
        provider_id, model_id,
        usage.input_tokens, usage.output_tokens, None,
    );

    StreamResult {
        stream_index: idx,
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        content: full_content,
        usage,
        cost_usd: cost_result.usd,
        cost_krw: cost_result.krw,
        error: None,
    }
}

fn make_error_result(idx: usize, provider_id: &str, model_id: &str, error: String) -> StreamResult {
    StreamResult {
        stream_index: idx,
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        content: String::new(),
        usage: UsageStats::default(),
        cost_usd: 0.0,
        cost_krw: 0.0,
        error: Some(error),
    }
}

/// Save comparison group and member messages to DB
pub fn save_comparison_group(
    db: &Database,
    conversation_id: &str,
    user_message_id: &str,
    results: &[StreamResult],
) -> Result<String, String> {
    let group_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.write(|conn| {
        conn.execute(
            "INSERT INTO comparison_groups (id, conversation_id, user_message_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![group_id, conversation_id, user_message_id, now],
        )?;

        for result in results {
            if result.error.is_some() { continue; }

            let msg_id = uuid::Uuid::new_v4().to_string();
            let member_id = uuid::Uuid::new_v4().to_string();

            conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, comparison_group_id, created_at)
                 VALUES (?1, ?2, 'assistant', ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    msg_id, conversation_id, result.content,
                    result.usage.input_tokens, result.usage.output_tokens,
                    result.cost_usd, group_id, now
                ],
            )?;

            conn.execute(
                "INSERT INTO comparison_members (id, group_id, message_id, provider_id, model_id, stream_index, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    member_id, group_id, msg_id,
                    result.provider_id, result.model_id,
                    result.stream_index as i32, now
                ],
            )?;

            conn.execute(
                "UPDATE conversations SET message_count = message_count + 1,
                 total_cost_usd = total_cost_usd + ?2, updated_at = ?3
                 WHERE id = ?1",
                rusqlite::params![conversation_id, result.cost_usd, now],
            )?;
        }

        Ok(())
    })?;

    Ok(group_id)
}

/// Adopt a specific message from a comparison group
pub fn adopt_comparison_message(
    db: &Database,
    group_id: &str,
    message_id: &str,
) -> Result<(), String> {
    db.write(|conn| {
        conn.execute(
            "UPDATE comparison_groups SET adopted_message_id = ?2 WHERE id = ?1",
            rusqlite::params![group_id, message_id],
        )?;
        conn.execute(
            "UPDATE comparison_members SET is_adopted = 0 WHERE group_id = ?1",
            rusqlite::params![group_id],
        )?;
        conn.execute(
            "UPDATE comparison_members SET is_adopted = 1 WHERE group_id = ?1 AND message_id = ?2",
            rusqlite::params![group_id, message_id],
        )?;
        Ok(())
    })
}
