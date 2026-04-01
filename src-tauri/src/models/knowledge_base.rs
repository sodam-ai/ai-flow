use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeBase {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub folder_path: Option<String>,
    pub icon: String,
    pub doc_count: i64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KbDocument {
    pub id: i64,
    pub kb_id: i64,
    pub filename: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i64,
    pub chunk_count: i64,
    pub status: String,
    pub error_msg: Option<String>,
    pub indexed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KbChunk {
    pub id: i64,
    pub doc_id: i64,
    pub kb_id: i64,
    pub chunk_index: i64,
    pub content: String,
    pub char_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KbSearchResult {
    pub chunk_id: i64,
    pub doc_id: i64,
    pub kb_id: i64,
    pub filename: String,
    pub content: String,
    pub snippet: String,
    pub rank: f64,
}

// ─── Requests ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateKbRequest {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateKbRequest {
    pub id: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexDocumentRequest {
    pub kb_id: i64,
    /// Absolute path validated by Tauri fs plugin
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchKbRequest {
    pub kb_id: Option<i64>,  // None = search all bases
    pub query: String,
    pub limit: Option<i64>,
}
