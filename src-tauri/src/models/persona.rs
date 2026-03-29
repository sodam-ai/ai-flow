use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
    pub avatar_emoji: String,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Persona {
    pub fn new(name: String, system_prompt: String, avatar_emoji: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            system_prompt,
            avatar_emoji,
            is_default: false,
            created_at: now,
            updated_at: now,
        }
    }
}
