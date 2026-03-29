-- AIFlow Attachments Schema
CREATE TABLE IF NOT EXISTS attachments (
    id              TEXT PRIMARY KEY,
    message_id      TEXT REFERENCES messages(id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    extracted_text  TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_attachments_message_id ON attachments(message_id);
