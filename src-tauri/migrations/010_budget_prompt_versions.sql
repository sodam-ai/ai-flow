-- Phase 2: Monthly budget + prompt version history

-- Budget settings
CREATE TABLE IF NOT EXISTS budget_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    monthly_budget_usd REAL NOT NULL DEFAULT 10.0,
    alert_threshold_pct INTEGER NOT NULL DEFAULT 80,  -- alert at this % of budget
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default budget
INSERT OR IGNORE INTO budget_settings (id, monthly_budget_usd, alert_threshold_pct, is_active)
VALUES ('default', 10.0, 80, 1);

-- Prompt version history (auto-saved on edit)
CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON prompt_versions(prompt_id, version_number DESC);
