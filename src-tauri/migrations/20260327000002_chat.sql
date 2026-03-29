-- AIFlow Chat Schema
CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    provider_id     TEXT NOT NULL REFERENCES providers(id),
    model_id        TEXT NOT NULL,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    total_cost_usd  REAL NOT NULL DEFAULT 0.0,
    is_pinned       INTEGER NOT NULL DEFAULT 0,
    is_private      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_is_pinned  ON conversations(is_pinned);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    tokens_used     INTEGER,
    cost_usd        REAL,
    model_id        TEXT,
    is_redacted     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
