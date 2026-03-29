use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyStatus {
    pub is_set: bool,
    pub masked_preview: Option<String>,
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
