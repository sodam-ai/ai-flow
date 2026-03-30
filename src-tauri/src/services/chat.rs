use crate::db::pool::Database;
use crate::models::conversation::{Conversation, Message, MessageVersion};

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
            "SELECT id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, created_at, version_count, active_version
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
                version_count: row.get(8)?,
                active_version: row.get(9)?,
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
        version_count: 1,
        active_version: 1,
    })
}

/// Save current message content as a version before regeneration
pub fn save_message_version(db: &Database, message_id: &str) -> Result<(), String> {
    db.write(|conn| {
        // Get current message state
        let (content, input_tokens, output_tokens, cost_usd, version_count): (String, Option<i64>, Option<i64>, Option<f64>, i32) =
            conn.query_row(
                "SELECT content, input_tokens, output_tokens, cost_usd, version_count FROM messages WHERE id = ?1",
                rusqlite::params![message_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )?;

        let version_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        // Save current content as a version
        conn.execute(
            "INSERT INTO message_versions (id, message_id, version_number, content, input_tokens, output_tokens, cost_usd, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![version_id, message_id, version_count, content, input_tokens, output_tokens, cost_usd, now],
        )?;

        Ok(())
    })
}

/// Update message content after regeneration
pub fn update_message_for_regeneration(
    db: &Database,
    message_id: &str,
    new_content: &str,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    cost_usd: Option<f64>,
) -> Result<i32, String> {
    db.write(|conn| {
        conn.execute(
            "UPDATE messages SET content = ?2, input_tokens = ?3, output_tokens = ?4, cost_usd = ?5,
             version_count = version_count + 1, active_version = version_count + 1
             WHERE id = ?1",
            rusqlite::params![message_id, new_content, input_tokens, output_tokens, cost_usd],
        )?;

        let new_version: i32 = conn.query_row(
            "SELECT active_version FROM messages WHERE id = ?1",
            rusqlite::params![message_id],
            |row| row.get(0),
        )?;

        Ok(new_version)
    })
}

/// Get all versions of a message
pub fn get_message_versions(db: &Database, message_id: &str) -> Result<Vec<MessageVersion>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, message_id, version_number, content, input_tokens, output_tokens, cost_usd, created_at
             FROM message_versions
             WHERE message_id = ?1
             ORDER BY version_number ASC",
        )?;

        let rows = stmt.query_map(rusqlite::params![message_id], |row| {
            Ok(MessageVersion {
                id: row.get(0)?,
                message_id: row.get(1)?,
                version_number: row.get(2)?,
                content: row.get(3)?,
                input_tokens: row.get(4)?,
                output_tokens: row.get(5)?,
                cost_usd: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Search messages across all conversations
pub fn search_messages(db: &Database, query: &str, limit: i64) -> Result<Vec<Message>, String> {
    let search_pattern = format!("%{}%", query);
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT m.id, m.conversation_id, m.role, m.content, m.input_tokens, m.output_tokens, m.cost_usd, m.created_at, m.version_count, m.active_version
             FROM messages m
             WHERE m.content LIKE ?1
             ORDER BY m.created_at DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(rusqlite::params![search_pattern, limit], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                input_tokens: row.get(4)?,
                output_tokens: row.get(5)?,
                cost_usd: row.get(6)?,
                created_at: row.get(7)?,
                version_count: row.get(8)?,
                active_version: row.get(9)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}
