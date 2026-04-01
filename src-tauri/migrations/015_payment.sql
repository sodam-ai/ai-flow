-- Phase 2: Pro Payment & License
CREATE TABLE IF NOT EXISTS license_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL DEFAULT 'free',             -- 'free' | 'pro'
    license_key_ref TEXT,                          -- OS 키체인 참조 키 (평문 저장 금지)
    payment_provider TEXT,                         -- 'lemonsqueezy' | 'toss' | 'naverpay'
    order_id TEXT,
    activated_at TEXT,
    expires_at TEXT,                               -- NULL = 영구 라이선스
    last_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 기본 Free 티어 레코드 보장
INSERT OR IGNORE INTO license_info (id, tier) VALUES (1, 'free');

-- 브라우저 확장 컨텍스트 수신 기록
CREATE TABLE IF NOT EXISTS browser_ext_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    selected_text TEXT,
    full_text TEXT,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
