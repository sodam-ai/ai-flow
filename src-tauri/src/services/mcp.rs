use crate::{db::pool::Database, models::mcp::*};
use rusqlite::params;
use std::{path::Path, sync::Arc};

fn parse_server(row: &rusqlite::Row) -> rusqlite::Result<MCPServer> {
    let args_json: String = row.get(4)?;
    let paths_json: String = row.get(5)?;
    let env_json: String = row.get(6)?;

    Ok(MCPServer {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        server_type: row.get(3)?,
        command: row.get(7)?,
        args: serde_json::from_str(&args_json).unwrap_or_default(),
        allowed_paths: serde_json::from_str(&paths_json).unwrap_or_default(),
        env_vars: serde_json::from_str(&env_json).unwrap_or(serde_json::json!({})),
        is_enabled: row.get::<_, i64>(8)? == 1,
        is_builtin: row.get::<_, i64>(9)? == 1,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn list_servers(db: &Arc<Database>) -> Result<Vec<MCPServer>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, server_type, args, allowed_paths, env_vars,
                    command, is_enabled, is_builtin, created_at, updated_at
             FROM mcp_servers ORDER BY is_builtin DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;

    let servers = stmt
        .query_map([], parse_server)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(servers)
}

pub fn create_server(db: &Arc<Database>, req: CreateMCPServerRequest) -> Result<MCPServer, String> {
    let args_json = serde_json::to_string(&req.args).unwrap_or_else(|_| "[]".into());
    let paths_json = serde_json::to_string(&req.allowed_paths).unwrap_or_else(|_| "[]".into());
    let env_json = req
        .env_vars
        .map(|v| serde_json::to_string(&v).unwrap_or_else(|_| "{}".into()))
        .unwrap_or_else(|| "{}".into());

    // Use db.write() closure so MutexGuard is dropped before get_server() re-acquires the lock
    let id = db.write(|conn| {
        conn.execute(
            "INSERT INTO mcp_servers (name, description, server_type, command, args, allowed_paths, env_vars, is_builtin)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
            params![
                req.name,
                req.description,
                req.server_type.unwrap_or_else(|| "custom".into()),
                req.command,
                args_json,
                paths_json,
                env_json,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    get_server(db, id)
}

pub fn get_server(db: &Arc<Database>, id: i64) -> Result<MCPServer, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, description, server_type, args, allowed_paths, env_vars,
                command, is_enabled, is_builtin, created_at, updated_at
         FROM mcp_servers WHERE id = ?1",
        params![id],
        parse_server,
    )
    .map_err(|e| e.to_string())
}

pub fn update_server(db: &Arc<Database>, id: i64, req: UpdateMCPServerRequest) -> Result<MCPServer, String> {
    // 내장 서버는 allowed_paths·is_enabled만 수정 가능
    let existing = get_server(db, id)?;

    let new_name = req.name.unwrap_or(existing.name);
    let new_desc = req.description.or(existing.description);
    let new_cmd = if existing.is_builtin { existing.command.clone() } else { req.command.unwrap_or(existing.command) };
    let new_args = if existing.is_builtin {
        serde_json::to_string(&existing.args).unwrap_or_else(|_| "[]".into())
    } else {
        req.args.map(|a| serde_json::to_string(&a).unwrap_or_else(|_| "[]".into()))
            .unwrap_or_else(|| serde_json::to_string(&existing.args).unwrap_or_else(|_| "[]".into()))
    };
    let new_paths = req.allowed_paths
        .map(|p| serde_json::to_string(&p).unwrap_or_else(|_| "[]".into()))
        .unwrap_or_else(|| serde_json::to_string(&existing.allowed_paths).unwrap_or_else(|_| "[]".into()));
    let new_env = req.env_vars
        .map(|v| serde_json::to_string(&v).unwrap_or_else(|_| "{}".into()))
        .unwrap_or_else(|| serde_json::to_string(&existing.env_vars).unwrap_or_else(|_| "{}".into()));
    let new_enabled = req.is_enabled.map(|b| b as i64).unwrap_or(existing.is_enabled as i64);

    // Use db.write() closure — drops MutexGuard before get_server() re-acquires the lock
    db.write(|conn| {
        conn.execute(
            "UPDATE mcp_servers SET name=?1, description=?2, command=?3, args=?4,
             allowed_paths=?5, env_vars=?6, is_enabled=?7, updated_at=datetime('now')
             WHERE id=?8",
            params![new_name, new_desc, new_cmd, new_args, new_paths, new_env, new_enabled, id],
        )
    })?;

    get_server(db, id)
}

pub fn delete_server(db: &Arc<Database>, id: i64) -> Result<(), String> {
    let existing = get_server(db, id)?;
    if existing.is_builtin {
        return Err("내장 MCP 서버는 삭제할 수 없습니다. 비활성화만 가능합니다.".into());
    }
    db.write(|conn| {
        conn.execute("DELETE FROM mcp_servers WHERE id = ?1", params![id])
    })?;
    Ok(())
}

/// 경로 보안 검증: requested_path가 allowed_paths 중 하나의 하위 경로인지 확인
/// Security: both paths are canonicalized to prevent symlink traversal attacks.
pub fn validate_path_access(server: &MCPServer, requested_path: &str) -> bool {
    if server.allowed_paths.is_empty() {
        return false; // 허용 경로 없으면 전면 차단
    }

    // Canonicalize the requested path to resolve symlinks and `..` components.
    // If the path doesn't exist yet (e.g. a file to be created), canonicalize its parent.
    let req_canon = std::fs::canonicalize(requested_path)
        .or_else(|_| {
            Path::new(requested_path)
                .parent()
                .and_then(|p| std::fs::canonicalize(p).ok())
                .ok_or_else(|| std::io::Error::other("no parent"))
        });

    let req_canon = match req_canon {
        Ok(p) => p,
        Err(_) => return false, // Cannot resolve → deny
    };

    server.allowed_paths.iter().any(|allowed| {
        // Canonicalize the allowed path too — must exist to be valid
        match std::fs::canonicalize(allowed) {
            Ok(canon_allowed) => req_canon.starts_with(&canon_allowed),
            Err(_) => false, // Misconfigured allowed path → deny
        }
    })
}
