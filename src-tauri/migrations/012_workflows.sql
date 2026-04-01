-- Phase 2: Workflow Builder
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    template_id INTEGER,                           -- FK → workflow_templates.id (nullable)
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    provider TEXT,                                 -- provider slug (e.g. 'openai', 'anthropic')
    model TEXT,                                    -- model id
    system_prompt TEXT,
    user_prompt_template TEXT NOT NULL DEFAULT '{{input}}',  -- {{input}} = 이전 단계 출력
    mcp_server_id INTEGER REFERENCES mcp_servers(id),        -- MCP 도구 연동 (optional)
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'running' | 'completed' | 'failed'
    initial_input TEXT NOT NULL,
    final_output TEXT,
    error_message TEXT,
    total_cost_usd REAL NOT NULL DEFAULT 0.0,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_step_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id INTEGER NOT NULL REFERENCES workflow_steps(id),
    step_order INTEGER NOT NULL,
    input_text TEXT NOT NULL,
    output_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'running' | 'completed' | 'failed'
    error_message TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    started_at TEXT,
    completed_at TEXT
);
