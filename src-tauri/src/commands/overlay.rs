use tauri::Manager;

/// Toggle the overlay window (create if not exists, show/hide if exists)
#[tauri::command]
pub async fn toggle_overlay(app: tauri::AppHandle) -> Result<(), String> {
    toggle_overlay_inner(&app)
}

/// Close the overlay window
#[tauri::command]
pub async fn close_overlay(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.hide().map_err(|e| format!("Failed to hide overlay: {}", e))?;
    }
    Ok(())
}

/// Inner function callable from both command and shortcut handler
pub fn toggle_overlay_inner(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        // Window exists — toggle visibility
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            window.hide().map_err(|e| format!("Failed to hide overlay: {}", e))?;
        } else {
            window.show().map_err(|e| format!("Failed to show overlay: {}", e))?;
            window.set_focus().map_err(|e| format!("Failed to focus overlay: {}", e))?;
            center_overlay(&window)?;
        }
    } else {
        // Create overlay window (PRD: 640px fixed width, Raycast-style spotlight)
        let window = tauri::WebviewWindowBuilder::new(
            app,
            "overlay",
            tauri::WebviewUrl::App("/overlay".into()),
        )
        .title("AIFlow Overlay")
        .inner_size(640.0, 400.0)
        .min_inner_size(480.0, 200.0)
        .max_inner_size(640.0, 720.0)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .transparent(true)
        .center()
        .focused(true)
        .resizable(false)
        .build()
        .map_err(|e| format!("Failed to create overlay: {}", e))?;

        center_overlay(&window)?;
    }

    Ok(())
}

/// Center overlay window on screen
fn center_overlay(window: &tauri::WebviewWindow) -> Result<(), String> {
    window
        .center()
        .map_err(|e| format!("Failed to center overlay: {}", e))
}
