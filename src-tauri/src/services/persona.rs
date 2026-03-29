use anyhow::{anyhow, Result};
use chrono::Utc;
use std::sync::Arc;

use crate::db::Database;
use crate::models::persona::Persona;

pub struct PersonaService {
    db: Arc<Database>,
}

impl PersonaService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    pub fn list_personas(&self) -> Result<Vec<Persona>> {
        self.db.read(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, system_prompt, avatar_emoji, is_default, created_at, updated_at
                 FROM personas
                 ORDER BY is_default DESC, created_at ASC",
            )?;
            let rows: rusqlite::Result<Vec<Persona>> = stmt
                .query_map([], |row| {
                    Ok(Persona {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        system_prompt: row.get(2)?,
                        avatar_emoji: row.get(3)?,
                        is_default: row.get::<_, i32>(4)? != 0,
                        created_at: row.get::<_, String>(5)?.parse().unwrap_or_default(),
                        updated_at: row.get::<_, String>(6)?.parse().unwrap_or_default(),
                    })
                })?
                .collect();
            rows.map_err(Into::into)
        })
    }

    pub async fn create_persona(
        &self,
        name: String,
        system_prompt: String,
        avatar_emoji: String,
    ) -> Result<Persona> {
        let persona = Persona::new(name, system_prompt, avatar_emoji);
        let p = persona.clone();
        self.db
            .write(move |conn| {
                conn.execute(
                    "INSERT INTO personas (id, name, system_prompt, avatar_emoji, is_default, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
                    rusqlite::params![
                        p.id, p.name, p.system_prompt, p.avatar_emoji,
                        p.created_at.to_rfc3339(), p.updated_at.to_rfc3339()
                    ],
                )?;
                Ok(())
            })
            .await?;
        Ok(persona)
    }

    pub async fn update_persona(
        &self,
        id: String,
        name: String,
        system_prompt: String,
        avatar_emoji: String,
    ) -> Result<Persona> {
        let now_str = Utc::now().to_rfc3339();
        let id2 = id.clone();
        self.db
            .write(move |conn| {
                conn.execute(
                    "UPDATE personas SET name = ?1, system_prompt = ?2, avatar_emoji = ?3, updated_at = ?4
                     WHERE id = ?5",
                    rusqlite::params![name, system_prompt, avatar_emoji, now_str, id2],
                )?;
                Ok(())
            })
            .await?;

        self.db.read(move |conn| {
            conn.query_row(
                "SELECT id, name, system_prompt, avatar_emoji, is_default, created_at, updated_at
                 FROM personas WHERE id = ?1",
                rusqlite::params![id],
                |row| {
                    Ok(Persona {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        system_prompt: row.get(2)?,
                        avatar_emoji: row.get(3)?,
                        is_default: row.get::<_, i32>(4)? != 0,
                        created_at: row.get::<_, String>(5)?.parse().unwrap_or_default(),
                        updated_at: row.get::<_, String>(6)?.parse().unwrap_or_default(),
                    })
                },
            )
            .map_err(Into::into)
        })
    }

    pub async fn delete_persona(&self, id: String) -> Result<()> {
        // 기본 페르소나 삭제 방지
        let is_default = self.db.read(|conn| {
            let v: i32 = conn
                .query_row(
                    "SELECT is_default FROM personas WHERE id = ?1",
                    rusqlite::params![id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            Ok::<i32, anyhow::Error>(v)
        })?;

        if is_default != 0 {
            return Err(anyhow!("Cannot delete a built-in persona"));
        }

        let id2 = id.clone();
        self.db
            .write(move |conn| {
                conn.execute("DELETE FROM personas WHERE id = ?1", rusqlite::params![id2])?;
                Ok(())
            })
            .await
    }
}
