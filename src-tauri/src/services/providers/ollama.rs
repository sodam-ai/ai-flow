use async_trait::async_trait;
use crate::models::conversation::Message;
use crate::models::provider::{ModelInfo, StreamToken};
use crate::services::provider_trait::{AiProvider, SseParseResult};

/// Ollama provider — uses OpenAI-compatible API at localhost:11434
pub struct OllamaProvider {
    pub base_url: String,
}

impl Default for OllamaProvider {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:11434".to_string(),
        }
    }
}

#[async_trait]
impl AiProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }

    fn auth_headers(&self, _api_key: &str) -> Vec<(String, String)> {
        // Ollama needs no auth for local access
        vec![]
    }

    fn chat_endpoint(&self, _model_id: &str) -> String {
        format!("{}/v1/chat/completions", self.base_url)
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
        })
    }

    fn parse_sse_line(&self, line: &str) -> SseParseResult {
        // Ollama's OpenAI-compatible endpoint uses the same SSE format as OpenAI
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

        // Usage stats
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

                if finish.as_deref() == Some("stop") {
                    return SseParseResult::Done;
                }
            }
        }

        SseParseResult::Skip
    }

    fn model_catalog(&self) -> Vec<ModelInfo> {
        // Dynamic — populated by local_llm detection
        // Return common defaults for display
        vec![
            ModelInfo {
                id: "llama3:8b".to_string(),
                name: "Llama 3 8B (Local)".to_string(),
                provider_id: "ollama".to_string(),
                input_price_per_m: 0.0,
                output_price_per_m: 0.0,
                max_context: 8192,
            },
            ModelInfo {
                id: "mistral:7b".to_string(),
                name: "Mistral 7B (Local)".to_string(),
                provider_id: "ollama".to_string(),
                input_price_per_m: 0.0,
                output_price_per_m: 0.0,
                max_context: 32768,
            },
        ]
    }
}
