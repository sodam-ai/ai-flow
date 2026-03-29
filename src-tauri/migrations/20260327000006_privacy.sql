-- AIFlow Privacy Mode Schema
CREATE TABLE IF NOT EXISTS privacy_sessions (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    started_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ended_at        TEXT
);

-- PII 감지 로그 (내용 저장 안 함 — 패턴 유형만)
CREATE TABLE IF NOT EXISTS pii_detections (
    id              TEXT PRIMARY KEY,
    message_id      TEXT REFERENCES messages(id) ON DELETE CASCADE,
    pattern_type    TEXT NOT NULL,  -- 예: "email", "phone", "id_number"
    was_redacted    INTEGER NOT NULL DEFAULT 0,
    detected_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
