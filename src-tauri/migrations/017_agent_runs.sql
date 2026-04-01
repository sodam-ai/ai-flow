-- Migration 017: AI Agent runs with approval gates
-- Phase 3: Autonomous multi-step AI agent execution

-- Agent run sessions
CREATE TABLE IF NOT EXISTS agent_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,              -- linked conversation (nullable)
    goal            TEXT NOT NULL,     -- what the agent is trying to accomplish
    status          TEXT NOT NULL DEFAULT 'running',
    -- status: running | awaiting_approval | completed | failed | cancelled
    provider        TEXT NOT NULL DEFAULT 'anthropic',
    model           TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    total_steps     INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    total_cost_usd  REAL NOT NULL DEFAULT 0.0,
    final_output    TEXT,
    error_msg       TEXT,
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

-- Individual steps within an agent run
CREATE TABLE IF NOT EXISTS agent_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    step_order      INTEGER NOT NULL DEFAULT 0,
    step_type       TEXT NOT NULL DEFAULT 'think',
    -- step_type: think | action | approval_gate | search_kb | web_search | code
    title           TEXT NOT NULL,
    description     TEXT,
    input_text      TEXT,
    output_text     TEXT,
    tool_name       TEXT,              -- tool used (if action step)
    tool_args       TEXT,              -- JSON args for tool
    tool_result     TEXT,              -- tool execution result
    requires_approval INTEGER NOT NULL DEFAULT 0,
    approval_message  TEXT,            -- shown to user for approval
    approved        INTEGER,           -- NULL=pending, 1=approved, 0=denied
    approved_at     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- status: pending | running | awaiting_approval | completed | failed | skipped
    cost_usd        REAL NOT NULL DEFAULT 0.0,
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    started_at      TEXT,
    completed_at    TEXT
);

-- Agent tool definitions (what tools an agent can use)
CREATE TABLE IF NOT EXISTS agent_tools (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    parameters_json TEXT NOT NULL DEFAULT '{}',
    is_enabled      INTEGER NOT NULL DEFAULT 1,
    requires_approval INTEGER NOT NULL DEFAULT 0,  -- always ask before running
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed built-in agent tools
INSERT OR IGNORE INTO agent_tools (name, description, parameters_json, requires_approval) VALUES
('search_knowledge_base', '개인 지식베이스에서 관련 정보를 검색합니다', '{"query": "string"}', 0),
('read_file', '로컬 파일의 내용을 읽습니다', '{"path": "string"}', 1),
('write_file', '로컬 파일에 내용을 씁니다', '{"path": "string", "content": "string"}', 1),
('run_workflow', '저장된 워크플로우를 실행합니다', '{"workflow_id": "number", "input": "string"}', 1),
('web_search', '웹에서 정보를 검색합니다 (Brave/DuckDuckGo API)', '{"query": "string"}', 0),
('summarize_text', '긴 텍스트를 요약합니다', '{"text": "string", "max_words": "number"}', 0);
