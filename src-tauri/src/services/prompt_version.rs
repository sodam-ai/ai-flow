use crate::db::pool::Database;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptVersion {
    pub id: String,
    pub prompt_id: String,
    pub version_number: i32,
    pub title: String,
    pub content: String,
    pub description: String,
    pub tags: Vec<String>,
    pub created_at: String,
}

/// Save current prompt state as a version before editing
pub fn save_version(db: &Database, prompt_id: &str) -> Result<i32, String> {
    db.write(|conn| {
        // Get current prompt state
        let (title, content, description, tags_json): (String, String, String, String) =
            conn.query_row(
                "SELECT title, content, description, tags FROM prompt_templates WHERE id = ?1",
                rusqlite::params![prompt_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )?;

        // Get next version number
        let version_number: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version_number), 0) + 1 FROM prompt_versions WHERE prompt_id = ?1",
                rusqlite::params![prompt_id],
                |row| row.get(0),
            )?;

        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO prompt_versions (id, prompt_id, version_number, title, content, description, tags, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, prompt_id, version_number, title, content, description, tags_json, now],
        )?;

        Ok(version_number)
    })
}

/// Get all versions of a prompt
pub fn get_versions(db: &Database, prompt_id: &str) -> Result<Vec<PromptVersion>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, prompt_id, version_number, title, content, description, tags, created_at
             FROM prompt_versions
             WHERE prompt_id = ?1
             ORDER BY version_number DESC",
        )?;

        let rows = stmt.query_map(rusqlite::params![prompt_id], |row| {
            let tags_json: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            Ok(PromptVersion {
                id: row.get(0)?,
                prompt_id: row.get(1)?,
                version_number: row.get(2)?,
                title: row.get(3)?,
                content: row.get(4)?,
                description: row.get(5)?,
                tags,
                created_at: row.get(7)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Restore a specific version (copies version content to current prompt)
pub fn restore_version(db: &Database, prompt_id: &str, version_id: &str) -> Result<(), String> {
    // First save current state as a new version
    let _ = save_version(db, prompt_id)?;

    // Then copy the target version's content to the current prompt
    db.write(|conn| {
        let (title, content, description, tags_json): (String, String, String, String) =
            conn.query_row(
                "SELECT title, content, description, tags FROM prompt_versions WHERE id = ?1",
                rusqlite::params![version_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE prompt_templates SET title = ?2, content = ?3, description = ?4, tags = ?5, updated_at = ?6
             WHERE id = ?1",
            rusqlite::params![prompt_id, title, content, description, tags_json, now],
        )?;

        Ok(())
    })
}
