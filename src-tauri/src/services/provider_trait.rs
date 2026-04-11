use async_trait::async_trait;
use crate::models::conversation::Message;
use crate::models::provider::{ModelInfo, StreamToken};

/// Unified AI provider interface (PRD v4.0 §04: Provider Trait)
///
/// Each provider implements this trait. Adding a new provider requires
/// only a new struct + impl — no changes to ai_client.rs.
#[async_trait]
pub trait AiProvider: Send + Sync {
    /// Provider identifier (e.g. "openai", "anthropic", "google")
    fn id(&self) -> &str;

    /// Build auth headers — varies per provider
    /// OpenAI: Authorization: Bearer <key>
    /// Anthropic: x-api-key: <key>
    /// Google: query param or Authorization
    fn auth_headers(&self, api_key: &str) -> Vec<(String, String)>;

    /// Chat completions endpoint URL
    fn chat_endpoint(&self, model_id: &str) -> String;

    /// Build provider-specific request body from messages.
    /// `temperature` (0.0–2.0): controls randomness; None uses provider default.
    /// `max_tokens`: caps response length; None uses provider default.
    fn build_request_body(
        &self,
        messages: &[Message],
        model_id: &str,
        system_prompt: Option<&str>,
        temperature: Option<f64>,
        max_tokens: Option<u32>,
    ) -> serde_json::Value;

    /// Parse a single SSE line into a StreamToken (or None if not a content chunk)
    /// Each provider has different SSE formats:
    /// - OpenAI: "data: {json}" lines
    /// - Anthropic: "event: content_block_delta\ndata: {json}" pairs
    /// - Google: JSON array chunks
    fn parse_sse_line(&self, line: &str) -> SseParseResult;

    /// Supported models with pricing
    fn model_catalog(&self) -> Vec<ModelInfo>;

    /// Extract text from a non-streaming JSON response (for workflow/batch)
    fn extract_non_stream_text(&self, json: &serde_json::Value) -> Option<String>;
}

/// Result of parsing a single SSE line
#[derive(Debug)]
pub enum SseParseResult {
    /// A content token to stream to the user
    Token(StreamToken),
    /// Usage stats (some providers send this at the end)
    Usage { input_tokens: i64, output_tokens: i64 },
    /// Stream is done (received [DONE] or equivalent)
    Done,
    /// Not a content line (comment, event type, empty line, etc.)
    Skip,
}
