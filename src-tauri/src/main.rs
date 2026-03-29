// AIFlow — Tauri 데스크톱 앱 진입점
// 05_SECURITY_SPEC.md: 콘솔 창 숨김 (Windows 릴리스 빌드)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 로깅 초기화
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aiflow=info,tauri=warn".into()),
        )
        .init();

    aiflow_lib::run();
}
