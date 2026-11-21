use serde_json::Value;
use tauri::{async_runtime::channel, AppHandle, Manager, Webview};

use crate::{as_message, tab_label, ui_only, website};

#[tauri::command]
pub async fn read_page(caller: Webview, app: AppHandle, id: u32) -> Result<Value, String> {
    ui_only(&caller)?;
    let view = app.get_webview(&tab_label(id)).ok_or("Aba indisponível.")?;
    let (send, mut receive) = channel(1);
    view.eval_with_callback(include_str!("reader_extract.js"), move |result| {
        if result.len() <= 500_000 {
            let _ = send.try_send(serde_json::from_str(&result).unwrap_or(Value::Null));
        } else {
            let _ = send.try_send(Value::Null);
        }
    }).map_err(as_message)?;
    receive.recv().await.filter(|value| value.is_object()).ok_or_else(|| "A página não forneceu um texto para leitura.".into())
}

#[tauri::command]
pub async fn page_selection(caller: Webview, app: AppHandle, id: u32) -> Result<Value, String> {
    ui_only(&caller)?;
    let view = app.get_webview(&tab_label(id)).ok_or("Aba indisponível.")?;
    let url = view.url().map_err(as_message)?;
    if !website(&url) { return Err("A página precisa estar aberta.".into()); }
    let (send, mut receive) = channel(1);
    view.eval_with_callback(
        "({ url: location.href, text: window.getSelection()?.toString().trim().slice(0, 2000) || '' })",
        move |result| {
            let value = if result.len() < 32_000 { serde_json::from_str(&result).unwrap_or(Value::Null) } else { Value::Null };
            let _ = send.try_send(value);
        },
    ).map_err(as_message)?;
    let value = receive.recv().await.ok_or("Não foi possível acessar a seleção.")?;
    if view.url().map_err(as_message)? != url || value["url"].as_str() != Some(url.as_str()) {
        return Err("A página mudou durante a captura. Tente novamente.".into());
    }
    Ok(value)
}
