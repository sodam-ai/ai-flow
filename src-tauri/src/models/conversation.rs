use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 대화 엔티티 — 02_DATA_MODEL.md Conversation 테이블과 동기화
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub provider_id: String,
    pub model_id: String,
    pub total_tokens: i64,
    pub total_cost_usd: f64,
    pub is_pinned: bool,
    pub is_private: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Conversation {
    pub fn new(provider_id: String, model_id: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            title: String::new(),
            provider_id,
            model_id,
            total_tokens: 0,
            total_cost_usd: 0.0,
            is_pinned: false,
            is_private: false,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 메시지 역할 — AI 공급자 공통 스키마
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// 메시지 엔티티 — 02_DATA_MODEL.md Message 테이블과 동기화
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub tokens_used: Option<i64>,
    pub cost_usd: Option<f64>,
    pub model_id: Option<String>,
    pub is_redacted: bool,
    pub created_at: DateTime<Utc>,
}

impl Message {
    pub fn new_user(conversation_id: String, content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            conversation_id,
            role: MessageRole::User,
            content,
            tokens_used: None,
            cost_usd: None,
            model_id: None,
            is_redacted: false,
            created_at: Utc::now(),
        }
    }

    pub fn new_assistant(conversation_id: String, content: String, model_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            conversation_id,
            role: MessageRole::Assistant,
            content,
            tokens_used: None,
            cost_usd: None,
            model_id: Some(model_id),
            is_redacted: false,
            created_at: Utc::now(),
        }
    }
}

/// 페이지네이션 요청 — IPC 입력
#[derive(Debug, Deserialize)]
pub struct MessagePage {
    pub conversation_id: String,
    pub before_id: Option<String>,
    pub limit: u32,
}

/// 페이지네이션 응답
#[derive(Debug, Serialize)]
pub struct MessagePageResult {
    pub messages: Vec<Message>,
    pub has_more: bool,
}
