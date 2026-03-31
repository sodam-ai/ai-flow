-- Phase 2: Multi-AI comparison groups
-- A comparison group links 2~3 simultaneous AI responses for side-by-side viewing.
-- The "adopted" message is the one the user selects as the best response.

CREATE TABLE IF NOT EXISTS comparison_groups (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    adopted_message_id TEXT,  -- NULL until user picks a winner
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Link table: each comparison group has 2~3 AI response messages
CREATE TABLE IF NOT EXISTS comparison_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES comparison_groups(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    stream_index INTEGER NOT NULL,  -- 0, 1, 2 for UI column position
    is_adopted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add comparison_group_id to messages for quick lookup
ALTER TABLE messages ADD COLUMN comparison_group_id TEXT REFERENCES comparison_groups(id);

CREATE INDEX IF NOT EXISTS idx_comparison_groups_conv ON comparison_groups(conversation_id);
CREATE INDEX IF NOT EXISTS idx_comparison_members_group ON comparison_members(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_comparison ON messages(comparison_group_id);
