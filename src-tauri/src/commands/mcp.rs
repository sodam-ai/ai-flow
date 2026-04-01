use crate::{models::mcp::*, services, AppState};
use tauri::State;

#[tauri::command]
pub fn list_mcp_servers(state: State<'_, AppState>) -> Result<Vec<MCPServer>, String> {
    services::mcp::list_servers(&state.db)
}

#[tauri::command]
pub fn create_mcp_server(
    state: State<'_, AppState>,
    req: CreateMCPServerRequest,
) -> Result<MCPServer, String> {
    services::mcp::create_server(&state.db, req)
}

#[tauri::command]
pub fn update_mcp_server(
    state: State<'_, AppState>,
    id: i64,
    req: UpdateMCPServerRequest,
) -> Result<MCPServer, String> {
    services::mcp::update_server(&state.db, id, req)
}

#[tauri::command]
pub fn delete_mcp_server(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    services::mcp::delete_server(&state.db, id)
}

/// 서버 활성화/비활성화 토글
#[tauri::command]
pub fn toggle_mcp_server(state: State<'_, AppState>, id: i64, enabled: bool) -> Result<MCPServer, String> {
    let req = UpdateMCPServerRequest {
        name: None,
        description: None,
        command: None,
        args: None,
        allowed_paths: None,
        env_vars: None,
        is_enabled: Some(enabled),
    };
    services::mcp::update_server(&state.db, id, req)
}

/// allowed_paths 업데이트 (경로 보안 설정)
#[tauri::command]
pub fn set_mcp_allowed_paths(
    state: State<'_, AppState>,
    id: i64,
    paths: Vec<String>,
) -> Result<MCPServer, String> {
    // 경로 검증: 절대 경로만 허용
    for path in &paths {
        if !std::path::Path::new(path).is_absolute() {
            return Err(format!("상대 경로는 허용되지 않습니다: {path}"));
        }
    }
    let req = UpdateMCPServerRequest {
        name: None,
        description: None,
        command: None,
        args: None,
        allowed_paths: Some(paths),
        env_vars: None,
        is_enabled: None,
    };
    services::mcp::update_server(&state.db, id, req)
}
