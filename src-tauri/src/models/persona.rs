use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Persona {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub system_prompt: String,
    pub icon: String,
    pub color: String,
    pub is_builtin: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePersonaInput {
    pub name: String,
    pub description: Option<String>,
    pub system_prompt: String,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePersonaInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub system_prompt: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_active: Option<bool>,
}
