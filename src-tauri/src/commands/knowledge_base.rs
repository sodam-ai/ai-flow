use crate::{
    models::knowledge_base::*,
    services::knowledge_base,
    AppState,
};
use tauri::State;

#[tauri::command]
pub fn list_knowledge_bases(state: State<AppState>) -> Result<Vec<KnowledgeBase>, String> {
    knowledge_base::list_kbs(&state.db)
}

#[tauri::command]
pub fn create_knowledge_base(
    req: CreateKbRequest,
    state: State<AppState>,
) -> Result<KnowledgeBase, String> {
    knowledge_base::create_kb(&state.db, req)
}

#[tauri::command]
pub fn delete_knowledge_base(id: i64, state: State<AppState>) -> Result<(), String> {
    knowledge_base::delete_kb(&state.db, id)
}

#[tauri::command]
pub fn list_kb_documents(kb_id: i64, state: State<AppState>) -> Result<Vec<KbDocument>, String> {
    knowledge_base::list_documents(&state.db, kb_id)
}

#[tauri::command]
pub fn index_document(
    req: IndexDocumentRequest,
    state: State<AppState>,
) -> Result<KbDocument, String> {
    knowledge_base::index_document(&state.db, req)
}

#[tauri::command]
pub fn delete_kb_document(doc_id: i64, state: State<AppState>) -> Result<(), String> {
    knowledge_base::delete_document(&state.db, doc_id)
}

#[tauri::command]
pub fn search_knowledge_base(
    req: SearchKbRequest,
    state: State<AppState>,
) -> Result<Vec<KbSearchResult>, String> {
    knowledge_base::search_kb(&state.db, req)
}
