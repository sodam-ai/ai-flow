use futures::StreamExt;
use once_cell::sync::Lazy;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;

use crate::models::conversation::Message;
use crate::models::provider::UsageStats;
use crate::services::cost;
use crate::services::provider_trait::SseParseResult;
use crate::services::providers;

/// Singleton HTTP client (PRD v4.1 §04: reqwest connection pool)
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .pool_max_idle_per_host(5)
        .pool_idle_timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .use_rustls_tls()
        .build()
        .expect("Failed to create HTTP client")
});

pub fn get_http_client() -> Client {
    HTTP_CLIENT.clone()
}

/// Stream AI chat response via SSE
///
/// Reads SSE chunks, parses per-provider format, and sends tokens
/// through the Tauri ipc::Channel for real-time UI updates.
pub async fn stream_chat(
    provider_id: &str,
    model_id: &str,
    api_key: &str,
    messages: &[Message],
    system_prompt: Option<&str>,
    channel: &tauri::ipc::Channel<serde_json::Value>,
    cancel_rx: oneshot::Receiver<()>,
) -> Result<(String, UsageStats), String> {
    let provider = providers::get_provider(provider_id)?;

    // Build request
    let mut endpoint = provider.chat_endpoint(model_id);
    let body = provider.build_request_body(messages, model_id, system_prompt);
    let auth_headers = provider.auth_headers(api_key);

    // Google: append API key as query param
    if provider_id == "google" {
        let separator = if endpoint.contains('?') { "&" } else { "?" };
        endpoint = format!("{}{}key={}", endpoint, separator, api_key);
    }

    // Build HTTP request
    let client = get_http_client();
    let mut req = client
        .post(&endpoint)
        .header("Content-Type", "application/json");

    for (name, value) in &auth_headers {
        req = req.header(name, value);
    }

    let response = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI_001: HTTP request failed: {}", e))?;

    // Check for API errors
    let status = response.status();
    if !status.is_success() {
        let error_body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "AI_002: API returned {}: {}",
            status.as_u16(),
            truncate_error(&error_body, 300)
        ));
    }

    // Stream SSE response
    let mut stream = response.bytes_stream();
    let mut usage = UsageStats::default();
    let mut full_content = String::new();
    let mut line_buffer = String::new();

    // Pin cancel_rx for select!
    tokio::pin!(cancel_rx);

    loop {
        tokio::select! {
            // Cancellation signal
            _ = &mut cancel_rx => {
                let _ = channel.send(serde_json::json!({
                    "type": "error",
                    "error": "Stream cancelled by user",
                }));
                // Calculate cost for partial response
                let partial_cost = cost::calc_cost(
                    provider_id, model_id,
                    usage.input_tokens, usage.output_tokens,
                );
                log::info!(
                    "Stream cancelled: {} tokens, ${:.6}",
                    usage.output_tokens, partial_cost
                );
                return Ok((full_content, usage));
            }
            // Next SSE chunk
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        line_buffer.push_str(&text);

                        // Process complete lines
                        while let Some(newline_pos) = line_buffer.find('\n') {
                            let line = line_buffer[..newline_pos].to_string();
                            line_buffer = line_buffer[newline_pos + 1..].to_string();

                            match provider.parse_sse_line(&line) {
                                SseParseResult::Token(token) => {
                                    full_content.push_str(&token.content);
                                    let _ = channel.send(serde_json::json!({
                                        "type": "token",
                                        "token": token.content,
                                    }));
                                }
                                SseParseResult::Usage { input_tokens, output_tokens } => {
                                    // Accumulate (Anthropic sends input/output separately)
                                    if input_tokens > 0 {
                                        usage.input_tokens = input_tokens;
                                    }
                                    if output_tokens > 0 {
                                        usage.output_tokens = output_tokens;
                                    }
                                }
                                SseParseResult::Done => {
                                    return Ok((full_content, usage));
                                }
                                SseParseResult::Skip => {}
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let _ = channel.send(serde_json::json!({
                            "type": "error",
                            "error": format!("Stream read error: {}", e),
                        }));
                        return Err(format!("AI_003: Stream error: {}", e));
                    }
                    None => {
                        // Stream ended without [DONE] — treat as complete
                        return Ok((full_content, usage));
                    }
                }
            }
        }
    }
}

/// Non-streaming AI call — returns (text, usage map) for workflow/batch use
pub async fn call_ai_non_stream(
    _http_client: &Arc<reqwest::Client>,
    provider_id: &str,
    model_id: &str,
    system_prompt: Option<&str>,
    messages: &[serde_json::Value],
) -> Result<(String, serde_json::Value), String> {
    let provider = providers::get_provider(provider_id)?;
    let api_key = crate::services::keychain::get_key_internal(provider_id)
        .map_err(|e| format!("API 키 없음 ({provider_id}): {e}"))?;

    // Convert JSON messages to Message vec
    let msgs: Vec<crate::models::conversation::Message> = messages
        .iter()
        .filter_map(|m| {
            let role = m.get("role")?.as_str()?.to_string();
            let content = m.get("content")?.as_str()?.to_string();
            Some(crate::models::conversation::Message {
                id: 0,
                conversation_id: 0,
                role,
                content,
                provider_id: None,
                model_id: None,
                tokens_in: 0,
                tokens_out: 0,
                cost_usd: 0.0,
                cost_krw: 0,
                comparison_group_id: None,
                is_selected_variant: false,
                created_at: String::new(),
            })
        })
        .collect();

    let mut endpoint = provider.chat_endpoint(model_id);
    let mut body = provider.build_request_body(&msgs, model_id, system_prompt);
    // Disable streaming for non-stream call
    if let Some(obj) = body.as_object_mut() {
        obj.insert("stream".to_string(), serde_json::json!(false));
    }
    let auth_headers = provider.auth_headers(&api_key);

    if provider_id == "google" {
        let separator = if endpoint.contains('?') { "&" } else { "?" };
        endpoint = format!("{}{}key={}", endpoint, separator, api_key);
    }

    let client = get_http_client();
    let mut req = client.post(&endpoint).header("Content-Type", "application/json");
    for (name, value) in &auth_headers {
        req = req.header(name, value);
    }

    let response = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("AI_001: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let err = response.text().await.unwrap_or_default();
        return Err(format!("AI_002: {status}: {}", truncate_error(&err, 300)));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| format!("AI_004: {e}"))?;

    let text = provider.extract_non_stream_text(&json).unwrap_or_default();
    let usage = json.get("usage").cloned().unwrap_or(serde_json::json!({}));

    Ok((text, usage))
}

/// Cost estimate helper for workflow/batch services
pub fn estimate_cost(provider_id: &str, model_id: &str, tokens_in: i32, tokens_out: i32) -> f64 {
    cost::calc_cost(provider_id, model_id, tokens_in as u32, tokens_out as u32)
}

fn truncate_error(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
