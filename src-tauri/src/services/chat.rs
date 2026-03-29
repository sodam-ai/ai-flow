use crate::db::pool::Database;
use crate::models::conversation::{Conversation, Message};

/// Create a new conversation
pub fn create_conversation(
    db: &Database,
    provider_id: &str,
    model_id: &str,
) -> Result<Conversation, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let title = "New Chat".to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.write(|conn| {
        conn.execute(
            "INSERT INTO conversations (id, title, provider_id, model_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, title, provider_id, model_id, now, now],
        )?;
        Ok(())
    })?;

    Ok(Conversation {
        id,
        title,
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        persona_id: None,
        is_pinned: false,
        message_count: 0,
        total_cost_usd: 0.0,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Get all conversations (pinned first, then by updated_at)
pub fn get_conversations(db: &Database) -> Result<Vec<Conversation>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, provider_id, model_id, persona_id, is_pinned,
                    message_count, total_cost_usd, created_at, updated_at
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
                persona_id: row.get(4)?,
                is_pinned: row.get(5)?,
                message_count: row.get(6)?,
                total_cost_usd: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Get messages for a conversation (paginated)
pub fn get_messages(
    db: &Database,
    conversation_id: &str,
    limit: i64,
) -> Result<Vec<Message>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, created_at
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(rusqlite::params![conversation_id, limit], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                input_tokens: row.get(4)?,
                output_tokens: row.get(5)?,
                cost_usd: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut msgs: Vec<Message> = rows.collect::<Result<Vec<_>, _>>()?;
        msgs.reverse(); // oldest first for display
        Ok(msgs)
    })
}

/// Save a message
pub fn save_message(
    db: &Database,
    conversation_id: &str,
    role: &str,
    content: &str,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    cost_usd: Option<f64>,
) -> Result<Message, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.write(|conn| {
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, now],
        )?;

        // Update conversation stats
        conn.execute(
            "UPDATE conversations SET message_count = message_count + 1,
             total_cost_usd = total_cost_usd + COALESCE(?2, 0.0),
             updated_at = ?3
             WHERE id = ?1",
            rusqlite::params![conversation_id, cost_usd, now],
        )?;

        Ok(())
    })?;

    Ok(Message {
        id,
        conversation_id: conversation_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        input_tokens,
        output_tokens,
        cost_usd,
        created_at: now,
    })
}
