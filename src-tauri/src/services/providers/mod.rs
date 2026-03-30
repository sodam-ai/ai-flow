pub mod openai;
pub mod anthropic;
pub mod google;

use crate::services::provider_trait::AiProvider;

/// Get a provider implementation by ID
pub fn get_provider(provider_id: &str) -> Result<Box<dyn AiProvider>, String> {
    match provider_id {
        "openai" => Ok(Box::new(openai::OpenAiProvider)),
        "anthropic" => Ok(Box::new(anthropic::AnthropicProvider)),
        "google" => Ok(Box::new(google::GoogleProvider)),
        other => Err(format!("PROVIDER_001: Unknown provider: {}", other)),
    }
}
