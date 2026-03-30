use serde::{Deserialize, Serialize};

/// Token pricing per model (2026 prices, USD per 1M tokens)
pub struct ModelPricing {
    pub input_per_m: f64,
    pub output_per_m: f64,
}

pub fn get_pricing(provider: &str, model: &str) -> ModelPricing {
    match (provider, model) {
        // OpenAI
        ("openai", m) if m.contains("gpt-4o-mini") || m.contains("gpt-4.1-mini") => {
            ModelPricing { input_per_m: 0.15, output_per_m: 0.60 }
        }
        ("openai", m) if m.contains("gpt-4o") || m.contains("gpt-4.1") => {
            ModelPricing { input_per_m: 2.50, output_per_m: 10.00 }
        }
        // Anthropic
        ("anthropic", m) if m.contains("haiku") => {
            ModelPricing { input_per_m: 0.80, output_per_m: 4.00 }
        }
        ("anthropic", m) if m.contains("sonnet") => {
            ModelPricing { input_per_m: 3.00, output_per_m: 15.00 }
        }
        ("anthropic", m) if m.contains("opus") => {
            ModelPricing { input_per_m: 15.00, output_per_m: 75.00 }
        }
        // Google
        ("google", m) if m.contains("flash") => {
            ModelPricing { input_per_m: 0.075, output_per_m: 0.30 }
        }
        ("google", m) if m.contains("pro") => {
            ModelPricing { input_per_m: 1.25, output_per_m: 10.00 }
        }
        // Groq (free tier, but track usage)
        ("groq", _) => ModelPricing { input_per_m: 0.05, output_per_m: 0.08 },
        // DeepSeek
        ("deepseek", _) => ModelPricing { input_per_m: 0.14, output_per_m: 0.28 },
        // Mistral
        ("mistral", m) if m.contains("large") => {
            ModelPricing { input_per_m: 2.00, output_per_m: 6.00 }
        }
        ("mistral", _) => ModelPricing { input_per_m: 0.25, output_per_m: 0.25 },
        // xAI
        ("xai", _) => ModelPricing { input_per_m: 5.00, output_per_m: 15.00 },
        // Cohere
        ("cohere", _) => ModelPricing { input_per_m: 2.50, output_per_m: 10.00 },
        // Ollama (local, free)
        ("ollama", _) => ModelPricing { input_per_m: 0.0, output_per_m: 0.0 },
        // Default fallback
        _ => ModelPricing { input_per_m: 1.00, output_per_m: 3.00 },
    }
}

/// Calculate cost in USD
pub fn calc_cost(provider: &str, model: &str, input_tokens: i64, output_tokens: i64) -> f64 {
    let pricing = get_pricing(provider, model);
    (input_tokens as f64 * pricing.input_per_m + output_tokens as f64 * pricing.output_per_m)
        / 1_000_000.0
}

/// Fallback exchange rate (PRD: 폴백 1380)
const FALLBACK_USD_TO_KRW: f64 = 1380.0;

/// Cost result with dual currency (PRD §1a: USD + KRW 병행)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostResult {
    pub usd: f64,
    pub krw: f64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub exchange_rate: f64,
}

/// Calculate cost with KRW conversion
pub fn calc_cost_full(
    provider: &str,
    model: &str,
    input_tokens: i64,
    output_tokens: i64,
    exchange_rate: Option<f64>,
) -> CostResult {
    let usd = calc_cost(provider, model, input_tokens, output_tokens);
    let rate = exchange_rate.unwrap_or(FALLBACK_USD_TO_KRW);
    let krw = usd * rate;

    CostResult {
        usd,
        krw,
        input_tokens,
        output_tokens,
        exchange_rate: rate,
    }
}
