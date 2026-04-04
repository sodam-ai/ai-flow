use crate::db::pool::Database;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: i64,
    pub event_type: String,
    pub severity: String,
    pub detail: Option<String>,
    pub created_at: String,
}

/// Read audit log entries (newest first, paginated)
pub fn get_entries(db: &Database, limit: i64, offset: i64) -> Result<Vec<AuditEntry>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, event_type, severity, detail, created_at
             FROM audit_log
             ORDER BY id DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let rows = stmt.query_map(rusqlite::params![limit, offset], |row| {
            Ok(AuditEntry {
                id: row.get(0)?,
                event_type: row.get(1)?,
                severity: row.get(2)?,
                detail: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Log an audit event (append-only, immutable)
pub fn log_event(db: &Database, event_type: &str, severity: &str, detail: Option<&str>) {
    let result = db.write(|conn| {
        conn.execute(
            "INSERT INTO audit_log (event_type, severity, detail) VALUES (?1, ?2, ?3)",
            rusqlite::params![event_type, severity, detail],
        )?;
        Ok(())
    });

    if let Err(e) = result {
        // Audit logging should never block the main operation
        log::warn!("Failed to write audit log: {}", e);
    }
}
