use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

static CAPTURE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenshotCapturedPayload {
  path: String,
  captured_at: String,
}

pub fn begin_screenshot_capture(app: AppHandle) -> Result<(), String> {
  if CAPTURE_IN_PROGRESS.swap(true, Ordering::SeqCst) {
    return Ok(());
  }

  let window = app
    .get_webview_window("main")
    .ok_or_else(|| reset_with_error("AgentRef window is unavailable"))?;
  let should_restore = window.is_visible().unwrap_or(false)
    && !window.is_minimized().unwrap_or(false);

  if should_restore {
    if let Err(error) = window.hide() {
      CAPTURE_IN_PROGRESS.store(false, Ordering::SeqCst);
      return Err(format!("Could not hide AgentRef for capture: {error}"));
    }
  }

  std::thread::spawn(move || {
    // Let the macOS compositor remove AgentRef before selection starts.
    std::thread::sleep(std::time::Duration::from_millis(180));
    let result = capture_to_file_and_clipboard(&app);

    if should_restore {
      let _ = window.show();
    }
    CAPTURE_IN_PROGRESS.store(false, Ordering::SeqCst);

    match result {
      Ok(Some(payload)) => {
        let _ = app.emit("screenshot:captured", payload);
      }
      Ok(None) => {
        // Escape/cancel is intentionally silent and leaves the clipboard untouched.
      }
      Err(error) => {
        log::error!("Screenshot capture failed: {error}");
        let _ = app.emit("screenshot:error", error);
      }
    }
  });

  Ok(())
}

fn reset_with_error(message: &str) -> String {
  CAPTURE_IN_PROGRESS.store(false, Ordering::SeqCst);
  message.to_string()
}

#[cfg(target_os = "macos")]
fn capture_to_file_and_clipboard(
  app: &AppHandle,
) -> Result<Option<ScreenshotCapturedPayload>, String> {
  let capture_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Could not locate AgentRef data folder: {error}"))?
    .join("captures");
  std::fs::create_dir_all(&capture_dir)
    .map_err(|error| format!("Could not create capture folder: {error}"))?;

  let captured_at = chrono::Utc::now();
  let capture_path = capture_dir.join(format!(
    "agentref-capture-{}-{}.png",
    captured_at.format("%Y%m%d-%H%M%S-%3f"),
    uuid::Uuid::new_v4()
  ));

  let status = std::process::Command::new("/usr/sbin/screencapture")
    .args(["-i", "-x", "-t", "png"])
    .arg(&capture_path)
    .status()
    .map_err(|error| format!("Could not start macOS screenshot selection: {error}"))?;

  if !status.success() || !capture_path.exists() {
    return Ok(None);
  }

  // Copy the saved PNG as image data. This does not replace it with a file path.
  let clipboard_status = match std::process::Command::new("/usr/bin/osascript")
    .args([
      "-e",
      "on run argv",
      "-e",
      "set the clipboard to (read POSIX file (item 1 of argv) as «class PNGf»)",
      "-e",
      "end run",
    ])
    .arg(&capture_path)
    .status()
  {
    Ok(status) => status,
    Err(error) => {
      let _ = std::fs::remove_file(&capture_path);
      return Err(format!("Could not copy screenshot to clipboard: {error}"));
    }
  };

  if !clipboard_status.success() {
    let _ = std::fs::remove_file(&capture_path);
    return Err("macOS could not copy the screenshot to the clipboard".to_string());
  }

  Ok(Some(ScreenshotCapturedPayload {
    path: capture_path.to_string_lossy().into_owned(),
    captured_at: captured_at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
  }))
}

#[cfg(not(target_os = "macos"))]
fn capture_to_file_and_clipboard(
  _app: &AppHandle,
) -> Result<Option<ScreenshotCapturedPayload>, String> {
  Err("Global screenshot capture is currently available on macOS".to_string())
}
