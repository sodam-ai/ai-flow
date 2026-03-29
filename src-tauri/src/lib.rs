use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken; // Fix: tokio::sync 아님 — tokio_util::sync

pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;
pub mod shortcut;
pub mod tray;

use db::Database;
use reqwest::Client;
use services::audit::AuditService;
use services::chat::ChatService;
use services::keychain::KeychainService;
use services::persona::PersonaService;
use services::prompt::PromptService;

/// StreamRegistry — 진행 중인 AI 스트림 취소 토큰 맵
/// 04_PROJECT_SPEC.md AppState 통합 구조체
pub struct StreamRegistry {
    tokens: Mutex<HashMap<String, CancellationToken>>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            tokens: Mutex::new(HashMap::new()),
        }
    }

    /// 스트림 등록 — 동시 5개 초과 시 에러 반환 (Rate002)
    pub async fn register(&self, id: String, token: CancellationToken) -> anyhow::Result<()> {
        let mut tokens = self.tokens.lock().await;
        if tokens.len() >= 5 {
            anyhow::bail!("concurrent stream limit exceeded (max 5)");
        }
        tokens.insert(id, token);
        Ok(())
    }

    pub async fn cancel(&self, id: &str) {
        if let Some(token) = self.tokens.lock().await.get(id) {
            token.cancel();
        }
    }

    pub async fn remove(&self, id: &str) {
        self.tokens.lock().await.remove(id);
    }
}

/// Tauri AppState — 04_PROJECT_SPEC.md A-2 AppState 통합 구조체
pub struct AppState {
    pub http_client: Arc<Client>,
    /// Ollama localhost HTTP 허용 클라이언트 (HTTPS 전용 클라이언트와 분리)
    pub local_client: Arc<Client>,
    pub streams: Arc<StreamRegistry>,
    pub audit: Arc<AuditService>,
    pub chat: Arc<ChatService>,
    pub keychain: Arc<KeychainService>,
    pub persona: Arc<PersonaService>,
    pub prompt: Arc<PromptService>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Tauri 플러그인 등록 (Phase 1)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        // AppState 초기화
        .setup(|app| {
            setup_app_state(app).map_err(|e| e.to_string())?;
            tray::setup_tray(app)?;
            shortcut::setup_shortcuts(app).map_err(|e| e.to_string())?;
            Ok(())
        })
        // Tauri command 등록
        .invoke_handler(tauri::generate_handler![
            // AI 스트리밍
            commands::ai::stream_ai_command,
            commands::ai::cancel_stream,
            // 대화/메시지
            commands::chat::create_conversation,
            commands::chat::list_conversations,
            commands::chat::delete_conversation,
            commands::chat::rename_conversation,
            commands::chat::toggle_pin_conversation,
            commands::chat::get_messages,
            // 키체인 (get_api_key IPC 없음 — 04_PROJECT_SPEC.md C-1)
            commands::keychain::set_api_key,
            commands::keychain::get_api_key_status,
            commands::keychain::delete_api_key,
            // 페르소나
            commands::persona::list_personas,
            commands::persona::create_persona,
            commands::persona::update_persona,
            commands::persona::delete_persona,
            // 프롬프트 라이브러리
            commands::prompt::list_prompts,
            commands::prompt::create_prompt,
            commands::prompt::update_prompt,
            commands::prompt::delete_prompt,
            commands::prompt::use_prompt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AIFlow");
}

fn setup_app_state(app: &tauri::App) -> anyhow::Result<()> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("app data dir not found");
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("aiflow.db");

    // 키체인 서비스 초기화
    let keychain = Arc::new(KeychainService::new());

    // DB 마이그레이션 실행 (단독 연결)
    {
        let mut migration_conn = rusqlite::Connection::open(&db_path)?;
        migration_conn.pragma_update(None, "journal_mode", "WAL")?;
        migration_conn.pragma_update(None, "foreign_keys", true)?;
        db::migrations::run_migrations(&mut migration_conn)?;
    }

    // DB 풀 초기화 (r2d2 읽기풀 + writer 스레드)
    let db = Arc::new(Database::open(&db_path)?);

    // reqwest 싱글톤 (HTTPS 전용)
    let http_client = Arc::new(services::ai_client::build_http_client()?);
    // Ollama localhost HTTP 허용 클라이언트
    let local_client = Arc::new(services::ai_client::build_local_client()?);

    // 스트림 레지스트리
    let streams = Arc::new(StreamRegistry::new());

    // 감사 서비스
    let audit = Arc::new(AuditService::new(Arc::clone(&db)));

    // 채팅 서비스
    let chat = Arc::new(ChatService::new(Arc::clone(&db)));

    // 페르소나 서비스
    let persona = Arc::new(PersonaService::new(Arc::clone(&db)));

    // 프롬프트 라이브러리 서비스
    let prompt = Arc::new(PromptService::new(Arc::clone(&db)));

    let state = AppState {
        http_client,
        local_client,
        streams,
        audit,
        chat,
        keychain,
        persona,
        prompt,
    };

    app.manage(state);
    Ok(())
}
