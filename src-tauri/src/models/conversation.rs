use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub provider_id: String,
    pub model_id: String,
    pub persona_id: Option<String>,
    pub is_pinned: bool,
    pub message_count: i64,
    pub total_cost_usd: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
    pub created_at: String,
    pub version_count: i32,
    pub active_version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageVersion {
    pub id: String,
    pub message_id: String,
    pub version_number: i32,
    pub content: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
    pub created_at: String,
}
