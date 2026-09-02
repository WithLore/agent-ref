pub mod mcp_http;
pub mod mcp_stdio;
pub mod screenshot_capture;

use mcp_http::{McpHttpState, start_mcp_http_server};
use screenshot_capture::begin_screenshot_capture;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Start embedded MCP HTTP API server on localhost
      let mcp_state = McpHttpState {
        app_handle: app.handle().clone(),
      };
      std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(start_mcp_http_server(mcp_state));
      });

      #[cfg(target_os = "macos")]
      {
        use tauri_plugin_global_shortcut::{
          Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
        };

        let capture_shortcut = Shortcut::new(
          Some(Modifiers::SUPER | Modifiers::SHIFT),
          Code::Digit2,
        );
        app.handle().plugin(
          tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
              if shortcut == &capture_shortcut && event.state() == ShortcutState::Pressed {
                if let Err(error) = begin_screenshot_capture(app.clone()) {
                  log::error!("Could not start screenshot capture: {error}");
                  let _ = tauri::Emitter::emit(app, "screenshot:error", error);
                }
              }
            })
            .build(),
        )?;

        if let Err(error) = app.global_shortcut().register(capture_shortcut) {
          log::error!("Could not register Command-Shift-2 screenshot shortcut: {error}");
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
