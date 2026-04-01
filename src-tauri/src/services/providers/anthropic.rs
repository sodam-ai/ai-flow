use async_trait::async_trait;
use crate::models::conversation::Message;
use crate::models::provider::{ModelInfo, StreamToken};
use crate::services::provider_trait::{AiProvider, SseParseResult};

pub struct AnthropicProvider;

/// Track current SSE event type for Anthropic's event+data pairs
/// Anthropic sends: event: <type>\ndata: <json>
/// We only care about content_block_delta and message_delta events
static ANTHROPIC_VERSION: &str = "2023-06-01";

#[async_trait]
impl AiProvider for AnthropicProvider {
    fn id(&self) -> &str {
        "anthropic"
    }

    fn auth_headers(&self, api_key: &str) -> Vec<(String, String)> {
        vec![
            ("x-api-key".to_string(), api_key.to_string()),
            ("anthropic-version".to_string(), ANTHROPIC_VERSION.to_string()),
        ]
    }

    fn chat_endpoint(&self, _model_id: &str) -> String {
        "https://api.anthropic.com/v1/messages".to_string()
    }

    fn build_request_body(
        &self,
        messages: &[Message],
        model_id: &str,
        system_prompt: Option<&str>,
    ) -> serde_json::Value {
        let msgs: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|msg| {
                serde_json::json!({
                    "role": msg.role,
                    "content": msg.content,
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": model_id,
            "messages": msgs,
            "max_tokens": 4096,
            "stream": true,
        });

        // Anthropic uses top-level "system" field, not a message
        if let Some(sys) = system_prompt {
            body["system"] = serde_json::json!(sys);
        }

        body
    }

    fn parse_sse_line(&self, line: &str) -> SseParseResult {
        let line = line.trim();

        if line.is_empty() || line.starts_with(':') {
            return SseParseResult::Skip;
        }

        // Skip event type lines — we parse data lines directly
        if line.starts_with("event: ") {
            return SseParseResult::Skip;
        }

        let data = match line.strip_prefix("data: ") {
            Some(d) => d.trim(),
            None => return SseParseResult::Skip,
        };

        let json: serde_json::Value = match serde_json::from_str(data) {
            Ok(v) => v,
            Err(_) => return SseParseResult::Skip,
        };

        let event_type = json.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            // Content token
            "content_block_delta" => {
                if let Some(text) = json
                    .get("delta")
                    .and_then(|d| d.get("text"))
                    .and_then(|t| t.as_str())
                {
                    if !text.is_empty() {
                        return SseParseResult::Token(StreamToken {
                            content: text.to_string(),
                            finish_reason: None,
                        });
                    }
                }
                SseParseResult::Skip
            }
            // Usage stats at message end
            "message_delta" => {
                let finish = json
                    .get("delta")
                    .and_then(|d| d.get("stop_reason"))
                    .and_then(|s| s.as_str());

                let output_tokens = json
                    .get("usage")
                    .and_then(|u| u.get("output_tokens"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);

                if finish == Some("end_turn") || finish == Some("stop_sequence") {
                    return SseParseResult::Usage {
                        input_tokens: 0, // Anthropic sends input in message_start
                        output_tokens,
                    };
                }
                SseParseResult::Skip
            }
            // Input usage from message_start
            "message_start" => {
                if let Some(input) = json
                    .get("message")
                    .and_then(|m| m.get("usage"))
                    .and_then(|u| u.get("input_tokens"))
                    .and_then(|v| v.as_i64())
                {
                    return SseParseResult::Usage {
                        input_tokens: input,
                        output_tokens: 0,
                    };
                }
                SseParseResult::Skip
            }
            "message_stop" => SseParseResult::Done,
            _ => SseParseResult::Skip,
        }
    }

    fn extract_non_stream_text(&self, json: &serde_json::Value) -> Option<String> {
        // Anthropic non-stream: { "content": [{ "type": "text", "text": "..." }] }
        json.get("content")?.get(0)?.get("text")?.as_str().map(|s| s.to_string())
    }

    fn model_catalog(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "claude-sonnet-4-5-20250514".to_string(),
                name: "Claude Sonnet 4.5".to_string(),
                provider_id: "anthropic".to_string(),
                input_price_per_m: 3.00,
                output_price_per_m: 15.00,
                max_context: 200_000,
            },
            ModelInfo {
                id: "claude-haiku-3-5-20241022".to_string(),
                name: "Claude Haiku 3.5".to_string(),
                provider_id: "anthropic".to_string(),
                input_price_per_m: 0.80,
                output_price_per_m: 4.00,
                max_context: 200_000,
            },
            ModelInfo {
                id: "claude-opus-4-6-20250624".to_string(),
                name: "Claude Opus 4.6".to_string(),
                provider_id: "anthropic".to_string(),
                input_price_per_m: 15.00,
                output_price_per_m: 75.00,
                max_context: 200_000,
            },
        ]
    }
}
