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

/// Index all supported files in a folder (non-recursive by default).
/// Returns a summary: { indexed, skipped, failed, errors }
#[tauri::command]
pub async fn index_folder(
    kb_id: i64,
    folder_path: String,
    recursive: Option<bool>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    use std::path::Path;

    let path = Path::new(&folder_path);
    if !path.is_absolute() {
        return Err("폴더 경로는 절대 경로여야 합니다.".into());
    }
    // Canonicalize resolves symlinks and `../` traversal before directory check
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| "폴더 경로를 확인할 수 없습니다.".to_string())?;
    let path = canonical.as_path(); // reborrow as &Path so downstream code stays unchanged
    if !path.is_dir() {
        return Err("유효한 폴더 경로가 아닙니다.".into());
    }

    let allowed_exts = ["txt", "md", "rs", "py", "ts", "tsx", "js", "json", "toml", "yaml", "yml", "csv"];
    let do_recursive = recursive.unwrap_or(false);

    let mut indexed = 0u32;
    let mut skipped = 0u32;
    let mut failed = 0u32;
    let mut errors: Vec<String> = Vec::new();

    // Collect file paths
    let entries: Vec<std::path::PathBuf> = if do_recursive {
        collect_files_recursive(path, &allowed_exts)
    } else {
        std::fs::read_dir(path)
            .map_err(|e| format!("폴더 읽기 실패: {}", e))?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.is_file())
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| allowed_exts.contains(&e.to_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .collect()
    };

    // Cap at 200 files per call to prevent runaway DB writes
    let entries: Vec<_> = entries.into_iter().take(200).collect();

    for file_path in entries {
        let path_str = match file_path.to_str() {
            Some(s) => s.to_string(),
            None => { skipped += 1; continue; }
        };

        // Skip files > 5MB (same limit as index_document)
        let size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);
        if size > 5 * 1024 * 1024 {
            skipped += 1;
            continue;
        }

        let req = crate::models::knowledge_base::IndexDocumentRequest {
            kb_id,
            file_path: path_str.clone(),
        };

        match knowledge_base::index_document(&state.db, req) {
            Ok(_) => indexed += 1,
            Err(e) => {
                failed += 1;
                if errors.len() < 10 {
                    errors.push(format!("{}: {}", file_path.file_name().and_then(|n| n.to_str()).unwrap_or("?"), e));
                }
            }
        }
    }

    Ok(serde_json::json!({
        "indexed": indexed,
        "skipped": skipped,
        "failed": failed,
        "errors": errors,
    }))
}

fn collect_files_recursive(dir: &std::path::Path, allowed_exts: &[&str]) -> Vec<std::path::PathBuf> {
    let mut result = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.is_dir() {
                // Skip hidden dirs and common non-source dirs
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" {
                    continue;
                }
                result.extend(collect_files_recursive(&p, allowed_exts));
            } else if p.is_file() {
                let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase());
                if ext.as_deref().map(|e| allowed_exts.contains(&e)).unwrap_or(false) {
                    result.push(p);
                }
            }
        }
    }
    result
}
