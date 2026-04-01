use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServer {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub server_type: String,
    pub command: String,
    pub args: Vec<String>,
    pub allowed_paths: Vec<String>,
    pub env_vars: serde_json::Value,
    pub is_enabled: bool,
    pub is_builtin: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMCPServerRequest {
    pub name: String,
    pub description: Option<String>,
    pub server_type: Option<String>,
    pub command: String,
    pub args: Vec<String>,
    pub allowed_paths: Vec<String>,
    pub env_vars: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMCPServerRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub allowed_paths: Option<Vec<String>>,
    pub env_vars: Option<serde_json::Value>,
    pub is_enabled: Option<bool>,
}
