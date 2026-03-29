use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;

use crate::db::Database;
use crate::models::prompt::Prompt;

pub struct PromptService {
    db: Arc<Database>,
}

impl PromptService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    pub fn list_prompts(&self, category: Option<String>) -> Result<Vec<Prompt>> {
        self.db.read(move |conn| {
            let sql = if category.is_some() {
                "SELECT id, title, content, category, tags, use_count, created_at, updated_at
                 FROM prompts WHERE category = ?1
                 ORDER BY use_count DESC, updated_at DESC"
            } else {
                "SELECT id, title, content, category, tags, use_count, created_at, updated_at
                 FROM prompts
                 ORDER BY use_count DESC, updated_at DESC"
            };

            let mut stmt = conn.prepare(sql)?;

            let rows: rusqlite::Result<Vec<Prompt>> = if let Some(cat) = &category {
                stmt.query_map(rusqlite::params![cat], map_prompt_row)?
                    .collect()
            } else {
                stmt.query_map([], map_prompt_row)?.collect()
            };
            rows.map_err(Into::into)
        })
    }

    pub async fn create_prompt(
        &self,
        title: String,
        content: String,
        category: Option<String>,
        tags: Vec<String>,
    ) -> Result<Prompt> {
        let mut prompt = Prompt::new(title, content);
        prompt.category = category;
        prompt.tags = tags;

        let p = prompt.clone();
        let tags_json = serde_json::to_string(&p.tags)?;

        self.db
            .write(move |conn| {
                conn.execute(
                    "INSERT INTO prompts (id, title, content, category, tags, use_count, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)",
                    rusqlite::params![
                        p.id, p.title, p.content, p.category, tags_json,
                        p.created_at.to_rfc3339(), p.updated_at.to_rfc3339()
                    ],
                )?;
                Ok(())
            })
            .await?;
        Ok(prompt)
    }

    pub async fn update_prompt(
        &self,
        id: String,
        title: String,
        content: String,
        category: Option<String>,
        tags: Vec<String>,
    ) -> Result<Prompt> {
        let now_str = Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&tags)?;
        let id2 = id.clone();

        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE prompts SET title = ?1, content = ?2, category = ?3, tags = ?4, updated_at = ?5
                     WHERE id = ?6",
                    rusqlite::params![title, content, category, tags_json, now_str, id2],
                )?;
                Ok(())
            })
            .await?;

        self.db.read(move |conn| {
            conn.query_row(
                "SELECT id, title, content, category, tags, use_count, created_at, updated_at
                 FROM prompts WHERE id = ?1",
                rusqlite::params![id],
                map_prompt_row,
            )
            .map_err(Into::into)
        })
    }

    pub async fn delete_prompt(&self, id: String) -> Result<()> {
        self.db
            .write(move |conn| {
                conn.execute("DELETE FROM prompts WHERE id = ?1", rusqlite::params![id])?;
                Ok(())
            })
            .await
    }

    /// 프롬프트 사용 횟수 증가
    pub async fn increment_use_count(&self, id: String) -> Result<()> {
        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE prompts SET use_count = use_count + 1 WHERE id = ?1",
                    rusqlite::params![id],
                )?;
                Ok(())
            })
            .await
    }
}

fn map_prompt_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prompt> {
    let tags_json: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    Ok(Prompt {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        category: row.get(3)?,
        tags,
        use_count: row.get(5)?,
        created_at: row.get::<_, String>(6)?.parse().unwrap_or_default(),
        updated_at: row.get::<_, String>(7)?.parse().unwrap_or_default(),
    })
}
