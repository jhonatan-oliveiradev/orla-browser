use tauri::{AppHandle, Emitter, Manager, Webview};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment15, ICoreWebView2Find, ICoreWebView2_28,
    },
    FindActiveMatchIndexChangedEventHandler, FindMatchCountChangedEventHandler, FindStartCompletedHandler,
};
use windows_core::{HSTRING, Interface};

use crate::{as_message, tab_label, ui_only, CommandResult, SHELL};

fn report(app: &AppHandle, id: &str, find: &ICoreWebView2Find) -> windows_core::Result<()> {
    let mut count = 0;
    let mut index = -1;
    unsafe {
        find.MatchCount(&mut count)?;
        find.ActiveMatchIndex(&mut index)?;
    }
    let _ = app.emit_to(SHELL, "orla-find", serde_json::json!({ "id": id, "count": count, "index": index }));
    Ok(())
}

pub fn register(core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2, app: &AppHandle, id: &str) {
    let Ok(find) = core.cast::<ICoreWebView2_28>().and_then(|core| unsafe { core.Find() }) else { return };
    let app_index = app.clone();
    let index_id = id.to_owned();
    let index = FindActiveMatchIndexChangedEventHandler::create(Box::new(move |sender, _| {
        if let Some(find) = sender { report(&app_index, &index_id, &find)?; }
        Ok(())
    }));
    let app_count = app.clone();
    let count_id = id.to_owned();
    let count = FindMatchCountChangedEventHandler::create(Box::new(move |sender, _| {
        if let Some(find) = sender { report(&app_count, &count_id, &find)?; }
        Ok(())
    }));
    let mut token = 0;
    unsafe {
        let _ = find.add_ActiveMatchIndexChanged(&index, &mut token);
        let _ = find.add_MatchCountChanged(&count, &mut token);
    }
}

#[tauri::command]
pub async fn find_in_page(caller: Webview, app: AppHandle, id: u32, action: String, query: Option<String>) -> CommandResult {
    ui_only(&caller)?;
    let label = tab_label(id);
    let view = app.get_webview(&label).ok_or("Nenhuma página aberta para buscar.")?;
    if !matches!(action.as_str(), "start" | "next" | "previous" | "stop")
        || (action == "start" && !query.as_ref().is_some_and(|value| !value.is_empty() && value.len() <= 4096)) {
        return Err("Busca na página inválida.".into());
    }
    view.with_webview(move |platform| {
        let result = (|| {
            let core = unsafe { platform.controller().CoreWebView2()?.cast::<ICoreWebView2_28>()? };
            let find = unsafe { core.Find()? };
            match action.as_str() {
                "start" => {
                    let options = unsafe { core.Environment()?.cast::<ICoreWebView2Environment15>()?.CreateFindOptions()? };
                    unsafe {
                        options.SetFindTerm(&HSTRING::from(query.unwrap_or_default()))?;
                        options.SetSuppressDefaultFindDialog(true)?;
                    }
                    let app = app.clone();
                    let label = label.clone();
                    let report_find = find.clone();
                    let callback = FindStartCompletedHandler::create(Box::new(move |status| {
                        if let Err(error) = status {
                            let _ = app.emit_to(SHELL, "orla-find", serde_json::json!({ "id": label, "error": error.to_string() }));
                            return Ok(());
                        }
                        report(&app, &label, &report_find)
                    }));
                    unsafe { find.Start(&options, &callback) }
                }
                "next" => unsafe { find.FindNext() },
                "previous" => unsafe { find.FindPrevious() },
                _ => unsafe { find.Stop() },
            }
        })();
        if let Err(error) = result {
            let _ = app.emit_to(SHELL, "orla-find", serde_json::json!({ "id": label, "error": error.to_string() }));
        }
    }).map_err(as_message)
}
