use crate::services::ai_client::get_http_client;

/// Validate an API key by making a lightweight, free API call.
/// Returns Ok(()) if key is valid, Err with user-friendly message if not.
///
/// PRD §05: "API 키를 OS 키체인에 저장하기 전에, 경량 API 호출로 유효성을 검증해야 한다."
pub async fn validate_api_key(provider_id: &str, api_key: &str) -> Result<(), String> {
    // Step 1: Format validation
    validate_format(provider_id, api_key)?;

    // Step 2: Lightweight API call (no billing)
    validate_with_api(provider_id, api_key).await
}

/// Format prefix validation (fast, offline check)
fn validate_format(provider_id: &str, api_key: &str) -> Result<(), String> {
    let key = api_key.trim();

    if key.is_empty() {
        return Err("VAL_001: API key cannot be empty".to_string());
    }

    match provider_id {
        "openai" => {
            if !key.starts_with("sk-") {
                return Err("AUTH_006: OpenAI key must start with 'sk-'".to_string());
            }
        }
        "anthropic" => {
            if !key.starts_with("sk-ant-") {
                return Err("AUTH_006: Anthropic key must start with 'sk-ant-'".to_string());
            }
        }
        "google" => {
            if !key.starts_with("AIza") {
                return Err("AUTH_006: Google key must start with 'AIza'".to_string());
            }
        }
        "groq" => {
            if !key.starts_with("gsk_") {
                return Err("AUTH_006: Groq key must start with 'gsk_'".to_string());
            }
        }
        "xai" => {
            if !key.starts_with("xai-") {
                return Err("AUTH_006: xAI key must start with 'xai-'".to_string());
            }
        }
        // ollama, mistral, deepseek, cohere, azure_openai, openai_compatible
        // — no standard prefix; skip format check
        _ => {}
    }

    Ok(())
}

/// Lightweight API validation (free endpoints, no billing)
async fn validate_with_api(provider_id: &str, api_key: &str) -> Result<(), String> {
    let client = get_http_client();

    let result = match provider_id {
        "openai" | "openai_compatible" => validate_openai(&client, api_key).await,
        "anthropic" => validate_anthropic(&client, api_key).await,
        "google" => validate_google(&client, api_key).await,
        "groq" => validate_openai_compatible(
            &client,
            api_key,
            "https://api.groq.com/openai/v1/models",
        )
        .await,
        "mistral" => validate_openai_compatible(
            &client,
            api_key,
            "https://api.mistral.ai/v1/models",
        )
        .await,
        "deepseek" => validate_openai_compatible(
            &client,
            api_key,
            "https://api.deepseek.com/v1/models",
        )
        .await,
        "xai" => validate_openai_compatible(
            &client,
            api_key,
            "https://api.x.ai/v1/models",
        )
        .await,
        "cohere" => validate_cohere(&client, api_key).await,
        "ollama" => {
            // Ollama is local — just check if server is reachable
            validate_ollama(&client).await
        }
        "azure_openai" => {
            // Azure requires endpoint URL which we don't have yet — skip API validation
            Ok(())
        }
        _ => Ok(()),
    };

    result.map_err(|e| {
        log::warn!("API key validation failed for {}: {}", provider_id, e);
        e
    })
}

/// OpenAI: GET /v1/models (free, returns model list)
async fn validate_openai(client: &reqwest::Client, api_key: &str) -> Result<(), String> {
    let resp = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("NET_001: Cannot connect to OpenAI: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err("AUTH_001: Invalid OpenAI API key".to_string()),
        403 => Err("AUTH_002: OpenAI API key expired or disabled".to_string()),
        429 => {
            // Rate limited but key is valid
            Ok(())
        }
        status => Err(format!("AUTH_006: OpenAI returned unexpected status {}", status)),
    }
}

/// Anthropic: GET /v1/models (free, returns model list)
async fn validate_anthropic(client: &reqwest::Client, api_key: &str) -> Result<(), String> {
    let resp = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("NET_001: Cannot connect to Anthropic: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err("AUTH_001: Invalid Anthropic API key".to_string()),
        403 => Err("AUTH_002: Anthropic API key expired or disabled".to_string()),
        429 => Ok(()),
        status => Err(format!("AUTH_006: Anthropic returned unexpected status {}", status)),
    }
}

/// Google Gemini: GET /v1beta/models (free, returns model list)
async fn validate_google(client: &reqwest::Client, api_key: &str) -> Result<(), String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        api_key
    );

    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("NET_001: Cannot connect to Google AI: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        400 | 403 => Err("AUTH_001: Invalid Google API key".to_string()),
        429 => Ok(()),
        status => Err(format!("AUTH_006: Google returned unexpected status {}", status)),
    }
}

/// OpenAI-compatible providers (Groq, Mistral, DeepSeek, xAI)
async fn validate_openai_compatible(
    client: &reqwest::Client,
    api_key: &str,
    models_url: &str,
) -> Result<(), String> {
    let resp = client
        .get(models_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("NET_001: Cannot connect to provider: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err("AUTH_001: Invalid API key".to_string()),
        403 => Err("AUTH_002: API key expired or disabled".to_string()),
        429 => Ok(()),
        status => Err(format!("AUTH_006: Provider returned unexpected status {}", status)),
    }
}

/// Cohere: GET /v2/models
async fn validate_cohere(client: &reqwest::Client, api_key: &str) -> Result<(), String> {
    let resp = client
        .get("https://api.cohere.com/v2/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("NET_001: Cannot connect to Cohere: {}", e))?;

    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err("AUTH_001: Invalid Cohere API key".to_string()),
        429 => Ok(()),
        status => Err(format!("AUTH_006: Cohere returned unexpected status {}", status)),
    }
}

/// Ollama: check if local server is running
async fn validate_ollama(client: &reqwest::Client) -> Result<(), String> {
    let resp = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .map_err(|_| "AI_009: Ollama is not running on localhost:11434".to_string())?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err("AI_009: Ollama server returned an error".to_string())
    }
}
