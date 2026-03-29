use chrono::Utc;
use uuid::Uuid;
use std::sync::Arc;
use tracing::warn;

use crate::db::Database;

/// 감사 이벤트 타입 — 05_SECURITY_SPEC.md 감사 로그 이벤트 목록
#[derive(Debug, Clone)]
pub enum AuditEvent {
    ApiKeySet { provider: String },
    ApiKeyDeleted { provider: String },
    DbUnlocked,
    DbBackupCreated,
    PrivacyModeToggled { enabled: bool },
    StreamStarted { conversation_id: String },
    StreamCancelled { conversation_id: String },
    ConversationDeleted { conversation_id: String },
}

impl AuditEvent {
    fn event_type(&self) -> &'static str {
        match self {
            AuditEvent::ApiKeySet { .. } => "api_key_set",
            AuditEvent::ApiKeyDeleted { .. } => "api_key_deleted",
            AuditEvent::DbUnlocked => "db_unlocked",
            AuditEvent::DbBackupCreated => "db_backup_created",
            AuditEvent::PrivacyModeToggled { .. } => "privacy_mode_toggled",
            AuditEvent::StreamStarted { .. } => "stream_started",
            AuditEvent::StreamCancelled { .. } => "stream_cancelled",
            AuditEvent::ConversationDeleted { .. } => "conversation_deleted",
        }
    }

    fn detail(&self) -> Option<String> {
        match self {
            AuditEvent::ApiKeySet { provider } => Some(format!("provider={}", provider)),
            AuditEvent::ApiKeyDeleted { provider } => Some(format!("provider={}", provider)),
            AuditEvent::PrivacyModeToggled { enabled } => {
                Some(format!("enabled={}", enabled))
            }
            AuditEvent::StreamStarted { conversation_id } => {
                Some(format!("conversation_id={}", conversation_id))
            }
            AuditEvent::StreamCancelled { conversation_id } => {
                Some(format!("conversation_id={}", conversation_id))
            }
            AuditEvent::ConversationDeleted { conversation_id } => {
                Some(format!("conversation_id={}", conversation_id))
            }
            _ => None,
        }
    }
}

pub struct AuditService {
    db: Arc<Database>,
}

impl AuditService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 감사 로그 기록 — 실패 시 경고만 (로그 실패로 작업 중단 안 함)
    pub async fn log(&self, event: AuditEvent) {
        let id = Uuid::new_v4().to_string();
        let event_type = event.event_type().to_string();
        let detail = event.detail();
        let created_at = Utc::now().to_rfc3339();

        let result = self
            .db
            .write(move |conn| {
                conn.execute(
                    "INSERT INTO audit_logs (id, event_type, detail, created_at) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![id, event_type, detail, created_at],
                )?;
                Ok(())
            })
            .await;

        if let Err(e) = result {
            warn!("audit log failed: {}", e);
        }
    }
}
