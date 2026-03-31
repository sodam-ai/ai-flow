-- Phase 2: Privacy logs + Local LLM registry

-- Privacy: record PII detections (100% local, never sent to internet)
CREATE TABLE IF NOT EXISTS privacy_logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    pii_type TEXT NOT NULL,         -- 'phone', 'email', 'ssn', 'account', etc.
    pii_count INTEGER NOT NULL DEFAULT 1,
    was_masked INTEGER NOT NULL DEFAULT 1,  -- 1 = sent masked, 0 = user sent anyway
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Local LLM: discovered Ollama/LM Studio instances
CREATE TABLE IF NOT EXISTS local_llm_endpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,              -- 'Ollama', 'LM Studio'
    base_url TEXT NOT NULL UNIQUE,   -- 'http://localhost:11434'
    api_type TEXT NOT NULL,          -- 'ollama' | 'openai_compat'
    is_active INTEGER NOT NULL DEFAULT 1,
    last_seen_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cached local model list (refreshed on each detect scan)
CREATE TABLE IF NOT EXISTS local_llm_models (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL REFERENCES local_llm_endpoints(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,        -- e.g. 'llama3:8b', 'mistral:7b'
    model_size TEXT,                 -- e.g. '4.7 GB'
    parameter_count TEXT,            -- e.g. '8B'
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_privacy_logs_conv ON privacy_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_local_models_endpoint ON local_llm_models(endpoint_id);
