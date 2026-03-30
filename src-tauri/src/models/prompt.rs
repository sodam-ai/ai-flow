use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub title: String,
    pub content: String,
    pub description: String,
    pub tags: Vec<String>,
    pub variables: Vec<String>,
    pub is_favorite: bool,
    pub use_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePromptInput {
    pub title: String,
    pub content: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePromptInput {
    pub title: Option<String>,
    pub content: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: Option<bool>,
}
