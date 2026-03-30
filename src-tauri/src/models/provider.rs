use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub is_set: bool,
    pub masked_preview: Option<String>,
}

/// A single token chunk from SSE stream
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamToken {
    pub content: String,
    pub finish_reason: Option<String>,
}

/// Model catalog entry with pricing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub input_price_per_m: f64,  // USD per 1M input tokens
    pub output_price_per_m: f64, // USD per 1M output tokens
    pub max_context: u32,
}

/// Usage stats returned after stream completes
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UsageStats {
    pub input_tokens: i64,
    pub output_tokens: i64,
}

/// Mask API key for display: "sk-proj-abc...xyz1234" → "sk-p••••••••1234"
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "••••••••".to_string();
    }
    let prefix = &key[..4];
    let suffix = &key[key.len() - 4..];
    format!("{}••••••••{}", prefix, suffix)
}
