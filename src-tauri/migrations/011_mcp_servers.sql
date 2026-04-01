-- Phase 2: MCP Plugin Market
-- MCPServer: MCP 서버 목록 (내장 3종 + 사용자 커스텀)
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    server_type TEXT NOT NULL DEFAULT 'custom',   -- 'filesystem' | 'git' | 'browser' | 'custom'
    command TEXT NOT NULL,                         -- 실행 파일 경로 or 명령어
    args TEXT NOT NULL DEFAULT '[]',               -- JSON array
    allowed_paths TEXT NOT NULL DEFAULT '[]',      -- JSON array — 보안: 허용 경로 화이트리스트
    env_vars TEXT NOT NULL DEFAULT '{}',           -- JSON object — 환경변수
    is_enabled INTEGER NOT NULL DEFAULT 0,
    is_builtin INTEGER NOT NULL DEFAULT 1,         -- 내장 서버는 삭제 불가
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 내장 3종 시드
INSERT OR IGNORE INTO mcp_servers (id, name, description, server_type, command, args, allowed_paths, is_builtin)
VALUES
    (1, 'Filesystem', '로컬 파일·폴더 읽기/쓰기. 지정된 경로만 접근 가능.', 'filesystem',
     'npx', '["@modelcontextprotocol/server-filesystem"]', '[]', 1),
    (2, 'Git', 'Git 저장소 읽기·커밋 이력 조회.', 'git',
     'npx', '["@modelcontextprotocol/server-git"]', '[]', 1),
    (3, 'Browser', '웹 페이지 스크래핑 및 검색 도구.', 'browser',
     'npx', '["@modelcontextprotocol/server-puppeteer"]', '[]', 1);
