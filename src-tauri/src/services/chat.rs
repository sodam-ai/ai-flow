use anyhow::Result;
use std::sync::Arc;

use crate::db::Database;
use crate::models::conversation::{Conversation, Message, MessagePageResult};

/// 대화/메시지 CRUD 서비스 — 04_PROJECT_SPEC.md services 레이어 규칙 준수
/// commands는 이 서비스만 호출, DB를 직접 건드리지 않음
pub struct ChatService {
    db: Arc<Database>,
}

impl ChatService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    pub async fn create_conversation(
        &self,
        provider_id: String,
        model_id: String,
    ) -> Result<Conversation> {
        let conv = Conversation::new(provider_id, model_id);
        let c = conv.clone();
        self.db
            .write(move |conn| {
                conn.execute(
                    "INSERT INTO conversations (id, title, provider_id, model_id, total_tokens, total_cost_usd, is_pinned, is_private, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    rusqlite::params![
                        c.id, c.title, c.provider_id, c.model_id,
                        c.total_tokens, c.total_cost_usd,
                        c.is_pinned as i32, c.is_private as i32,
                        c.created_at.to_rfc3339(), c.updated_at.to_rfc3339()
                    ],
                )?;
                Ok(())
            })
            .await?;
        Ok(conv)
    }

    pub fn list_conversations(&self) -> Result<Vec<Conversation>> {
        self.db.read(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, title, provider_id, model_id, total_tokens, total_cost_usd,
                        is_pinned, is_private, created_at, updated_at
                 FROM conversations
                 ORDER BY is_pinned DESC, updated_at DESC
                 LIMIT 100",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    provider_id: row.get(2)?,
                    model_id: row.get(3)?,
                    total_tokens: row.get(4)?,
                    total_cost_usd: row.get(5)?,
                    is_pinned: row.get::<_, i32>(6)? != 0,
                    is_private: row.get::<_, i32>(7)? != 0,
                    created_at: row.get::<_, String>(8)?
                        .parse()
                        .unwrap_or_default(),
                    updated_at: row.get::<_, String>(9)?
                        .parse()
                        .unwrap_or_default(),
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
        })
    }

    pub async fn delete_conversation(&self, conversation_id: String) -> Result<()> {
        self.db
            .write(move |conn| {
                conn.execute(
                    "DELETE FROM conversations WHERE id = ?1",
                    rusqlite::params![conversation_id],
                )?;
                Ok(())
            })
            .await
    }

    /// 메시지 페이지네이션 — cursor 기반 (04_PROJECT_SPEC.md §메시지 페이지네이션)
    pub fn get_messages(
        &self,
        conversation_id: &str,
        before_id: Option<&str>,
        limit: u32,
    ) -> Result<MessagePageResult> {
        let cid = conversation_id.to_string();
        let bid = before_id.map(|s| s.to_string());
        let lim = limit + 1; // has_more 확인을 위해 1개 더

        self.db.read(move |conn| {
            // stmt lifetime fix: query_map iterator는 stmt를 borrow하므로
            // collect()를 stmt 스코프 내에서 완료해야 함
            let messages: Vec<Message> = if let Some(before) = &bid {
                let before_ts: String = conn.query_row(
                    "SELECT created_at FROM messages WHERE id = ?1",
                    rusqlite::params![before],
                    |r| r.get(0),
                )?;
                let mut stmt = conn.prepare(
                    "SELECT id, conversation_id, role, content, tokens_used, cost_usd,
                            model_id, is_redacted, created_at
                     FROM messages
                     WHERE conversation_id = ?1 AND created_at < ?2
                     ORDER BY created_at DESC
                     LIMIT ?3",
                )?;
                let rows: rusqlite::Result<Vec<Message>> = stmt
                    .query_map(rusqlite::params![cid, before_ts, lim], map_message_row)?
                    .collect();
                rows?
            } else {
                let mut stmt = conn.prepare(
                    "SELECT id, conversation_id, role, content, tokens_used, cost_usd,
                            model_id, is_redacted, created_at
                     FROM messages
                     WHERE conversation_id = ?1
                     ORDER BY created_at DESC
                     LIMIT ?2",
                )?;
                let rows: rusqlite::Result<Vec<Message>> = stmt
                    .query_map(rusqlite::params![cid, lim], map_message_row)?
                    .collect();
                rows?
            };

            let has_more = messages.len() as u32 > limit;
            let messages = messages.into_iter().take(limit as usize).collect();
            Ok(MessagePageResult { messages, has_more })
        })
    }

    pub async fn rename_conversation(&self, conversation_id: String, title: String) -> Result<()> {
        let now_str = chrono::Utc::now().to_rfc3339();
        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![title, now_str, conversation_id],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn toggle_pin_conversation(&self, conversation_id: String) -> Result<bool> {
        // 현재 pin 상태를 읽어 토글
        let current: i32 = self.db.read(|conn| {
            conn.query_row(
                "SELECT is_pinned FROM conversations WHERE id = ?1",
                rusqlite::params![conversation_id],
                |r| r.get(0),
            )
            .map_err(Into::into)
        })?;
        let new_val = if current != 0 { 0_i32 } else { 1_i32 };
        let now_str = chrono::Utc::now().to_rfc3339();
        let cid = conversation_id.clone();
        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE conversations SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_val, now_str, cid],
                )?;
                Ok(())
            })
            .await?;
        Ok(new_val != 0)
    }

    /// 대화 통계 업데이트 — 스트리밍 완료 후 호출
    pub async fn update_conversation_stats(
        &self,
        conversation_id: String,
        delta_tokens: i64,
        cost_usd: f64,
    ) -> Result<()> {
        let now_str = chrono::Utc::now().to_rfc3339();
        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE conversations
                     SET total_tokens    = total_tokens + ?1,
                         total_cost_usd  = total_cost_usd + ?2,
                         updated_at      = ?3
                     WHERE id = ?4",
                    rusqlite::params![delta_tokens, cost_usd, now_str, conversation_id],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn save_message(&self, message: Message) -> Result<()> {
        self.db
            .write(move |conn| {
                conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, tokens_used, cost_usd, model_id, is_redacted, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    rusqlite::params![
                        message.id,
                        message.conversation_id,
                        format!("{:?}", message.role).to_lowercase(),
                        message.content,
                        message.tokens_used,
                        message.cost_usd,
                        message.model_id,
                        message.is_redacted as i32,
                        message.created_at.to_rfc3339()
                    ],
                )?;
                Ok(())
            })
            .await
    }
}

fn map_message_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    use crate::models::conversation::MessageRole;
    let role_str: String = row.get(2)?;
    let role = match role_str.as_str() {
        "assistant" => MessageRole::Assistant,
        "system" => MessageRole::System,
        _ => MessageRole::User,
    };
    Ok(Message {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        role,
        content: row.get(3)?,
        tokens_used: row.get(4)?,
        cost_usd: row.get(5)?,
        model_id: row.get(6)?,
        is_redacted: row.get::<_, i32>(7)? != 0,
        created_at: row
            .get::<_, String>(8)?
            .parse()
            .unwrap_or_default(),
    })
}
