use serde::{Deserialize, Serialize};

/// AI 공급자 식별자 — 11개 공급자 완전 지원 (2026-03)
/// ALLOWED_PROVIDERS 상수와 반드시 동기화 유지
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderId {
    Openai,
    Anthropic,
    Google,
    Ollama,
    Mistral,
    Groq,
    DeepSeek,
    Cohere,
    Xai,
    AzureOpenai,
    OpenaiCompatible, // 사용자 정의 OpenAI-호환 엔드포인트
}

/// IPC/DB에서 문자열로 전달되는 provider_id 화이트리스트
/// CRIT-01: 이 목록에 없는 값은 즉시 거부
pub const ALLOWED_PROVIDERS: &[&str] = &[
    "openai",
    "anthropic",
    "google",
    "ollama",
    "mistral",
    "groq",
    "deepseek",
    "cohere",
    "xai",
    "azure_openai",
    "openai_compatible",
];

impl ProviderId {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "openai" => Some(Self::Openai),
            "anthropic" => Some(Self::Anthropic),
            "google" => Some(Self::Google),
            "ollama" => Some(Self::Ollama),
            "mistral" => Some(Self::Mistral),
            "groq" => Some(Self::Groq),
            "deepseek" => Some(Self::DeepSeek),
            "cohere" => Some(Self::Cohere),
            "xai" => Some(Self::Xai),
            "azure_openai" => Some(Self::AzureOpenai),
            "openai_compatible" => Some(Self::OpenaiCompatible),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
            Self::Google => "google",
            Self::Ollama => "ollama",
            Self::Mistral => "mistral",
            Self::Groq => "groq",
            Self::DeepSeek => "deepseek",
            Self::Cohere => "cohere",
            Self::Xai => "xai",
            Self::AzureOpenai => "azure_openai",
            Self::OpenaiCompatible => "openai_compatible",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Openai => "OpenAI",
            Self::Anthropic => "Anthropic",
            Self::Google => "Google Gemini",
            Self::Ollama => "Ollama (로컬)",
            Self::Mistral => "Mistral AI",
            Self::Groq => "Groq",
            Self::DeepSeek => "DeepSeek",
            Self::Cohere => "Cohere",
            Self::Xai => "xAI (Grok)",
            Self::AzureOpenai => "Azure OpenAI",
            Self::OpenaiCompatible => "OpenAI 호환 (커스텀)",
        }
    }

    /// 키체인 계정명 — API 키 저장 위치
    pub fn keychain_account(&self) -> String {
        format!("{}_api_key", self.as_str())
    }

    /// 커스텀 기본 URL 키체인 계정명 (Azure/Custom 전용)
    pub fn keychain_base_url_account(&self) -> Option<String> {
        match self {
            Self::AzureOpenai | Self::OpenaiCompatible => {
                Some(format!("{}_base_url", self.as_str()))
            }
            _ => None,
        }
    }

    /// 로컬 HTTP 허용 여부 (Ollama는 http://localhost 사용)
    pub fn allows_http(&self) -> bool {
        matches!(self, Self::Ollama)
    }

    /// API 키가 필요 없는 provider (Ollama 로컬 실행)
    pub fn requires_api_key(&self) -> bool {
        !matches!(self, Self::Ollama)
    }

    /// 요청 형식 분류
    pub fn request_format(&self) -> RequestFormat {
        match self {
            Self::Anthropic => RequestFormat::Anthropic,
            Self::Google => RequestFormat::GoogleGemini,
            _ => RequestFormat::OpenAiCompatible,
        }
    }

    /// 기본 엔드포인트 URL
    /// Google의 경우 model_id가 URL에 포함되므로 반드시 SSRF 검증 후 호출
    pub fn default_endpoint(&self, model_id: &str) -> Option<String> {
        match self {
            Self::Openai => Some("https://api.openai.com/v1/chat/completions".into()),
            Self::Anthropic => Some("https://api.anthropic.com/v1/messages".into()),
            Self::Google => Some(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse",
                model_id  // 반드시 validate_model_id_for_url() 통과 후 사용
            )),
            Self::Ollama => Some("http://localhost:11434/v1/chat/completions".into()),
            Self::Mistral => Some("https://api.mistral.ai/v1/chat/completions".into()),
            Self::Groq => Some("https://api.groq.com/openai/v1/chat/completions".into()),
            Self::DeepSeek => Some("https://api.deepseek.com/v1/chat/completions".into()),
            Self::Cohere => Some("https://api.cohere.com/compatibility/v1/chat/completions".into()),
            Self::Xai => Some("https://api.x.ai/v1/chat/completions".into()),
            // 커스텀 URL은 키체인에서 읽어야 함
            Self::AzureOpenai | Self::OpenaiCompatible => None,
        }
    }
}

/// 요청/응답 형식 분류
#[derive(Debug, Clone, PartialEq)]
pub enum RequestFormat {
    /// OpenAI, Mistral, Groq, DeepSeek, xAI, Cohere, Azure, Custom
    OpenAiCompatible,
    /// Anthropic — x-api-key 헤더, 다른 body 구조
    Anthropic,
    /// Google Gemini — 쿼리파라미터 인증, contents/generationConfig 구조
    GoogleGemini,
}

/// API 키 상태 — IPC 반환 (실제 키값 절대 포함하지 않음)
/// 04_PROJECT_SPEC.md C-1 보안 수정
#[derive(Debug, Serialize)]
pub struct ApiKeyStatus {
    pub provider_id: String,
    pub is_set: bool,
    /// 마지막 4자리만 표시 ("****1234"), None이면 미설정
    pub masked_preview: Option<String>,
}

impl ApiKeyStatus {
    pub fn not_set(provider_id: String) -> Self {
        Self { provider_id, is_set: false, masked_preview: None }
    }

    pub fn is_set(provider_id: String, raw_key: &str) -> Self {
        Self { provider_id, is_set: true, masked_preview: Some(mask_api_key(raw_key)) }
    }
}

/// API 키 마스킹 — 마지막 4자리만 표시 (보안 요구사항)
pub fn mask_api_key(key: &str) -> String {
    let len = key.len();
    if len <= 4 {
        return "****".to_string();
    }
    format!("****{}", &key[len - 4..])
}

/// AI 모델 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub display_name: String,
    pub provider_id: String,
    pub context_window: u32,
    pub input_cost_per_1m: f64,
    pub output_cost_per_1m: f64,
    pub supports_vision: bool,
    pub supports_tools: bool,
}

/// 지원 모델 카탈로그 — 2026년 3월 기준 최신 가격
pub fn get_model_catalog() -> Vec<ModelInfo> {
    vec![
        // ─── OpenAI ─────────────────────────────────────────────────────────
        mi("gpt-4.1", "GPT-4.1", "openai", 1_000_000, 2.00, 8.00, true, true),
        mi("gpt-4.1-mini", "GPT-4.1 Mini", "openai", 1_000_000, 0.40, 1.60, true, true),
        mi("gpt-4.1-nano", "GPT-4.1 Nano", "openai", 1_000_000, 0.10, 0.40, false, true),
        mi("o4-mini", "o4-mini (추론)", "openai", 200_000, 1.10, 4.40, true, true),
        mi("o3", "o3 (추론)", "openai", 200_000, 10.00, 40.00, true, true),
        mi("gpt-4o", "GPT-4o", "openai", 128_000, 2.50, 10.00, true, true),
        mi("gpt-4o-mini", "GPT-4o Mini", "openai", 128_000, 0.15, 0.60, true, true),
        // ─── Anthropic ──────────────────────────────────────────────────────
        mi("claude-opus-4-6", "Claude Opus 4.6", "anthropic", 200_000, 15.00, 75.00, true, true),
        mi("claude-sonnet-4-6", "Claude Sonnet 4.6", "anthropic", 200_000, 3.00, 15.00, true, true),
        mi("claude-haiku-4-5-20251001", "Claude Haiku 4.5", "anthropic", 200_000, 0.80, 4.00, true, true),
        mi("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", "anthropic", 200_000, 3.00, 15.00, true, true),
        mi("claude-3-haiku-20240307", "Claude 3 Haiku", "anthropic", 200_000, 0.25, 1.25, true, true),
        // ─── Google Gemini ──────────────────────────────────────────────────
        mi("gemini-2.5-pro-preview-03-25", "Gemini 2.5 Pro", "google", 1_000_000, 1.25, 10.00, true, true),
        mi("gemini-2.0-flash", "Gemini 2.0 Flash", "google", 1_000_000, 0.10, 0.40, true, true),
        mi("gemini-1.5-pro", "Gemini 1.5 Pro", "google", 1_000_000, 1.25, 5.00, true, true),
        mi("gemini-1.5-flash", "Gemini 1.5 Flash", "google", 1_000_000, 0.075, 0.30, true, false),
        // ─── Mistral ────────────────────────────────────────────────────────
        mi("mistral-large-latest", "Mistral Large", "mistral", 128_000, 2.00, 6.00, false, true),
        mi("mistral-small-latest", "Mistral Small", "mistral", 32_000, 0.20, 0.60, false, true),
        mi("codestral-latest", "Codestral (코딩)", "mistral", 256_000, 0.30, 0.90, false, false),
        // ─── Groq ───────────────────────────────────────────────────────────
        mi("llama-3.3-70b-versatile", "Llama 3.3 70B (Groq)", "groq", 128_000, 0.59, 0.79, false, true),
        mi("llama-3.1-8b-instant", "Llama 3.1 8B Instant", "groq", 128_000, 0.05, 0.08, false, true),
        mi("mixtral-8x7b-32768", "Mixtral 8x7B (Groq)", "groq", 32_768, 0.24, 0.24, false, false),
        // ─── DeepSeek ───────────────────────────────────────────────────────
        mi("deepseek-chat", "DeepSeek V3", "deepseek", 64_000, 0.27, 1.10, false, true),
        mi("deepseek-reasoner", "DeepSeek R1 (추론)", "deepseek", 64_000, 0.55, 2.19, false, false),
        // ─── Cohere ─────────────────────────────────────────────────────────
        mi("command-r-plus-08-2024", "Command R+", "cohere", 128_000, 2.50, 10.00, false, true),
        mi("command-r-08-2024", "Command R", "cohere", 128_000, 0.15, 0.60, false, true),
        // ─── xAI (Grok) ─────────────────────────────────────────────────────
        mi("grok-3", "Grok 3", "xai", 131_072, 3.00, 15.00, false, true),
        mi("grok-3-mini", "Grok 3 Mini", "xai", 131_072, 0.30, 0.50, false, true),
        mi("grok-3-fast", "Grok 3 Fast", "xai", 131_072, 5.00, 25.00, false, true),
        // ─── Ollama (로컬, 무료) ─────────────────────────────────────────────
        mi("llama3.2", "Llama 3.2 (로컬)", "ollama", 128_000, 0.0, 0.0, false, false),
        mi("llama3.1", "Llama 3.1 (로컬)", "ollama", 128_000, 0.0, 0.0, false, false),
        mi("mistral", "Mistral 7B (로컬)", "ollama", 32_000, 0.0, 0.0, false, false),
        mi("phi4", "Phi-4 (로컬)", "ollama", 16_000, 0.0, 0.0, false, false),
        mi("gemma3", "Gemma 3 (로컬)", "ollama", 128_000, 0.0, 0.0, false, false),
        mi("qwq", "QwQ 32B (로컬, 추론)", "ollama", 32_000, 0.0, 0.0, false, false),
        mi("deepseek-r1", "DeepSeek-R1 (로컬)", "ollama", 64_000, 0.0, 0.0, false, false),
    ]
}

/// ModelInfo 빠른 생성 헬퍼
fn mi(
    id: &str, display_name: &str, provider_id: &str,
    ctx: u32, inp: f64, out: f64, vision: bool, tools: bool,
) -> ModelInfo {
    ModelInfo {
        id: id.into(),
        display_name: display_name.into(),
        provider_id: provider_id.into(),
        context_window: ctx,
        input_cost_per_1m: inp,
        output_cost_per_1m: out,
        supports_vision: vision,
        supports_tools: tools,
    }
}
