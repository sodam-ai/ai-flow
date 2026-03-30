-- Phase 1b: Message Versions (AI regeneration with version history)
-- When user regenerates an AI response, the original is preserved as a version
-- and new content replaces the message. Users can navigate between versions.

CREATE TABLE IF NOT EXISTS message_versions (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_message_versions_message ON message_versions(message_id, version_number);

-- Add version tracking to messages table
ALTER TABLE messages ADD COLUMN version_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE messages ADD COLUMN active_version INTEGER NOT NULL DEFAULT 1;
