pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod services;

use std::sync::Arc;
use services::ai_client::get_http_client;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

/// Global app state — managed by Tauri
pub struct AppState {
    pub db: Arc<db::pool::Database>,
    pub http_client: Arc<reqwest::Client>,
    pub streams: Arc<services::stream_registry::StreamRegistry>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let shortcut_str = shortcut.to_string();
                        match shortcut_str.as_str() {
                            "Alt+Space" => {
                                if let Err(e) = commands::overlay::toggle_overlay_inner(app) {
                                    log::error!("Overlay toggle failed: {}", e);
                                }
                            }
                            "Alt+Shift+A" => {
                                // Clipboard → AI: emit event for frontend to handle
                                let _ = app.emit("aiflow://clipboard-to-ai", ());
                            }
                            "Alt+Shift+V" => {
                                // Voice recording: emit event for frontend to handle
                                let _ = app.emit("aiflow://voice-start", ());
                            }
                            "Ctrl+Shift+S" => {
                                // Screenshot → Vision AI: emit event for frontend to handle
                                let _ = app.emit("aiflow://screenshot-to-ai", ());
                            }
                            _ => {}
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize database
            let database = db::pool::Database::init(&app_handle)?;

            // Initialize app state
            let db_arc = Arc::new(database);

            // Seed default routing rules (Phase 2)
            if let Err(e) = services::routing::seed_default_rules(&db_arc) {
                log::warn!("Failed to seed routing rules: {}", e);
            }

            let state = AppState {
                db: db_arc,
                http_client: Arc::new(get_http_client()),
                streams: Arc::new(services::stream_registry::StreamRegistry::new()),
            };
            app.manage(state);

            // Register global shortcuts (Alt+Space = overlay, Alt+Shift+A = clipboard, Alt+Shift+V = voice)
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            if let Err(e) = app.global_shortcut().register("Alt+Space") {
                log::warn!("Failed to register Alt+Space: {}. Another app may have claimed it.", e);
            }
            if let Err(e) = app.global_shortcut().register("Alt+Shift+A") {
                log::warn!("Failed to register Alt+Shift+A: {}", e);
            }
            if let Err(e) = app.global_shortcut().register("Alt+Shift+V") {
                log::warn!("Failed to register Alt+Shift+V: {}", e);
            }
            if let Err(e) = app.global_shortcut().register("Ctrl+Shift+S") {
                log::warn!("Failed to register Ctrl+Shift+S: {}", e);
            }

            // System tray menu
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;
            let new_chat_item = MenuItem::with_id(app, "new_chat", "New Chat", true, None::<&str>)?;
            let toggle_item = MenuItem::with_id(app, "toggle_window", "Show/Hide", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit AIFlow", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&new_chat_item, &toggle_item, &settings_item, &quit_item],
            )?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("AIFlow")
                .on_menu_event(|app, event| {
                    let main_window = app.get_webview_window("main");
                    match event.id.as_ref() {
                        "new_chat" => {
                            if let Some(win) = &main_window {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            let _ = app.emit("aiflow://tray-new-chat", ());
                        }
                        "toggle_window" => {
                            if let Some(win) = &main_window {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                        "settings" => {
                            if let Some(win) = &main_window {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                            let _ = app.emit("aiflow://tray-settings", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Close-to-tray: hide window instead of quitting
            if let Some(main_window) = app.get_webview_window("main") {
                let main_win = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_win.hide();
                    }
                });
            }

            log::info!("AIFlow initialized successfully (Phase 6: Screenshot Vision AI)");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Keychain
            commands::keychain::save_api_key,
            commands::keychain::get_api_key_status,
            commands::keychain::delete_api_key,
            commands::keychain::validate_api_key_only,
            // Chat
            commands::chat::create_conversation,
            commands::chat::get_conversations,
            commands::chat::get_messages,
            commands::chat::delete_conversation,
            commands::chat::rename_conversation,
            commands::chat::toggle_pin,
            commands::chat::get_message_versions,
            commands::chat::search_messages,
            commands::chat::export_conversation,
            commands::chat::get_conversation_kb_ids,
            commands::chat::save_conversation_kb_ids,
            // AI streaming
            commands::ai::stream_ai_message,
            commands::ai::regenerate_ai_message,
            commands::ai::cancel_stream,
            commands::ai::get_model_catalog,
            // Personas (Phase 1b)
            commands::persona::list_personas,
            commands::persona::get_persona,
            commands::persona::create_persona,
            commands::persona::update_persona,
            commands::persona::delete_persona,
            // Prompts (Phase 1b)
            commands::prompt::list_prompts,
            commands::prompt::get_prompt,
            commands::prompt::create_prompt,
            commands::prompt::update_prompt,
            commands::prompt::delete_prompt,
            commands::prompt::use_prompt,
            // File & Clipboard (Phase 1b)
            commands::file::validate_and_read_file,
            commands::file::read_clipboard_content,
            // Overlay (Phase 1b)
            commands::overlay::toggle_overlay,
            commands::overlay::close_overlay,
            // Multi-AI comparison (Phase 2)
            commands::multi_ai::stream_multi_ai,
            commands::multi_ai::adopt_comparison,
            // Smart routing (Phase 2)
            commands::routing::get_routing_suggestion,
            commands::routing::get_routing_rules,
            commands::routing::stream_routed_message,
            // Local LLM detection (Phase 2)
            commands::local_llm::detect_local_llms,
            commands::local_llm::get_local_endpoints,
            // Privacy (Phase 2)
            commands::privacy::log_pii_detection,
            commands::privacy::get_privacy_stats,
            commands::privacy::get_global_privacy_stats,
            commands::privacy::get_audit_log,
            // Cost Report + Budget (Phase 2)
            commands::cost_report::get_cost_report,
            commands::cost_report::get_budget_status,
            commands::cost_report::set_budget,
            // Prompt Versions (Phase 2)
            commands::prompt_version::get_prompt_versions,
            commands::prompt_version::restore_prompt_version,
            // MCP Plugin Market (Phase 2)
            commands::mcp::list_mcp_servers,
            commands::mcp::create_mcp_server,
            commands::mcp::update_mcp_server,
            commands::mcp::delete_mcp_server,
            commands::mcp::toggle_mcp_server,
            commands::mcp::set_mcp_allowed_paths,
            // Workflow Builder (Phase 2)
            commands::workflow::list_workflow_templates,
            commands::workflow::list_workflows,
            commands::workflow::create_workflow,
            commands::workflow::get_workflow,
            commands::workflow::delete_workflow,
            commands::workflow::run_workflow,
            commands::workflow::get_workflow_run,
            commands::workflow::list_workflow_runs,
            // Batch Processing (Phase 2)
            commands::workflow::list_batch_jobs,
            commands::workflow::create_batch_job,
            commands::workflow::get_batch_job,
            commands::workflow::get_batch_items,
            commands::workflow::run_batch_job,
            commands::workflow::cancel_batch_job,
            // Payment / License (Phase 2)
            commands::payment::get_license_status,
            commands::payment::get_pro_features,
            commands::payment::create_lemonsqueezy_checkout,
            commands::payment::create_toss_checkout,
            commands::payment::create_naverpay_checkout,
            commands::payment::activate_license,
            commands::payment::handle_payment_callback,
            commands::payment::reset_license,
            // Browser Extension (Phase 2)
            commands::browser_ext::get_browser_ext_status,
            commands::browser_ext::register_native_host,
            commands::browser_ext::unregister_native_host,
            commands::browser_ext::receive_browser_context,
            commands::browser_ext::list_browser_contexts,
            // Knowledge Base / RAG (Phase 3)
            commands::knowledge_base::list_knowledge_bases,
            commands::knowledge_base::create_knowledge_base,
            commands::knowledge_base::delete_knowledge_base,
            commands::knowledge_base::list_kb_documents,
            commands::knowledge_base::index_document,
            commands::knowledge_base::delete_kb_document,
            commands::knowledge_base::search_knowledge_base,
            commands::knowledge_base::index_folder,
            // AI Agent (Phase 3)
            commands::agent::start_agent_run,
            commands::agent::resume_agent_run,
            commands::agent::approve_agent_step,
            commands::agent::cancel_agent_run,
            commands::agent::list_agent_runs,
            commands::agent::get_agent_run,
            // Conversation Branching (Phase 3)
            commands::agent::create_conversation_branch,
            commands::agent::list_conversation_branches,
            // Workflow Export/Import (Phase 3)
            commands::agent::export_workflow,
            commands::agent::import_workflow,
            // Voice / STT (Phase 5)
            commands::voice::transcribe_audio,
            // Screenshot / Vision AI (Phase 6)
            commands::screenshot::capture_screen,
            // Auto Updater (Phase 6)
            commands::updater::check_for_updates,
            commands::updater::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
