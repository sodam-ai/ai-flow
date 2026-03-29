-- AIFlow Core Schema
-- providers: API 키 참조 (실제 키는 OS 키체인에만 저장)
CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    -- keychain_key: "aiflow/<provider_id>" 참조 문자열만 저장
    keychain_key TEXT NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 기본 provider 데이터
INSERT OR IGNORE INTO providers (id, display_name, keychain_key, is_active) VALUES
    ('openai',    'OpenAI',         'aiflow/openai_api_key',    0),
    ('anthropic', 'Anthropic',      'aiflow/anthropic_api_key', 0),
    ('google',    'Google',         'aiflow/google_api_key',    0),
    ('ollama',    'Ollama (Local)', 'aiflow/ollama_base_url',   0);

-- settings: 비암호화 설정값 (Tauri Store Plugin 보완)
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- audit_logs: 보안 감사 로그
CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    detail      TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
