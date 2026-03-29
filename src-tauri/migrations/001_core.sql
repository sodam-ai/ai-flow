-- AIFlow Core Schema (Phase 1a)
-- Settings singleton
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    language TEXT NOT NULL DEFAULT 'ko',
    theme TEXT NOT NULL DEFAULT 'dark',
    default_provider_id TEXT,
    default_model_id TEXT,
    show_cost_per_message INTEGER NOT NULL DEFAULT 1,
    exchange_rate_usd_to_krw REAL NOT NULL DEFAULT 1380.0,
    global_hotkey TEXT NOT NULL DEFAULT 'Alt+Space',
    clipboard_hotkey TEXT NOT NULL DEFAULT 'Alt+Shift+A',
    palette_hotkey TEXT NOT NULL DEFAULT 'Ctrl+K',
    tray_on_close INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO settings (id) VALUES (1);
