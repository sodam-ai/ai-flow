/// Token pricing per model (2026 prices, USD per 1M tokens)
pub struct ModelPricing {
    pub input_per_m: f64,
    pub output_per_m: f64,
}

pub fn get_pricing(provider: &str, model: &str) -> ModelPricing {
    match (provider, model) {
        // OpenAI
        ("openai", m) if m.contains("gpt-4o-mini") => ModelPricing { input_per_m: 0.15, output_per_m: 0.60 },
        ("openai", m) if m.contains("gpt-4o") => ModelPricing { input_per_m: 2.50, output_per_m: 10.00 },
        // Anthropic
        ("anthropic", m) if m.contains("haiku") => ModelPricing { input_per_m: 0.25, output_per_m: 1.25 },
        ("anthropic", m) if m.contains("sonnet") => ModelPricing { input_per_m: 3.00, output_per_m: 15.00 },
        // Google
        ("google", m) if m.contains("flash") => ModelPricing { input_per_m: 0.075, output_per_m: 0.30 },
        ("google", m) if m.contains("pro") => ModelPricing { input_per_m: 1.25, output_per_m: 5.00 },
        // Default fallback
        _ => ModelPricing { input_per_m: 1.00, output_per_m: 3.00 },
    }
}

/// Calculate cost in USD
pub fn calc_cost(provider: &str, model: &str, input_tokens: i64, output_tokens: i64) -> f64 {
    let pricing = get_pricing(provider, model);
    (input_tokens as f64 * pricing.input_per_m + output_tokens as f64 * pricing.output_per_m) / 1_000_000.0
}
