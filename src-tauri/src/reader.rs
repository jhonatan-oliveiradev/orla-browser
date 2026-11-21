use serde_json::Value;
use tauri::{async_runtime::channel, AppHandle, Manager, Webview};

use crate::{as_message, tab_label, ui_only};

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
