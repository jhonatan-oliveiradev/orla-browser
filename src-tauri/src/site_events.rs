use std::{cell::RefCell, collections::HashMap, path::PathBuf, rc::Rc, sync::atomic::{AtomicU32, Ordering}};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Webview};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::*, take_pwstr, BytesReceivedChangedEventHandler,
    CallDevToolsProtocolMethodCompletedHandler, ExecuteScriptCompletedHandler,
    DownloadStartingEventHandler, NavigationCompletedEventHandler, NavigationStartingEventHandler,
    NewWindowRequestedEventHandler, StateChangedEventHandler,
};

use crate::{as_message, ui_only, website, tab_label, CommandResult, SHELL};

#[derive(Clone, Serialize)]
struct Location {
    id: String,
    url: String,
    finished: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    failure: Option<&'static str>,
}

#[derive(serde::Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PageMetadata {
    url: String,
    title: String,
    social_title: String,
    description: String,
}

const READ_METADATA: &str = r#"(() => {
    const read = (selector, limit) =>
        (document.head?.querySelector(selector)?.getAttribute('content') || '').trim().slice(0, limit);
    return {
        url: location.href.slice(0, 8192),
        title: document.title.trim().slice(0, 160),
        socialTitle: read('meta[property="og:title"]', 160),
        description: read('meta[property="og:description"]', 320) || read('meta[name="description"]', 320),
    };
})()"#;

fn read_metadata(core: &ICoreWebView2, id: String, app: AppHandle) {
    let callback = ExecuteScriptCompletedHandler::create(Box::new(move |status, json| {
        status?;
        if json.len() <= 32_000 {
            if let Ok(page) = serde_json::from_str::<PageMetadata>(&json) {
                if tauri::Url::parse(&page.url).is_ok_and(|url| website(&url)) {
                    let _ = app.emit_to(SHELL, "orla-page-metadata", serde_json::json!({ "id": id, "page": page }));
                }
            }
        }
        Ok(())
    }));
    let script = windows_core::HSTRING::from(READ_METADATA);
    let _ = unsafe { core.ExecuteScript(&script, &callback) };
}

#[tauri::command]
pub async fn tab_preview(
    caller: Webview, app: AppHandle, id: u32, width: u32, height: u32,
) -> CommandResult {
    ui_only(&caller)?;
    let Some(view) = app.get_webview(&tab_label(id)) else { return Ok(()) };
    let url = view.url().map_err(as_message)?;
    if !website(&url) || width < 2 || height < 2 { return Ok(()) }
    let width = width.min(1440);
    let height = height.min(900);
    let scale = (360.0 / f64::from(width)).min(240.0 / f64::from(height)).min(1.0);
    let options = serde_json::json!({
        "format": "jpeg", "quality": 68,
        "clip": { "x": 0, "y": 0, "width": width, "height": height, "scale": scale },
        "captureBeyondViewport": false
    }).to_string();
    view.with_webview(move |platform| {
        let Ok(core) = (unsafe { platform.controller().CoreWebView2() }) else { return };
        let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |status, json| {
            status?;
            if json.len() <= 400_000 {
                if let Ok(result) = serde_json::from_str::<serde_json::Value>(&json) {
                    if let Some(image) = result.get("data").and_then(|item| item.as_str()) {
                        let _ = app.emit_to(SHELL, "orla-tab-preview", serde_json::json!({
                            "id": id, "url": url.as_str(), "image": image,
                        }));
                    }
                }
            }
            Ok(())
        }));
        let method = windows_core::w!("Page.captureScreenshot");
        let options = windows_core::HSTRING::from(options);
        let _ = unsafe { core.CallDevToolsProtocolMethod(method, &options, &callback) };
    }).map_err(as_message)
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    id: u32,
    name: String,
    received: i64,
    total: i64,
    state: &'static str,
}

thread_local! {
    // WebView2 operations are confined to their owning UI thread.
    static RUNNING: RefCell<HashMap<u32, ICoreWebView2DownloadOperation>> = RefCell::default();
    static COMPLETED: RefCell<HashMap<u32, PathBuf>> = RefCell::default();
}
static NEXT_DOWNLOAD: AtomicU32 = AtomicU32::new(1);

pub fn attach(view: &Webview) -> CommandResult {
    let id = view.label().to_owned();
    let app = view.app_handle().clone();
    view.with_webview(move |platform| {
        let result = unsafe { platform.controller().CoreWebView2() }
            .and_then(|core| register(&core, app, id));
        if let Err(error) = result {
            eprintln!("Não foi possível registrar os eventos de navegação: {error}");
        }
    })
    .map_err(as_message)
}

fn register(core: &ICoreWebView2, app: AppHandle, id: String) -> windows_core::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_4;
    use windows_core::Interface;

    let latest = Rc::new(RefCell::new((0u64, String::new())));
    let start = {
        let latest = latest.clone();
        let app = app.clone();
        let id = id.clone();
        NavigationStartingEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let mut nav_id = 0;
            let mut raw = Default::default();
            unsafe {
                args.NavigationId(&mut nav_id)?;
                args.Uri(&mut raw)?;
            }
            let url = take_pwstr(raw);
            if !tauri::Url::parse(&url).is_ok_and(|url| website(&url)) { return Ok(()); }
            *latest.borrow_mut() = (nav_id, url.clone());
            let _ = app.emit_to(SHELL, "orla-location", Location { id: id.clone(), url, finished: false, failure: None });
            Ok(())
        }))
    };
    let end = {
        let app = app.clone();
        let id = id.clone();
        NavigationCompletedEventHandler::create(Box::new(move |sender, args| {
            let Some(args) = args else { return Ok(()) };
            let (expected, url) = latest.borrow().clone();
            let mut nav_id = 0;
            let mut success = Default::default();
            unsafe {
                args.NavigationId(&mut nav_id)?;
                args.IsSuccess(&mut success)?;
            }
            if nav_id != expected || url.is_empty() { return Ok(()); }
            let failure = if success.as_bool() {
                None
            } else {
                let mut status = Default::default();
                unsafe { args.WebErrorStatus(&mut status)? };
                match status {
                    COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED => return Ok(()),
                    COREWEBVIEW2_WEB_ERROR_STATUS_DISCONNECTED => Some("offline"),
                    _ => Some("navigation"),
                }
            };
            let _ = app.emit_to(SHELL, "orla-location", Location { id: id.clone(), url, finished: true, failure });
            if failure.is_none() {
                if let Some(core) = sender { read_metadata(&core, id.clone(), app.clone()); }
            }
            Ok(())
        }))
    };
    let new_tab = {
        let app = app.clone();
        NewWindowRequestedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let mut initiated = Default::default();
            unsafe {
                args.SetHandled(true)?;
                args.IsUserInitiated(&mut initiated)?;
            }
            if !initiated.as_bool() { return Ok(()); }
            let mut raw = Default::default();
            unsafe { args.Uri(&mut raw)? };
            let url = take_pwstr(raw);
            if tauri::Url::parse(&url).is_ok_and(|url| website(&url)) {
                let _ = app.emit_to(SHELL, "orla-new-tab", serde_json::json!({ "id": id, "url": url }));
            }
            Ok(())
        }))
    };
    let downloads = DownloadStartingEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        let operation = unsafe { args.DownloadOperation()? };
        let id = NEXT_DOWNLOAD.fetch_add(1, Ordering::Relaxed);
        let mut token = 0;
        let bytes_changed = {
            let app = app.clone();
            BytesReceivedChangedEventHandler::create(Box::new(move |sender, _| {
                if let Some(operation) = sender { report(&app, id, &operation)?; }
                Ok(())
            }))
        };
        let state_changed = {
            let app = app.clone();
            StateChangedEventHandler::create(Box::new(move |sender, _| {
                if let Some(operation) = sender { report(&app, id, &operation)?; }
                Ok(())
            }))
        };
        unsafe {
            operation.add_BytesReceivedChanged(&bytes_changed, &mut token)?;
            operation.add_StateChanged(&state_changed, &mut token)?;
            args.SetHandled(true)?;
        }
        RUNNING.with_borrow_mut(|running| { running.insert(id, operation.clone()); });
        report(&app, id, &operation)
    }));

    let mut token = 0;
    unsafe {
        core.add_NavigationStarting(&start, &mut token)?;
        core.add_NavigationCompleted(&end, &mut token)?;
        core.add_NewWindowRequested(&new_tab, &mut token)?;
        core.cast::<ICoreWebView2_4>()?.add_DownloadStarting(&downloads, &mut token)?;
    }
    Ok(())
}

fn report(app: &AppHandle, id: u32, operation: &ICoreWebView2DownloadOperation) -> windows_core::Result<()> {
    let mut raw = Default::default();
    let mut received = 0;
    let mut total = 0;
    let mut state = Default::default();
    unsafe {
        operation.ResultFilePath(&mut raw)?;
    }
    let path = PathBuf::from(take_pwstr(raw));
    unsafe {
        operation.BytesReceived(&mut received)?;
        operation.TotalBytesToReceive(&mut total)?;
        operation.State(&mut state)?;
    }
    let status = match state {
        COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED => {
            COMPLETED.with_borrow_mut(|completed| {
                if completed.len() >= 100 {
                    if let Some(first) = completed.keys().min().copied() { completed.remove(&first); }
                }
                completed.insert(id, path.clone());
            });
            "completed"
        }
        COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED => {
            let mut reason = Default::default();
            unsafe { operation.InterruptReason(&mut reason)? };
            if reason == COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON_USER_CANCELED { "cancelled" } else { "interrupted" }
        }
        _ => "running",
    };
    if status != "running" {
        RUNNING.with_borrow_mut(|running| { running.remove(&id); });
    }
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| "Arquivo".into());
    let _ = app.emit_to(SHELL, "orla-download", DownloadProgress { id, name, received, total, state: status });
    Ok(())
}

#[tauri::command]
pub async fn download_action(caller: Webview, app: AppHandle, id: u32, action: String) -> CommandResult {
    ui_only(&caller)?;
    let callback = app.clone();
    app.run_on_main_thread(move || {
        let result = match action.as_str() {
            "cancel" => RUNNING.with_borrow(|running| running.get(&id).cloned())
                .ok_or("Este download já terminou.".to_string())
                .and_then(|operation| unsafe { operation.Cancel() }.map_err(|error| error.to_string())),
            "reveal" => COMPLETED.with_borrow(|completed| completed.get(&id).cloned())
                .filter(|path| path.is_file())
                .ok_or("O arquivo não está mais na pasta de downloads.".to_string())
                .and_then(|path| std::process::Command::new("explorer.exe")
                    .arg(format!("/select,{}", path.display())).spawn()
                    .map(|_| ()).map_err(|error| error.to_string())),
            _ => Err("Ação de download inválida.".into()),
        };
        if let Err(error) = result { let _ = callback.emit_to(SHELL, "orla-download-error", error); }
    })
    .map_err(as_message)
}
