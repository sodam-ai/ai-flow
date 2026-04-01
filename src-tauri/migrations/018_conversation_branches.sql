-- Migration 018: Conversation branching + workflow export metadata
-- Phase 3: Fork conversations from any message point

-- Conversation branches (forks from a parent message)
CREATE TABLE IF NOT EXISTS conversation_branches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_conversation_id TEXT NOT NULL,  -- original conversation
    branch_conversation_id TEXT NOT NULL,  -- forked conversation id
    fork_message_id     TEXT NOT NULL,     -- message we branched from
    fork_message_index  INTEGER NOT NULL DEFAULT 0,
    label               TEXT,              -- user-defined branch label
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient branch lookup
CREATE INDEX IF NOT EXISTS idx_branches_parent ON conversation_branches(parent_conversation_id);
CREATE INDEX IF NOT EXISTS idx_branches_fork_msg ON conversation_branches(fork_message_id);

-- Workflow export/import metadata
CREATE TABLE IF NOT EXISTS workflow_exports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id     INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    export_version  TEXT NOT NULL DEFAULT '1.0',
    exported_at     TEXT NOT NULL DEFAULT (datetime('now')),
    checksum        TEXT                -- SHA-256 of export JSON
);

-- Conditional workflow nodes (Phase 3: if/else branching in workflows)
CREATE TABLE IF NOT EXISTS workflow_conditions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id         INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_id             INTEGER NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    condition_type      TEXT NOT NULL DEFAULT 'contains',
    -- condition_type: contains | not_contains | length_gt | length_lt | regex_match
    condition_value     TEXT NOT NULL,
    true_next_step_id   INTEGER REFERENCES workflow_steps(id),
    false_next_step_id  INTEGER REFERENCES workflow_steps(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
