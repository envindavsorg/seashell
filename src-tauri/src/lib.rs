// seashell — a visual .zshrc manager.
//
// The Rust core does ONLY the safety-critical work: read the file, write it back
// ATOMICALLY (temp file + rename so a crash can never leave a half-written shell
// config), and keep automatic timestamped backups so any change is reversible.
// All parsing/serialization of the .zshrc lives in the TypeScript frontend.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

const BACKUP_DIR_NAME: &str = ".zshrc.backups";
const BACKUP_PREFIX: &str = "zshrc.";
const BACKUP_SUFFIX: &str = ".bak";

/// Monotonic per-process counter so concurrent writes never share a temp path.
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Epoch-millis of our most recent write, so the file watcher can ignore self-writes.
static LAST_SELF_WRITE: AtomicU64 = AtomicU64::new(0);

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Serialize)]
struct ZshrcFile {
    path: String,
    content: String,
    exists: bool,
}

#[derive(Serialize, Clone)]
struct BackupInfo {
    name: String,
    path: String,
    epoch_secs: u64,
    size: u64,
}

#[derive(Serialize)]
struct WriteOutcome {
    path: String,
    backup: Option<BackupInfo>,
    bytes: usize,
}

fn home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|e| format!("cannot resolve home directory: {e}"))
}

fn zshrc_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(home(app)?.join(".zshrc"))
}

fn backups_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(home(app)?.join(BACKUP_DIR_NAME))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Reject anything that isn't one of our own backup filenames (no path traversal).
fn validate_backup_name(name: &str) -> Result<(), String> {
    if name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || !name.starts_with(BACKUP_PREFIX)
        || !name.ends_with(BACKUP_SUFFIX)
    {
        return Err("invalid backup name".into());
    }
    Ok(())
}

/// Copy the current .zshrc into the backups dir. Returns None if there's nothing
/// to back up (file doesn't exist yet).
fn make_backup(app: &tauri::AppHandle) -> Result<Option<BackupInfo>, String> {
    let src = zshrc_path(app)?;
    if !src.exists() {
        return Ok(None);
    }
    let dir = backups_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create backup dir: {e}"))?;

    let secs = now_secs();
    let mut name = format!("{BACKUP_PREFIX}{secs}{BACKUP_SUFFIX}");
    let mut dest = dir.join(&name);
    let mut n = 1;
    while dest.exists() {
        name = format!("{BACKUP_PREFIX}{secs}-{n}{BACKUP_SUFFIX}");
        dest = dir.join(&name);
        n += 1;
    }
    fs::copy(&src, &dest).map_err(|e| format!("backup copy failed: {e}"))?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    Ok(Some(BackupInfo {
        name,
        path: dest.to_string_lossy().into_owned(),
        epoch_secs: secs,
        size,
    }))
}

/// Write `content` to `path` atomically: write a temp file in the same directory,
/// fsync, preserve the original mode, then rename over the target.
fn atomic_write(path: &Path, content: &str) -> Result<usize, String> {
    // Mark this as a self-write so the file watcher doesn't report it as an external change.
    LAST_SELF_WRITE.store(now_millis(), Ordering::Relaxed);

    // If ~/.zshrc is a symlink (dotfiles managers: stow / chezmoi / yadm / dotbot, …), write
    // THROUGH to its real target. Otherwise rename() would replace the symlink with a regular
    // file and silently orphan the user's source-of-truth config.
    let target: PathBuf = match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_symlink() => {
            fs::canonicalize(path).map_err(|e| format!("cannot resolve symlink target: {e}"))?
        }
        _ => path.to_path_buf(),
    };

    let parent = target
        .parent()
        .ok_or_else(|| "invalid target path".to_string())?;
    // Unique temp name (PID + counter) so two writes in the same second can't clobber each other.
    let unique = format!(
        "{}.{}",
        std::process::id(),
        TMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    );
    let tmp = parent.join(format!(".zshrc.seashell.{unique}.tmp"));

    #[cfg(unix)]
    let mode = {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(&target).ok().map(|m| m.permissions().mode())
    };

    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("temp create failed: {e}"))?;
        if let Err(e) = f.write_all(content.as_bytes()) {
            let _ = fs::remove_file(&tmp);
            return Err(format!("write failed: {e}"));
        }
        let _ = f.sync_all();
    }

    // Preserve the original file mode; a failure must abort (not silently downgrade a 0600 file).
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let m = mode.unwrap_or(0o644);
        if let Err(e) = fs::set_permissions(&tmp, fs::Permissions::from_mode(m)) {
            let _ = fs::remove_file(&tmp);
            return Err(format!("set permissions failed: {e}"));
        }
    }

    fs::rename(&tmp, &target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("atomic rename failed: {e}")
    })?;
    Ok(content.len())
}

#[tauri::command]
fn read_zshrc(app: tauri::AppHandle) -> Result<ZshrcFile, String> {
    let path = zshrc_path(&app)?;
    let exists = path.exists();
    let content = if exists {
        fs::read_to_string(&path).map_err(|e| format!("read failed: {e}"))?
    } else {
        String::new()
    };
    Ok(ZshrcFile {
        path: path.to_string_lossy().into_owned(),
        content,
        exists,
    })
}

#[tauri::command]
fn write_zshrc(app: tauri::AppHandle, content: String) -> Result<WriteOutcome, String> {
    let path = zshrc_path(&app)?;
    let backup = make_backup(&app)?;
    let bytes = atomic_write(&path, &content)?;
    Ok(WriteOutcome {
        path: path.to_string_lossy().into_owned(),
        backup,
        bytes,
    })
}

#[tauri::command]
fn list_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for entry in fs::read_dir(&dir).map_err(|e| format!("read dir failed: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_SUFFIX) {
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            let epoch_secs = name
                .trim_start_matches(BACKUP_PREFIX)
                .trim_end_matches(BACKUP_SUFFIX)
                .split('-')
                .next()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            out.push(BackupInfo {
                name,
                path: entry.path().to_string_lossy().into_owned(),
                epoch_secs,
                size: meta.len(),
            });
        }
    }
    out.sort_by(|a, b| b.epoch_secs.cmp(&a.epoch_secs).then(b.name.cmp(&a.name)));
    Ok(out)
}

#[tauri::command]
fn read_backup(app: tauri::AppHandle, name: String) -> Result<String, String> {
    validate_backup_name(&name)?;
    let p = backups_dir(&app)?.join(&name);
    fs::read_to_string(&p).map_err(|e| format!("read backup failed: {e}"))
}

#[tauri::command]
fn restore_backup(app: tauri::AppHandle, name: String) -> Result<WriteOutcome, String> {
    validate_backup_name(&name)?;
    let content = {
        let p = backups_dir(&app)?.join(&name);
        fs::read_to_string(&p).map_err(|e| format!("read backup failed: {e}"))?
    };
    // Back up the current file before overwriting, so a restore is itself reversible.
    let path = zshrc_path(&app)?;
    let backup = make_backup(&app)?;
    let bytes = atomic_write(&path, &content)?;
    Ok(WriteOutcome {
        path: path.to_string_lossy().into_owned(),
        backup,
        bytes,
    })
}

#[tauri::command]
fn delete_backup(app: tauri::AppHandle, name: String) -> Result<(), String> {
    validate_backup_name(&name)?;
    let p = backups_dir(&app)?.join(&name);
    fs::remove_file(&p).map_err(|e| format!("delete failed: {e}"))
}

#[tauri::command]
fn reveal_backups(app: tauri::AppHandle) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create backup dir: {e}"))?;
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("failed to open Finder: {e}"))?;
    }
    Ok(dir.to_string_lossy().into_owned())
}

#[derive(Serialize)]
struct ZshValidation {
    ok: bool,
    message: String,
}

/// Syntax-check `content` with `zsh -n` (parse only, never executes) before the user saves.
#[tauri::command]
fn validate_zsh(content: String) -> Result<ZshValidation, String> {
    let tmp = std::env::temp_dir().join(format!(
        ".seashell-validate.{}.{}.zsh",
        std::process::id(),
        TMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&tmp, content.as_bytes()).map_err(|e| format!("temp write failed: {e}"))?;
    let output = std::process::Command::new("zsh")
        .arg("-n")
        .arg(&tmp)
        .output();
    let _ = fs::remove_file(&tmp);
    match output {
        Ok(out) if out.status.success() => Ok(ZshValidation {
            ok: true,
            message: String::new(),
        }),
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stderr);
            // hide the temp path from the message; keep zsh's line/column info
            let msg = raw
                .replace(&*tmp.to_string_lossy(), "~/.zshrc")
                .trim()
                .to_string();
            Ok(ZshValidation {
                ok: false,
                message: if msg.is_empty() {
                    "zsh reported a syntax error".into()
                } else {
                    msg
                },
            })
        }
        Err(e) => Err(format!("could not run zsh: {e}")),
    }
}

#[tauri::command]
fn open_in_zed(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg("Zed")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to open Zed: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to reveal: {e}"))?;
    }
    Ok(())
}

#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg(desktop)]
fn setup_desktop(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };

    // Menu-bar tray icon
    let show = MenuItem::with_id(app, "show", "Show seashell", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit seashell", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("seashell — .zshrc manager")
        .icon(
            app.default_window_icon()
                .cloned()
                .ok_or("no default window icon")?,
        )
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "hide" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    // Global shortcut ⌘⌥Z (Ctrl+Alt+Z elsewhere) to summon / hide the window.
    let toggle = Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyZ);
    app.global_shortcut()
        .on_shortcut(toggle, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(w) = app.get_webview_window("main") {
                    let visible = w.is_visible().unwrap_or(false);
                    let focused = w.is_focused().unwrap_or(false);
                    if visible && focused {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
            }
        })?;

    Ok(())
}

/// Watch the home directory for external changes to ~/.zshrc and emit `zshrc-changed`.
fn setup_watcher(app: &tauri::App) {
    use notify::{EventKind, RecursiveMode, Watcher};

    let handle = app.handle().clone();
    let watch_dir = match home(&handle) {
        Ok(d) => d,
        Err(_) => return,
    };
    let emit_handle = handle.clone();

    let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if !matches!(
            event.kind,
            EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
        ) {
            return;
        }
        let touches = event
            .paths
            .iter()
            .any(|p| p.file_name().map(|n| n == ".zshrc").unwrap_or(false));
        if !touches {
            return;
        }
        // ignore changes we made ourselves (within 1.5s of our last write)
        if now_millis().saturating_sub(LAST_SELF_WRITE.load(Ordering::Relaxed)) < 1500 {
            return;
        }
        let _ = emit_handle.emit("zshrc-changed", ());
    });

    if let Ok(mut w) = watcher {
        if w.watch(&watch_dir, RecursiveMode::NonRecursive).is_ok() {
            // keep the watcher alive for the app's lifetime
            std::mem::forget(w);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            // single-instance must be registered first
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                show_main(app);
            }))
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(desktop)]
            setup_desktop(app)?;
            setup_watcher(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Resident menu-bar app: the red button / window close hides to the tray.
            // ⌘Q (app quit) and the tray's "Quit" still exit normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_zshrc,
            write_zshrc,
            list_backups,
            read_backup,
            restore_backup,
            delete_backup,
            reveal_backups,
            validate_zsh,
            open_in_zed,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
