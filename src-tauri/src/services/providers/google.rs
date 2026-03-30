use async_trait::async_trait;
use crate::models::conversation::Message;
use crate::models::provider::{ModelInfo, StreamToken};
use crate::services::provider_trait::{AiProvider, SseParseResult};

pub struct GoogleProvider;

#[async_trait]
impl AiProvider for GoogleProvider {
    fn id(&self) -> &str {
        "google"
    }

    fn auth_headers(&self, _api_key: &str) -> Vec<(String, String)> {
        // Google uses query param for API key, not header
        // The key is appended to URL in chat_endpoint
        vec![]
    }

    fn chat_endpoint(&self, model_id: &str) -> String {
        // API key will be appended as query param by ai_client
        format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse",
            model_id
        )
    }

    fn build_request_body(
        &self,
        messages: &[Message],
        _model_id: &str,
        system_prompt: Option<&str>,
    ) -> serde_json::Value {
        let contents: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|msg| {
                let role = match msg.role.as_str() {
                    "assistant" => "model",
                    other => other,
                };
                serde_json::json!({
                    "role": role,
                    "parts": [{ "text": msg.content }],
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "contents": contents,
        });

        if let Some(sys) = system_prompt {
            body["systemInstruction"] = serde_json::json!({
                "parts": [{ "text": sys }],
            });
        }

        body
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

        let json: serde_json::Value = match serde_json::from_str(data) {
            Ok(v) => v,
            Err(_) => return SseParseResult::Skip,
        };

        // Usage metadata
        if let Some(metadata) = json.get("usageMetadata") {
            let input = metadata
                .get("promptTokenCount")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let output = metadata
                .get("candidatesTokenCount")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            // Google sends usage with each chunk; we accumulate in ai_client
            if input > 0 || output > 0 {
                // Check if this is the final chunk (has finishReason)
                let is_final = json
                    .get("candidates")
                    .and_then(|c| c.as_array())
                    .and_then(|a| a.first())
                    .and_then(|c| c.get("finishReason"))
                    .and_then(|f| f.as_str())
                    .is_some();

                if is_final {
                    return SseParseResult::Usage {
                        input_tokens: input,
                        output_tokens: output,
                    };
                }
            }
        }

        // Content text
        if let Some(candidates) = json.get("candidates").and_then(|c| c.as_array()) {
            if let Some(candidate) = candidates.first() {
                let finish = candidate
                    .get("finishReason")
                    .and_then(|f| f.as_str())
                    .map(|s| s.to_string());

                if let Some(text) = candidate
                    .get("content")
                    .and_then(|c| c.get("parts"))
                    .and_then(|p| p.as_array())
                    .and_then(|a| a.first())
                    .and_then(|p| p.get("text"))
                    .and_then(|t| t.as_str())
                {
                    if !text.is_empty() {
                        return SseParseResult::Token(StreamToken {
                            content: text.to_string(),
                            finish_reason: finish,
                        });
                    }
                }

                if finish.as_deref() == Some("STOP") {
                    return SseParseResult::Done;
                }
            }
        }

        SseParseResult::Skip
    }

    fn model_catalog(&self) -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "gemini-2.5-flash".to_string(),
                name: "Gemini 2.5 Flash".to_string(),
                provider_id: "google".to_string(),
                input_price_per_m: 0.15,
                output_price_per_m: 0.60,
                max_context: 1_048_576,
            },
            ModelInfo {
                id: "gemini-2.5-pro".to_string(),
                name: "Gemini 2.5 Pro".to_string(),
                provider_id: "google".to_string(),
                input_price_per_m: 1.25,
                output_price_per_m: 10.00,
                max_context: 1_048_576,
            },
            ModelInfo {
                id: "gemini-2.0-flash".to_string(),
                name: "Gemini 2.0 Flash".to_string(),
                provider_id: "google".to_string(),
                input_price_per_m: 0.075,
                output_price_per_m: 0.30,
                max_context: 1_048_576,
            },
        ]
    }
}
