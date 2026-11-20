use tauri::{webview::PageLoadPayload, Webview};

use crate::{ui_only, CommandResult, SHELL};

pub fn on_page_load(view: &Webview, payload: &PageLoadPayload<'_>) {
    use tauri::webview::PageLoadEvent;
    if view.label() != SHELL || !matches!(payload.event(), PageLoadEvent::Finished) { return; }
    let Ok(url) = std::env::var("ORLA_SMOKE_URL") else { return };
    let setup = serde_json::json!({
        "url": url,
        "extension": std::env::var("ORLA_SMOKE_EXTENSION").unwrap_or_default(),
        "phase": std::env::var("ORLA_SMOKE_PHASE").unwrap_or_default(),
    });
    let script = format!("globalThis.orlaSmoke = {setup};\n{}", include_str!("../../scripts/smoke-windows-ui.js"));
    if let Err(error) = view.eval(&script) {
        eprintln!("Não foi possível iniciar o teste WebView2: {error}");
    }
}

#[tauri::command]
pub fn smoke_reply(caller: Webview, message: String) -> CommandResult {
    ui_only(&caller)?;
    let path = std::env::var_os("ORLA_SMOKE_RESULT").ok_or("Teste não configurado.")?;
    std::fs::write(path, message).map_err(|error| error.to_string())
}
