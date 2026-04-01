-- Phase 2: Batch Processing Queue
CREATE TABLE IF NOT EXISTS batch_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    workflow_id INTEGER REFERENCES workflows(id),  -- nullable: 단순 배치는 workflow 없이도 가능
    provider TEXT,
    model TEXT,
    system_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    output_dir TEXT,                               -- 결과 파일 저장 경로
    total_cost_usd REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL DEFAULT 0,
    input_text TEXT,
    input_file_path TEXT,                          -- 파일 입력인 경우
    output_text TEXT,
    output_file_path TEXT,                         -- 결과 파일 저장 경로
    status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'running' | 'completed' | 'failed'
    error_message TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    processed_at TEXT
);
