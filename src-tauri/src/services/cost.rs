/// 토큰 비용 계산 — USD + KRW (환율 캐시는 Phase 2에서 추가)
/// 11개 공급자 전체, 2026년 3월 기준 최신 가격
pub struct CostCalculator;

/// 모델 가격 (per 1M tokens, USD)
struct ModelPrice {
    input: f64,
    output: f64,
}

fn get_model_price(model_id: &str) -> ModelPrice {
    match model_id {
        // ─── OpenAI ──────────────────────────────────────────
        "gpt-4.1"      => ModelPrice { input: 2.00,  output: 8.00  },
        "gpt-4.1-mini" => ModelPrice { input: 0.40,  output: 1.60  },
        "gpt-4.1-nano" => ModelPrice { input: 0.10,  output: 0.40  },
        "o4-mini"      => ModelPrice { input: 1.10,  output: 4.40  },
        "o3"           => ModelPrice { input: 10.00, output: 40.00 },
        "gpt-4o"       => ModelPrice { input: 2.50,  output: 10.00 },
        "gpt-4o-mini"  => ModelPrice { input: 0.15,  output: 0.60  },
        "gpt-4-turbo"  => ModelPrice { input: 10.00, output: 30.00 },
        // ─── Anthropic ───────────────────────────────────────
        "claude-opus-4-6"            => ModelPrice { input: 15.00, output: 75.00 },
        "claude-sonnet-4-6"          => ModelPrice { input: 3.00,  output: 15.00 },
        "claude-haiku-4-5-20251001"  => ModelPrice { input: 0.80,  output: 4.00  },
        "claude-3-5-sonnet-20241022" => ModelPrice { input: 3.00,  output: 15.00 },
        "claude-3-haiku-20240307"    => ModelPrice { input: 0.25,  output: 1.25  },
        // ─── Google Gemini ───────────────────────────────────
        "gemini-2.5-pro-preview-03-25" => ModelPrice { input: 1.25,  output: 10.00 },
        "gemini-2.0-flash"             => ModelPrice { input: 0.10,  output: 0.40  },
        "gemini-1.5-pro"               => ModelPrice { input: 1.25,  output: 5.00  },
        "gemini-1.5-flash"             => ModelPrice { input: 0.075, output: 0.30  },
        // ─── Mistral ─────────────────────────────────────────
        "mistral-large-latest" => ModelPrice { input: 2.00, output: 6.00 },
        "mistral-small-latest" => ModelPrice { input: 0.20, output: 0.60 },
        "codestral-latest"     => ModelPrice { input: 0.30, output: 0.90 },
        // ─── Groq ────────────────────────────────────────────
        "llama-3.3-70b-versatile" => ModelPrice { input: 0.59, output: 0.79 },
        "llama-3.1-8b-instant"    => ModelPrice { input: 0.05, output: 0.08 },
        "mixtral-8x7b-32768"      => ModelPrice { input: 0.24, output: 0.24 },
        // ─── DeepSeek ────────────────────────────────────────
        "deepseek-chat"     => ModelPrice { input: 0.27, output: 1.10 },
        "deepseek-reasoner" => ModelPrice { input: 0.55, output: 2.19 },
        // ─── Cohere ──────────────────────────────────────────
        "command-r-plus-08-2024" => ModelPrice { input: 2.50, output: 10.00 },
        "command-r-08-2024"      => ModelPrice { input: 0.15, output: 0.60  },
        // ─── xAI (Grok) ──────────────────────────────────────
        "grok-3"      => ModelPrice { input: 3.00, output: 15.00 },
        "grok-3-mini" => ModelPrice { input: 0.30, output: 0.50  },
        "grok-3-fast" => ModelPrice { input: 5.00, output: 25.00 },
        // ─── Ollama (로컬 무료) + 알 수 없는 모델 ─────────────
        _ => ModelPrice { input: 0.0, output: 0.0 },
    }
}

impl CostCalculator {
    /// 입력/출력 토큰 수로 USD 비용 계산
    pub fn calculate_usd(model_id: &str, input_tokens: u32, output_tokens: u32) -> f64 {
        let price = get_model_price(model_id);
        let input_cost = (input_tokens as f64 / 1_000_000.0) * price.input;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * price.output;
        input_cost + output_cost
    }

    /// USD → KRW 변환 (Phase 1: 고정 환율 1,350 KRW/USD)
    pub fn usd_to_krw(usd: f64) -> f64 {
        usd * 1350.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_usd_openai() {
        // gpt-4o: $2.50/$10.00 per 1M tokens
        let cost = CostCalculator::calculate_usd("gpt-4o", 1_000_000, 100_000);
        assert!((cost - 3.50).abs() < 0.001, "expected ~$3.50 got {}", cost);
    }

    #[test]
    fn test_calculate_usd_anthropic() {
        // claude-sonnet-4-6: $3.00/$15.00 per 1M tokens
        let cost = CostCalculator::calculate_usd("claude-sonnet-4-6", 500_000, 200_000);
        assert!((cost - 4.50).abs() < 0.001, "expected ~$4.50 got {}", cost);
    }

    #[test]
    fn test_calculate_usd_ollama_free() {
        let cost = CostCalculator::calculate_usd("llama3.2", 1_000_000, 1_000_000);
        assert_eq!(cost, 0.0);
    }

    #[test]
    fn test_usd_to_krw() {
        assert!((CostCalculator::usd_to_krw(1.0) - 1350.0).abs() < 0.001);
    }
}
