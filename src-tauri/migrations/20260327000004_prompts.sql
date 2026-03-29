-- AIFlow Prompts Schema
CREATE TABLE IF NOT EXISTS prompts (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    category    TEXT,
    tags        TEXT NOT NULL DEFAULT '[]',  -- JSON 배열
    use_count   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_prompts_use_count ON prompts(use_count DESC);
CREATE INDEX idx_prompts_category  ON prompts(category);
