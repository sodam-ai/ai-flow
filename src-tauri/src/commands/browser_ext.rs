/// Chrome Native Messaging 브라우저 확장 브리지
///
/// PRD: "Chrome Native Messaging 방식 (WebSocket 방식 금지)"
/// 구현: native-host.exe ↔ 메인 앱 named pipe 통신
/// 레지스트리 등록으로 Chrome이 native host를 자동으로 실행
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct BrowserContext {
    pub url: String,
    pub title: Option<String>,
    pub selected_text: Option<String>,
    pub full_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BrowserExtStatus {
    pub registered: bool,
    pub manifest_path: Option<String>,
    pub registry_key: Option<String>,
    pub native_host_path: Option<String>,
}

/// 브라우저 확장 설치 상태 확인
#[tauri::command]
pub fn get_browser_ext_status(app: AppHandle) -> Result<BrowserExtStatus, String> {
    let exe_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    let native_host_path = exe_dir
        .join("native-host.exe")
        .to_string_lossy()
        .to_string();

    let manifest_path = exe_dir
        .join("com.aiflow.companion.json")
        .to_string_lossy()
        .to_string();

    // Windows 레지스트리 키 존재 확인
    #[cfg(target_os = "windows")]
    let registered = {
        let reg_key = r"Software\Google\Chrome\NativeMessagingHosts\com.aiflow.companion";
        check_registry_key(reg_key)
    };
    #[cfg(not(target_os = "windows"))]
    let registered = false;

    Ok(BrowserExtStatus {
        registered,
        manifest_path: Some(manifest_path),
        registry_key: Some(r"HKCU\Software\Google\Chrome\NativeMessagingHosts\com.aiflow.companion".into()),
        native_host_path: Some(native_host_path),
    })
}

/// Chrome Native Messaging 레지스트리 등록
/// PRD: "Windows 레지스트리 등록 (별도 플러그인 불필요)"
#[tauri::command]
pub fn register_native_host(app: AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    let native_host_path = data_dir.join("native-host.exe");
    let manifest_path = data_dir.join("com.aiflow.companion.json");

    // 1. manifest JSON 작성
    let manifest = serde_json::json!({
        "name": "com.aiflow.companion",
        "description": "AIFlow Browser Extension Bridge",
        "path": native_host_path.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://aiflow-companion-placeholder/"
        ]
    });

    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    std::fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).unwrap())
        .map_err(|e| format!("manifest 파일 저장 실패: {e}"))?;

    // 2. Windows 레지스트리 등록
    #[cfg(target_os = "windows")]
    {
        let reg_path = r"Software\Google\Chrome\NativeMessagingHosts\com.aiflow.companion";
        let manifest_str = manifest_path.to_string_lossy().to_string();
        write_registry_key(reg_path, &manifest_str)?;
    }

    Ok(format!(
        "Chrome Native Messaging 등록 완료.\n\nmanifest: {}\n\n브라우저 확장을 설치하면 현재 페이지를 AIFlow로 전송할 수 있습니다.",
        manifest_path.display()
    ))
}

/// 레지스트리 등록 해제
#[tauri::command]
pub fn unregister_native_host() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let reg_path = r"Software\Google\Chrome\NativeMessagingHosts\com.aiflow.companion";
        delete_registry_key(reg_path)?;
    }
    Ok(())
}

/// 브라우저에서 전송된 컨텍스트 수신 (named pipe 또는 임시 파일 폴링)
/// native-host가 DB에 직접 쓰는 방식으로 단순화
#[tauri::command]
pub fn receive_browser_context(
    state: State<'_, AppState>,
    app: AppHandle,
    ctx: BrowserContext,
) -> Result<i64, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO browser_ext_contexts (url, title, selected_text, full_text) VALUES (?1, ?2, ?3, ?4)",
        params![ctx.url, ctx.title, ctx.selected_text, ctx.full_text],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();

    // 프론트엔드에 새 컨텍스트 알림
    let _ = app.emit("aiflow://browser-context", serde_json::json!({
        "id": id,
        "url": ctx.url,
        "title": ctx.title,
        "selected_text": ctx.selected_text
    }));

    Ok(id)
}

/// 최근 브라우저 컨텍스트 목록 조회
#[tauri::command]
pub fn list_browser_contexts(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, url, title, selected_text, received_at
             FROM browser_ext_contexts ORDER BY received_at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "url": row.get::<_, String>(1)?,
                "title": row.get::<_, Option<String>>(2)?,
                "selected_text": row.get::<_, Option<String>>(3)?,
                "received_at": row.get::<_, String>(4)?
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

// ─── Windows Registry Helpers ─────────────────────────────────────────────

/// Validates a registry key path against an allowlist of safe characters.
/// Prevents argument injection into reg.exe — only alphanumeric, backslash,
/// dot, underscore, and hyphen are allowed. All callers are internal but
/// defensive validation is enforced regardless.
#[cfg(target_os = "windows")]
fn validate_registry_path(key_path: &str) -> Result<(), String> {
    let valid = !key_path.is_empty()
        && key_path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '\\' | '.' | '_' | '-'));
    if !valid {
        return Err("레지스트리 경로에 허용되지 않은 문자가 포함되어 있습니다.".into());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn check_registry_key(key_path: &str) -> bool {
    if validate_registry_path(key_path).is_err() {
        return false;
    }
    std::process::Command::new("reg")
        .args(["query", &format!("HKCU\\{key_path}")])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn write_registry_key(key_path: &str, value: &str) -> Result<(), String> {
    validate_registry_path(key_path)?;
    let status = std::process::Command::new("reg")
        .args([
            "add",
            &format!("HKCU\\{key_path}"),
            "/ve",
            "/t", "REG_SZ",
            "/d", value,
            "/f",
        ])
        .status()
        .map_err(|e| format!("레지스트리 쓰기 실패: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("레지스트리 등록에 실패했습니다. 관리자 권한이 필요할 수 있습니다.".into())
    }
}

#[cfg(target_os = "windows")]
fn delete_registry_key(key_path: &str) -> Result<(), String> {
    validate_registry_path(key_path)?;
    let status = std::process::Command::new("reg")
        .args(["delete", &format!("HKCU\\{key_path}"), "/f"])
        .status()
        .map_err(|e| format!("레지스트리 삭제 실패: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("레지스트리 삭제에 실패했습니다.".into())
    }
}
