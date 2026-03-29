use crate::db::pool::Database;

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
