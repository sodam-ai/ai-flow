use crate::db::pool::Database;
use serde::{Deserialize, Serialize};

/// Privacy detection log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyLog {
    pub id: String,
    pub conversation_id: String,
    pub message_id: Option<String>,
    pub pii_type: String,
    pub pii_count: i32,
    pub was_masked: bool,
    pub created_at: String,
}

/// Log PII detections (called from frontend after OpenRedaction scan)
pub fn log_detection(
    db: &Database,
    conversation_id: &str,
    message_id: Option<&str>,
    pii_type: &str,
    pii_count: i32,
    was_masked: bool,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    db.write(|conn| {
        conn.execute(
            "INSERT INTO privacy_logs (id, conversation_id, message_id, pii_type, pii_count, was_masked, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, conversation_id, message_id, pii_type, pii_count, was_masked as i32, now],
        )?;
        Ok(())
    })
}

/// Get privacy stats for a conversation
pub fn get_stats(db: &Database, conversation_id: &str) -> Result<Vec<PiiStat>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT pii_type, SUM(pii_count) as total, SUM(CASE WHEN was_masked THEN pii_count ELSE 0 END) as masked
             FROM privacy_logs
             WHERE conversation_id = ?1
             GROUP BY pii_type
             ORDER BY total DESC",
        )?;

        let rows = stmt.query_map(rusqlite::params![conversation_id], |row| {
            Ok(PiiStat {
                pii_type: row.get(0)?,
                total_count: row.get(1)?,
                masked_count: row.get(2)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiiStat {
    pub pii_type: String,
    pub total_count: i64,
    pub masked_count: i64,
}
