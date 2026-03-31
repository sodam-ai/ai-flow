-- Phase 2: Smart AI routing rules
-- Routes prompts to the optimal AI based on complexity scoring.

CREATE TABLE IF NOT EXISTS routing_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    -- Complexity thresholds: score 0~100
    min_complexity INTEGER NOT NULL DEFAULT 0,
    max_complexity INTEGER NOT NULL DEFAULT 100,
    -- Target AI
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    -- Fallback chain (JSON array of {provider_id, model_id})
    fallback_chain TEXT NOT NULL DEFAULT '[]',
    -- Priority (higher = checked first)
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add routing metadata to messages
ALTER TABLE messages ADD COLUMN routed_by TEXT;          -- routing_rule id or NULL (manual)
ALTER TABLE messages ADD COLUMN complexity_score INTEGER; -- 0~100
ALTER TABLE messages ADD COLUMN cost_saved_usd REAL;     -- estimated savings from smart routing

-- Default routing rules (inserted via Rust migration hook, not SQL)
-- Simple (0~30): Gemini Flash (cheapest)
-- Medium (31~60): Claude Sonnet (balanced)
-- Complex (61~100): GPT-4o (most capable)

CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON routing_rules(is_active, priority DESC);
