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
/// Inject a base64 PNG image into the last user message of an already-built
/// request body.  Each AI provider uses a different multimodal content schema:
///
/// - OpenAI / compatible: `content` → `[{type:"text",...},{type:"image_url",...}]`
/// - Anthropic:           `content` → `[{type:"image", source:{type:"base64",...}}, {type:"text",...}]`
/// - Google Gemini:       appends `{inline_data:{mime_type,data}}` to the last user `parts`
/// - Others:              no-op (vision not supported)
fn inject_image_into_last_user_message(
    body: &mut serde_json::Value,
    provider_id: &str,
    image_b64: &str,
) {
    match provider_id {
        "openai" | "openai_compatible" | "azure_openai" | "groq" | "xai"
        | "mistral" | "deepseek" | "cohere" => {
            if let Some(msgs) = body.get_mut("messages").and_then(|m| m.as_array_mut()) {
                if let Some(last_user) = msgs.iter_mut().rev().find(|m| {
                    m.get("role").and_then(|r| r.as_str()) == Some("user")
                }) {
                    let text = last_user["content"].as_str().unwrap_or("").to_string();
                    last_user["content"] = serde_json::json!([
                        { "type": "text", "text": text },
                        { "type": "image_url", "image_url": {
                            "url": format!("data:image/png;base64,{image_b64}")
                        }}
                    ]);
                }
            }
        }
        "anthropic" => {
            if let Some(msgs) = body.get_mut("messages").and_then(|m| m.as_array_mut()) {
                if let Some(last_user) = msgs.iter_mut().rev().find(|m| {
                    m.get("role").and_then(|r| r.as_str()) == Some("user")
                }) {
                    let text = last_user["content"].as_str().unwrap_or("").to_string();
                    last_user["content"] = serde_json::json!([
                        { "type": "image", "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64
                        }},
                        { "type": "text", "text": text }
                    ]);
                }
            }
        }
        "google" => {
            if let Some(contents) = body.get_mut("contents").and_then(|c| c.as_array_mut()) {
                if let Some(last_user) = contents.iter_mut().rev().find(|m| {
                    m.get("role").and_then(|r| r.as_str()) == Some("user")
                }) {
                    if let Some(parts) = last_user.get_mut("parts").and_then(|p| p.as_array_mut()) {
                        parts.push(serde_json::json!({
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_b64
                            }
                        }));
                    }
                }
            }
        }
        _ => {} // Ollama — vision support varies by model, skip
    }
}

pub async fn stream_chat(
    provider_id: &str,
    model_id: &str,
    api_key: &str,
    messages: &[Message],
    system_prompt: Option<&str>,
    image_data: Option<&str>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    channel: &tauri::ipc::Channel<serde_json::Value>,
    cancel_rx: oneshot::Receiver<()>,
) -> Result<(String, UsageStats), String> {
    let provider = providers::get_provider(provider_id)?;

    // Build request
    let endpoint = provider.chat_endpoint(model_id);
    let mut body = provider.build_request_body(messages, model_id, system_prompt, temperature, max_tokens);

    // Vision: inject screenshot into last user message
    if let Some(img_b64) = image_data {
        inject_image_into_last_user_message(&mut body, provider_id, img_b64);
    }

    let auth_headers = provider.auth_headers(api_key);

    // Build HTTP request
    let client = get_http_client();
    let mut req = client
        .post(&endpoint)
        .header("Content-Type", "application/json");

    for (name, value) in &auth_headers {
        req = req.header(name, value);
    }

    // Google: use header instead of query param (key in URL appears in server logs)
    if provider_id == "google" {
        req = req.header("x-goog-api-key", api_key);
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
                id: String::new(),
                conversation_id: String::new(),
                role,
                content,
                input_tokens: None,
                output_tokens: None,
                cost_usd: None,
                created_at: String::new(),
                version_count: 1,
                active_version: 1,
                comparison_group_id: None,
                routed_by: None,
                complexity_score: None,
                cost_saved_usd: None,
            })
        })
        .collect();

    let endpoint = provider.chat_endpoint(model_id);
    let mut body = provider.build_request_body(&msgs, model_id, system_prompt, None, None);
    // Disable streaming for non-stream call
    if let Some(obj) = body.as_object_mut() {
        obj.insert("stream".to_string(), serde_json::json!(false));
    }
    let auth_headers = provider.auth_headers(&api_key);

    let client = get_http_client();
    let mut req = client.post(&endpoint).header("Content-Type", "application/json");
    for (name, value) in &auth_headers {
        req = req.header(name, value);
    }

    // Google: use header instead of query param
    if provider_id == "google" {
        req = req.header("x-goog-api-key", &api_key as &str);
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
    cost::calc_cost(provider_id, model_id, tokens_in as i64, tokens_out as i64)
}

fn truncate_error(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        // Use char boundary to avoid panic on multibyte chars (e.g. Korean)
        let idx = s.char_indices().nth(max_len).map(|(i, _)| i).unwrap_or(s.len());
        format!("{}...", &s[..idx])
    }
}
