use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager, Runtime,
};
use tracing::info;

/// 시스템 트레이 초기화 — 04_PROJECT_SPEC.md 트레이 명세
pub fn setup_tray<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "AIFlow 열기", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "설정", true, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &settings_item, &separator, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("AIFlow")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "settings" => open_settings(app),
            "quit" => {
                info!("user quit via tray");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // 트레이 아이콘 더블클릭 → 메인 창 표시
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                show_main_window(&app);
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

fn open_settings<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        // 설정 화면으로 이동 — 프론트엔드 이벤트로 전달
        let _ = window.emit("aiflow://navigate", "/settings");
    }
}
