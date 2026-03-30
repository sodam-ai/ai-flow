-- Phase 1b: Prompt Templates (CRUD + tags + {{variable}} slots)
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    variables TEXT NOT NULL DEFAULT '[]',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_title ON prompt_templates(title);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_favorite ON prompt_templates(is_favorite DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_use_count ON prompt_templates(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated ON prompt_templates(updated_at DESC);
