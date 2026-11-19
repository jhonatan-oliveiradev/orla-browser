#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod shortcuts;
#[cfg(windows)]
mod site_events;
mod search;

use serde::Serialize;
use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Url, Webview, WebviewUrl,
};

const SHELL: &str = "orla";
const TOOLBAR: f64 = 53.0;
// Keep the shell reachable at the window edges when a site has focus.
const RESIZE_EDGE: f64 = 6.0;

type CommandResult = Result<(), String>;

#[derive(Clone, Serialize)]
struct TabTitle {
    id: String,
    url: String,
    title: String,
}

fn ui_only(caller: &Webview) -> CommandResult {
    if caller.label() == SHELL {
        Ok(())
    } else {
        Err("Comando exclusivo da interface do Orla.".into())
    }
}

fn website(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && !matches!(url.host_str(), Some("tauri.localhost" | "ipc.localhost"))
}

fn as_message(error: tauri::Error) -> String {
    error.to_string()
}

fn site_bounds(
    width: f64, height: f64, sidebar_left: f64, site_top: f64,
) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    let left = sidebar_left.clamp(RESIZE_EDGE, (width - RESIZE_EDGE - 1.0).max(RESIZE_EDGE));
    let top = site_top.clamp(TOOLBAR, (height - RESIZE_EDGE - 1.0).max(TOOLBAR));
    let size = LogicalSize::new(
        (width - left - RESIZE_EDGE).max(1.0),
        (height - top - RESIZE_EDGE).max(1.0),
    );
    (LogicalPosition::new(left, top), size)
}

fn tab_label(id: u32) -> String {
    format!("tab-{id}")
}

#[tauri::command]
async fn navigate_tab(
    caller: Webview, app: AppHandle, id: u32, address: String, sidebar_left: f64, site_top: f64,
) -> CommandResult {
    ui_only(&caller)?;
    let url = Url::parse(&address).map_err(|_| "Endereço inválido.".to_string())?;
    if !website(&url) {
        return Err("Use um endereço HTTP ou HTTPS sem credenciais.".into());
    }

    let label = tab_label(id);
    if let Some(view) = app.get_webview(&label) {
        return view.navigate(url).map_err(as_message);
    }

    let window = app.get_window(SHELL).ok_or("Janela indisponível.")?;
    let scale = window.scale_factor().map_err(as_message)?;
    let size = window
        .inner_size()
        .map_err(as_message)?
        .to_logical::<f64>(scale);
    let (position, size) = site_bounds(size.width, size.height, sidebar_left, site_top);
    let builder = WebviewBuilder::new(label, WebviewUrl::External(Url::parse("about:blank").unwrap()))
        .on_navigation(website)
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_document_title_changed(|view, title| {
            if let Ok(url) = view.url() {
                let _ = view.app_handle().emit_to(
                    SHELL,
                    "orla-title",
                    TabTitle {
                        id: view.label().to_owned(),
                        url: url.to_string(),
                        title,
                    },
                );
            }
        });
    let view = window.add_child(builder, position, size).map_err(as_message)?;
    #[cfg(windows)]
    {
        shortcuts::attach(&view)?;
        site_events::attach(&view)?;
    }
    view.navigate(url).map_err(as_message)
}

#[tauri::command]
async fn show_tab(
    caller: Webview, app: AppHandle, id: Option<u32>, focus: Option<bool>,
) -> CommandResult {
    ui_only(&caller)?;
    let active = id.map(tab_label);
    for (label, view) in app.webviews() {
        if label.starts_with("tab-") && Some(&label) != active.as_ref() {
            view.hide().map_err(as_message)?;
        }
    }
    if id.is_none() && focus == Some(true) {
        if let Some(shell) = app.get_webview(SHELL) {
            shell.set_focus().map_err(as_message)?;
        }
    }
    if let Some(view) = active.and_then(|label| app.get_webview(&label)) {
        view.show().map_err(as_message)?;
        if focus == Some(true) {
            view.set_focus().map_err(as_message)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn resize_tabs(
    caller: Webview, app: AppHandle, width: f64, height: f64, sidebar_left: f64, site_top: f64,
) -> CommandResult {
    ui_only(&caller)?;
    let (position, size) = site_bounds(width, height, sidebar_left, site_top);
    let bounds = Rect { position: position.into(), size: size.into() };
    for (label, view) in app.webviews() {
        if label.starts_with("tab-") {
            view.set_bounds(bounds).map_err(as_message)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn tab_action(caller: Webview, app: AppHandle, id: u32, action: String) -> CommandResult {
    ui_only(&caller)?;
    let Some(view) = app.get_webview(&tab_label(id)) else {
        return Ok(());
    };
    match action.as_str() {
        "back" => view.eval("history.back()"),
        "forward" => view.eval("history.forward()"),
        "reload" => view.eval("location.reload()"),
        "close" => view.close(),
        _ => return Err("Ação de aba inválida.".into()),
    }
    .map_err(as_message)
}

#[cfg(not(windows))]
mod site_events {
    #[tauri::command]
    pub fn download_action(id: u32, action: String) -> super::CommandResult {
        let _ = (id, action);
        Err("Downloads estão disponíveis no Windows.".into())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            navigate_tab,
            show_tab,
            resize_tabs,
            tab_action,
            site_events::download_action,
            search::search_web
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Orla Browser");
}
