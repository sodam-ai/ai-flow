-- Migration 016: Knowledge Base (RAG) + FTS5 full-text search
-- Phase 3: Personal AI knowledge base from local documents

-- Knowledge bases (collections of documents)
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    folder_path TEXT,          -- watched folder (optional)
    icon        TEXT NOT NULL DEFAULT 'database',
    doc_count   INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents indexed into a knowledge base
CREATE TABLE IF NOT EXISTS kb_documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kb_id           INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    file_path       TEXT NOT NULL,
    file_type       TEXT NOT NULL,   -- pdf, md, txt, docx
    file_size       INTEGER NOT NULL DEFAULT 0,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending, indexing, ready, error
    error_msg       TEXT,
    indexed_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Text chunks extracted from documents (for retrieval)
CREATE TABLE IF NOT EXISTS kb_chunks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id      INTEGER NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    kb_id       INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content     TEXT NOT NULL,
    char_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 virtual table for full-text search over chunks
CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
    content,
    content='kb_chunks',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS5 in sync with kb_chunks
CREATE TRIGGER IF NOT EXISTS kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
    INSERT INTO kb_chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS kb_chunks_ad AFTER DELETE ON kb_chunks BEGIN
    INSERT INTO kb_chunks_fts(kb_chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

-- Update doc_count trigger
CREATE TRIGGER IF NOT EXISTS kb_doc_count_update AFTER UPDATE ON kb_documents
WHEN new.status = 'ready' AND old.status != 'ready'
BEGIN
    UPDATE knowledge_bases SET doc_count = doc_count + 1, updated_at = datetime('now')
    WHERE id = new.kb_id;
END;

-- Default knowledge base
INSERT OR IGNORE INTO knowledge_bases (id, name, description, icon) VALUES
(1, '기본 지식베이스', '문서를 추가하여 AI와 함께 분석하세요', 'database');
