use serde::{Deserialize, Serialize};

/// A discovered local LLM endpoint (Ollama, LM Studio)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLlmEndpoint {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_type: String, // "ollama" | "openai_compat"
    pub is_active: bool,
    pub last_seen_at: Option<String>,
}

/// A model available on a local LLM endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLlmModel {
    pub id: String,
    pub endpoint_id: String,
    pub model_name: String,
    pub model_size: Option<String>,
    pub parameter_count: Option<String>,
}

/// Detection result for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalLlmDetectionResult {
    pub endpoint_name: String,
    pub base_url: String,
    pub is_running: bool,
    pub models: Vec<LocalLlmModel>,
}
