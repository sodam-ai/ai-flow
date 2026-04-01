use crate::{db::pool::Database, models::knowledge_base::*};
use rusqlite::params;
use std::{path::Path, sync::Arc};

const MAX_QUERY_LEN: usize = 500;
const MAX_CHUNK_SIZE: usize = 1000; // characters per chunk
const CHUNK_OVERLAP: usize = 100;   // overlap between chunks

// ─── Knowledge Base CRUD ──────────────────────────────────────────────────

pub fn list_kbs(db: &Arc<Database>) -> Result<Vec<KnowledgeBase>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, folder_path, icon, doc_count, is_active, created_at, updated_at
             FROM knowledge_bases WHERE is_active=1 ORDER BY updated_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(KnowledgeBase {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    folder_path: row.get(3)?,
                    icon: row.get(4)?,
                    doc_count: row.get(5)?,
                    is_active: row.get::<_, i64>(6)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })
}

pub fn create_kb(db: &Arc<Database>, req: CreateKbRequest) -> Result<KnowledgeBase, String> {
    if req.name.trim().is_empty() || req.name.len() > 100 {
        return Err("지식베이스 이름은 1~100자여야 합니다.".into());
    }

    let icon = req.icon.unwrap_or_else(|| "database".to_string());

    let id = db.write(|conn| {
        conn.execute(
            "INSERT INTO knowledge_bases (name, description, icon) VALUES (?1, ?2, ?3)",
            params![req.name.trim(), req.description, icon],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    get_kb(db, id)
}

pub fn get_kb(db: &Arc<Database>, id: i64) -> Result<KnowledgeBase, String> {
    db.read(|conn| {
        conn.query_row(
            "SELECT id, name, description, folder_path, icon, doc_count, is_active, created_at, updated_at
             FROM knowledge_bases WHERE id=?1",
            params![id],
            |row| {
                Ok(KnowledgeBase {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    folder_path: row.get(3)?,
                    icon: row.get(4)?,
                    doc_count: row.get(5)?,
                    is_active: row.get::<_, i64>(6)? == 1,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
    })
    .map_err(|e| format!("지식베이스를 찾을 수 없습니다: {}", e))
}

pub fn delete_kb(db: &Arc<Database>, id: i64) -> Result<(), String> {
    if id == 1 {
        return Err("기본 지식베이스는 삭제할 수 없습니다.".into());
    }
    db.write(|conn| {
        conn.execute("UPDATE knowledge_bases SET is_active=0 WHERE id=?1", params![id])?;
        Ok(())
    })
}

// ─── Document Management ──────────────────────────────────────────────────

pub fn list_documents(db: &Arc<Database>, kb_id: i64) -> Result<Vec<KbDocument>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, kb_id, filename, file_path, file_type, file_size, chunk_count,
                    status, error_msg, indexed_at, created_at
             FROM kb_documents WHERE kb_id=?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(params![kb_id], |row| {
                Ok(KbDocument {
                    id: row.get(0)?,
                    kb_id: row.get(1)?,
                    filename: row.get(2)?,
                    file_path: row.get(3)?,
                    file_type: row.get(4)?,
                    file_size: row.get(5)?,
                    chunk_count: row.get(6)?,
                    status: row.get(7)?,
                    error_msg: row.get(8)?,
                    indexed_at: row.get(9)?,
                    created_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })
}

pub fn delete_document(db: &Arc<Database>, doc_id: i64) -> Result<(), String> {
    db.write(|conn| {
        conn.execute("DELETE FROM kb_documents WHERE id=?1", params![doc_id])?;
        Ok(())
    })
}

/// Index a document: extract text → split into chunks → insert into FTS5
pub fn index_document(db: &Arc<Database>, req: IndexDocumentRequest) -> Result<KbDocument, String> {
    // Security: validate path is absolute and exists
    let path = Path::new(&req.file_path);
    if !path.is_absolute() {
        return Err("파일 경로는 절대 경로여야 합니다.".into());
    }
    if !path.exists() {
        return Err("파일이 존재하지 않습니다.".into());
    }

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let allowed = ["txt", "md", "rs", "py", "ts", "tsx", "js", "json", "toml", "yaml", "yml", "csv"];
    if !allowed.contains(&extension.as_str()) {
        return Err(format!("지원하지 않는 파일 형식입니다: .{}", extension));
    }

    let file_size = std::fs::metadata(&req.file_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    if file_size > 5 * 1024 * 1024 {
        return Err("파일 크기는 5MB 이하여야 합니다.".into());
    }

    let content = std::fs::read_to_string(&req.file_path)
        .map_err(|e| format!("파일 읽기 실패: {}", e))?;

    // Insert document record, get ID
    let doc_id = db.write(|conn| {
        conn.execute(
            "INSERT INTO kb_documents (kb_id, filename, file_path, file_type, file_size, status)
             VALUES (?1, ?2, ?3, ?4, ?5, 'indexing')",
            params![req.kb_id, filename, req.file_path, extension, file_size],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    // Split into chunks and insert
    let chunks = split_into_chunks(&content, MAX_CHUNK_SIZE, CHUNK_OVERLAP);
    let chunk_count = chunks.len() as i64;

    db.write(|conn| {
        for (i, chunk) in chunks.iter().enumerate() {
            conn.execute(
                "INSERT INTO kb_chunks (doc_id, kb_id, chunk_index, content, char_count)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![doc_id, req.kb_id, i as i64, chunk, chunk.len() as i64],
            )?;
        }
        conn.execute(
            "UPDATE kb_documents SET status='ready', chunk_count=?1, indexed_at=datetime('now') WHERE id=?2",
            params![chunk_count, doc_id],
        )?;
        Ok(())
    })?;

    get_document(db, doc_id)
}

fn get_document(db: &Arc<Database>, doc_id: i64) -> Result<KbDocument, String> {
    db.read(|conn| {
        conn.query_row(
            "SELECT id, kb_id, filename, file_path, file_type, file_size, chunk_count,
                    status, error_msg, indexed_at, created_at
             FROM kb_documents WHERE id=?1",
            params![doc_id],
            |row| {
                Ok(KbDocument {
                    id: row.get(0)?,
                    kb_id: row.get(1)?,
                    filename: row.get(2)?,
                    file_path: row.get(3)?,
                    file_type: row.get(4)?,
                    file_size: row.get(5)?,
                    chunk_count: row.get(6)?,
                    status: row.get(7)?,
                    error_msg: row.get(8)?,
                    indexed_at: row.get(9)?,
                    created_at: row.get(10)?,
                })
            },
        )
    })
    .map_err(|e| e.to_string())
}

// ─── Search ───────────────────────────────────────────────────────────────

pub fn search_kb(db: &Arc<Database>, req: SearchKbRequest) -> Result<Vec<KbSearchResult>, String> {
    if req.query.trim().is_empty() {
        return Err("검색어를 입력하세요.".into());
    }
    if req.query.len() > MAX_QUERY_LEN {
        return Err(format!("검색어는 {}자 이하여야 합니다.", MAX_QUERY_LEN));
    }

    let limit = req.limit.unwrap_or(10).min(50);
    let safe_query = sanitize_fts_query(&req.query);
    let kb_id = req.kb_id;

    db.read(|conn| {
        let sql = if let Some(kid) = kb_id {
            format!(
                "SELECT c.id, c.doc_id, c.kb_id, d.filename, c.content,
                        snippet(kb_chunks_fts, 0, '<mark>', '</mark>', '…', 32) as snippet,
                        kb_chunks_fts.rank
                 FROM kb_chunks_fts
                 JOIN kb_chunks c ON kb_chunks_fts.rowid = c.id
                 JOIN kb_documents d ON c.doc_id = d.id
                 WHERE kb_chunks_fts MATCH ?1 AND c.kb_id = {}
                 ORDER BY rank LIMIT ?2",
                kid
            )
        } else {
            "SELECT c.id, c.doc_id, c.kb_id, d.filename, c.content,
                    snippet(kb_chunks_fts, 0, '<mark>', '</mark>', '…', 32) as snippet,
                    kb_chunks_fts.rank
             FROM kb_chunks_fts
             JOIN kb_chunks c ON kb_chunks_fts.rowid = c.id
             JOIN kb_documents d ON c.doc_id = d.id
             WHERE kb_chunks_fts MATCH ?1
             ORDER BY rank LIMIT ?2"
                .to_string()
        };

        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map(params![safe_query, limit], |row| {
                Ok(KbSearchResult {
                    chunk_id: row.get(0)?,
                    doc_id: row.get(1)?,
                    kb_id: row.get(2)?,
                    filename: row.get(3)?,
                    content: row.get(4)?,
                    snippet: row.get(5)?,
                    rank: row.get::<_, f64>(6)?.abs(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(results)
    })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

fn split_into_chunks(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    if text.len() <= chunk_size {
        return vec![text.to_string()];
    }

    let chars: Vec<char> = text.chars().collect();
    let mut chunks = Vec::new();
    let mut start = 0;

    while start < chars.len() {
        let end = (start + chunk_size).min(chars.len());
        let chunk: String = chars[start..end].iter().collect();
        chunks.push(chunk);

        if end == chars.len() {
            break;
        }
        start += chunk_size.saturating_sub(overlap);
    }

    chunks
}

/// Sanitize user query for FTS5 to prevent injection
fn sanitize_fts_query(query: &str) -> String {
    let words: Vec<String> = query
        .split_whitespace()
        .take(20)
        .map(|w| {
            let clean: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || c.is_alphabetic())
                .collect();
            if clean.is_empty() {
                String::new()
            } else {
                format!("\"{}\"", clean)
            }
        })
        .filter(|w| !w.is_empty())
        .collect();

    if words.is_empty() {
        "\"\"".to_string()
    } else {
        words.join(" OR ")
    }
}
