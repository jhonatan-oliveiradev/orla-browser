#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl,
};

const SHELL: &str = "orla";
const TOOLBAR: f64 = 53.0;

type CommandResult = Result<(), String>;

#[derive(Clone, Serialize)]
struct TabLocation {
    id: String,
    url: String,
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

fn tab_label(id: u32) -> String {
    format!("tab-{id}")
}

#[tauri::command]
async fn navigate_tab(caller: Webview, app: AppHandle, id: u32, address: String) -> CommandResult {
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
    let builder = WebviewBuilder::new(label, WebviewUrl::External(url))
        .on_navigation(website)
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_page_load(|view, page| {
            let _ = view.app_handle().emit_to(
                SHELL,
                "orla-location",
                TabLocation {
                    id: view.label().to_owned(),
                    url: page.url().to_string(),
                },
            );
        });
    window
        .add_child(
            builder,
            LogicalPosition::new(0.0, TOOLBAR),
            LogicalSize::new(size.width, (size.height - TOOLBAR).max(1.0)),
        )
        .map(|_| ())
        .map_err(as_message)
}

#[tauri::command]
async fn show_tab(caller: Webview, app: AppHandle, id: Option<u32>) -> CommandResult {
    ui_only(&caller)?;
    let active = id.map(tab_label);
    for (label, view) in app.webviews() {
        if label.starts_with("tab-") && Some(&label) != active.as_ref() {
            view.hide().map_err(as_message)?;
        }
    }
    if let Some(view) = active.and_then(|label| app.get_webview(&label)) {
        view.show().map_err(as_message)?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_tabs(caller: Webview, app: AppHandle, width: f64, height: f64) -> CommandResult {
    ui_only(&caller)?;
    let size = LogicalSize::new(width.max(1.0), (height - TOOLBAR).max(1.0));
    for (label, view) in app.webviews() {
        if label.starts_with("tab-") {
            view.set_size(size).map_err(as_message)?;
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            navigate_tab,
            show_tab,
            resize_tabs,
            tab_action
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Orla Browser");
}
