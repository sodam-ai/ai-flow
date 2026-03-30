use async_trait::async_trait;
use crate::models::conversation::Message;
use crate::models::provider::{ModelInfo, StreamToken};
use crate::services::provider_trait::{AiProvider, SseParseResult};

pub struct OpenAiProvider;

#[async_trait]
impl AiProvider for OpenAiProvider {
    fn id(&self) -> &str {
        "openai"
    }

    fn auth_headers(&self, api_key: &str) -> Vec<(String, String)> {
        vec![("Authorization".to_string(), format!("Bearer {}", api_key))]
    }

    fn chat_endpoint(&self, _model_id: &str) -> String {
        "https://api.openai.com/v1/chat/completions".to_string()
    }

    fn build_request_body(
        &self,
        messages: &[Message],
        model_id: &str,
        system_prompt: Option<&str>,
    ) -> serde_json::Value {
        let mut msgs = Vec::new();

        if let Some(sys) = system_prompt {
            msgs.push(serde_json::json!({ "role": "system", "content": sys }));
        }

        for msg in messages {
            msgs.push(serde_json::json!({
                "role": msg.role,
                "content": msg.content,
            }));
        }

        serde_json::json!({
            "model": model_id,
            "messages": msgs,
            "stream": true,
            "stream_options": { "include_usage": true },
        })
    }

    fn parse_sse_line(&self, line: &str) -> SseParseResult {
        let line = line.trim();

        if line.is_empty() || line.starts_with(':') {
            return SseParseResult::Skip;
        }

        let data = match line.strip_prefix("data: ") {
            Some(d) => d.trim(),
            None => return SseParseResult::Skip,
        };

        if data == "[DONE]" {
            return SseParseResult::Done;
        }

        let json: serde_json::Value = match serde_json::from_str(data) {
            Ok(v) => v,
            Err(_) => return SseParseResult::Skip,
        };

        // Usage stats (sent in final chunk with stream_options.include_usage)
        if let Some(usage) = json.get("usage") {
            if let (Some(inp), Some(out)) = (
                usage.get("prompt_tokens").and_then(|v| v.as_i64()),
                usage.get("completion_tokens").and_then(|v| v.as_i64()),
            ) {
                return SseParseResult::Usage {
                    input_tokens: inp,
                    output_tokens: out,
                };
            }
        }

        // Content delta
        if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
            if let Some(choice) = choices.first() {
                let finish = choice
                    .get("finish_reason")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                if let Some(content) = choice
                    .get("delta")
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    if !content.is_empty() {
                        return SseParseResult::Token(StreamToken {
                            content: content.to_string(),
                            finish_reason: finish,
                        });
                    }
                }

                // finish_reason without content (e.g. "stop")
                if finish.as_deref() == Some("stop") {
                    return SseParseResult::Done;
                }
            }
        }

        SseParseResult::Skip
    }

    fn model_catalog(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "gpt-4o".to_string(),
                name: "GPT-4o".to_string(),
                provider_id: "openai".to_string(),
                input_price_per_m: 2.50,
                output_price_per_m: 10.00,
                max_context: 128_000,
            },
            ModelInfo {
                id: "gpt-4o-mini".to_string(),
                name: "GPT-4o Mini".to_string(),
                provider_id: "openai".to_string(),
                input_price_per_m: 0.15,
                output_price_per_m: 0.60,
                max_context: 128_000,
            },
            ModelInfo {
                id: "gpt-4.1".to_string(),
                name: "GPT-4.1".to_string(),
                provider_id: "openai".to_string(),
                input_price_per_m: 2.00,
                output_price_per_m: 8.00,
                max_context: 1_047_576,
            },
            ModelInfo {
                id: "gpt-4.1-mini".to_string(),
                name: "GPT-4.1 Mini".to_string(),
                provider_id: "openai".to_string(),
                input_price_per_m: 0.40,
                output_price_per_m: 1.60,
                max_context: 1_047_576,
            },
        ]
    }
}
