#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod devtools;
#[cfg(windows)]
mod download_store;
#[cfg(windows)]
mod extensions;
#[cfg(windows)]
mod find;
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

#[derive(serde::Deserialize)]
struct Viewport {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl Viewport {
    fn bounds(&self, window: &tauri::Window) -> Result<Rect, String> {
        if ![self.x, self.y, self.width, self.height].iter().all(|value| value.is_finite()) {
            return Err("Dimensões da página inválidas.".into());
        }
        let scale = window.scale_factor().map_err(as_message)?;
        let client = window.inner_size().map_err(as_message)?.to_logical::<f64>(scale);
        let right = (client.width - RESIZE_EDGE).max(RESIZE_EDGE + 1.0);
        let bottom = (client.height - RESIZE_EDGE).max(TOOLBAR + 1.0);
        let x = self.x.clamp(RESIZE_EDGE, right - 1.0);
        let y = self.y.clamp(TOOLBAR, bottom - 1.0);
        Ok(Rect {
            position: LogicalPosition::new(x, y).into(),
            size: LogicalSize::new(
                self.width.clamp(1.0, right - x),
                self.height.clamp(1.0, bottom - y),
            ).into(),
        })
    }
}

fn tab_label(id: u32) -> String {
    format!("tab-{id}")
}

#[tauri::command]
async fn navigate_tab(
    caller: Webview, app: AppHandle, id: u32, address: String, viewport: Viewport,
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
    let bounds = viewport.bounds(&window)?;
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
    #[cfg(windows)]
    let builder = extensions::site_profile(builder, &app)?;
    let view = window.add_child(builder, bounds.position, bounds.size).map_err(as_message)?;
    #[cfg(windows)]
    {
        shortcuts::attach(&view)?;
        site_events::attach(&view)?;
    }
    view.navigate(url).map_err(as_message)
}

#[tauri::command]
async fn show_tab(
    caller: Webview, app: AppHandle, id: Option<u32>, focus: Option<bool>, viewport: Option<Viewport>,
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
        if let Some(viewport) = viewport {
            let window = app.get_window(SHELL).ok_or("Janela indisponível.")?;
            view.set_bounds(viewport.bounds(&window)?).map_err(as_message)?;
        }
        view.show().map_err(as_message)?;
        if focus == Some(true) {
            view.set_focus().map_err(as_message)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn resize_tabs(
    caller: Webview, app: AppHandle, viewport: Viewport,
) -> CommandResult {
    ui_only(&caller)?;
    let window = app.get_window(SHELL).ok_or("Janela indisponível.")?;
    let bounds = viewport.bounds(&window)?;
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
    pub fn tab_preview(id: u32, width: u32, height: u32) {
        let _ = (id, width, height);
    }

    #[tauri::command]
    pub fn download_history() -> Vec<serde_json::Value> { Vec::new() }

    #[tauri::command]
    pub fn download_action(id: u32, action: String) -> super::CommandResult {
        let _ = (id, action);
        Err("Downloads estão disponíveis no Windows.".into())
    }
}

#[cfg(not(windows))]
mod devtools {
    #[tauri::command]
    pub fn devtools_action() -> Result<serde_json::Value, String> {
        Err("DevTools está disponível no Windows.".into())
    }
}

#[cfg(not(windows))]
mod extensions {
    #[tauri::command]
    pub fn choose_extension_folder() -> Result<Option<String>, String> {
        Err("Extensões estão disponíveis no Windows.".into())
    }

    #[tauri::command]
    pub fn extension_action() -> Result<serde_json::Value, String> {
        Err("Extensões estão disponíveis no Windows.".into())
    }
}

#[cfg(not(windows))]
mod find {
    #[tauri::command]
    pub fn find_in_page() -> super::CommandResult {
        Err("Busca na página está disponível no Windows.".into())
    }
}

#[cfg(all(windows, debug_assertions, feature = "windows-smoke"))]
mod smoke;

macro_rules! commands {
    ($($extra:tt)*) => {
        tauri::generate_handler![
            navigate_tab,
            show_tab,
            resize_tabs,
            tab_action,
            devtools::devtools_action,
            extensions::extension_action,
            extensions::choose_extension_folder,
            find::find_in_page,
            site_events::download_action,
            site_events::download_history,
            site_events::tab_preview,
            search::search_web,
            $($extra)*
        ]
    };
}

fn main() {
    let app = tauri::Builder::default();
    #[cfg(all(windows, debug_assertions, feature = "windows-smoke"))]
    let app = app.on_page_load(smoke::on_page_load).invoke_handler(commands![smoke::smoke_reply]);
    #[cfg(not(all(windows, debug_assertions, feature = "windows-smoke")))]
    let app = app.invoke_handler(commands![]);
    app.run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Orla Browser");
}
