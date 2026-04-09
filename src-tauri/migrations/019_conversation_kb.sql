-- Migration 019: Per-conversation active Knowledge Base IDs
-- Phase 10: Persist active KB context across sessions
--
-- Purpose: Remember which KBs were active in each conversation so that the
-- KbContextBar chip state survives app restart and conversation switching.
--
-- Storage format: JSON array of positive integers, e.g. '[1,3,7]'
-- Max enforced in Rust command (20 IDs max) — SQLite doesn't enforce JSON schema.
--
-- Security notes:
--   - No FK to knowledge_bases(id) — KB deletion leaves stale IDs harmlessly
--     (loader filters them out via existence check).
--   - Default '[]' ensures non-NULL for all existing rows (zero-friction migration).
--   - Data type TEXT (not BLOB) — JSON is human-inspectable for debugging.

ALTER TABLE conversations
    ADD COLUMN active_kb_ids TEXT NOT NULL DEFAULT '[]';
