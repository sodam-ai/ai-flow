use tauri::{App, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tracing::info;

/// 글로벌 단축키 등록
/// - Alt+Space  : AIFlow 오버레이 소환/숨김 (04_PROJECT_SPEC.md)
/// - Alt+Shift+A: 클립보드 내용을 AI로 즉시 전송 (04_PROJECT_SPEC.md Phase 1 §클립보드 통합)
pub fn setup_shortcuts<R: Runtime>(app: &App<R>) -> anyhow::Result<()> {
    // Alt+Space — 오버레이 토글
    let overlay_shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    app.global_shortcut().on_shortcut(overlay_shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            info!("AIFlow shortcut triggered: Alt+Space");
            toggle_overlay(app);
        }
    })?;

    // Alt+Shift+A — 클립보드 내용 AI 전송
    let clipboard_shortcut = Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::KeyA);
    app.global_shortcut().on_shortcut(clipboard_shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            info!("AIFlow shortcut triggered: Alt+Shift+A (clipboard to AI)");
            // 오버레이 창을 먼저 표시한 뒤 클립보드 이벤트 전송
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.show();
                let _ = overlay.set_focus();
                let _ = overlay.center();
            }
            // 프론트엔드에 클립보드→AI 이벤트 전송 (JS에서 읽어 자동 입력)
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("aiflow://clipboard-to-ai", ());
            }
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.emit("aiflow://clipboard-to-ai", ());
            }
        }
    })?;

    info!("global shortcuts registered: Alt+Space, Alt+Shift+A");
    Ok(())
}

/// 오버레이 창 토글 — 표시 중이면 숨기고, 숨겨져 있으면 표시
fn toggle_overlay<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let visible = overlay.is_visible().unwrap_or(false);
        if visible {
            let _ = overlay.hide();
        } else {
            let _ = overlay.show();
            let _ = overlay.set_focus();
            let _ = overlay.center();
        }

        // 메인 창에도 상태 알림 (04_PROJECT_SPEC.md A-3 멀티 윈도우 이벤트)
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.emit("aiflow://overlay-toggle", !visible);
        }
    }
}
