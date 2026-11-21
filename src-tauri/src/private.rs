use tauri::{
    webview::{NewWindowResponse, WebviewBuilder, WebviewWindowBuilder},
    AppHandle, Emitter, Manager, Url, Webview, WebviewUrl,
};

use crate::{as_message, ui_only, website, CommandResult, Viewport};

const PRIVATE: &str = "orla-private";
const PAGE: &str = "private-page";

#[tauri::command]
pub async fn open_private(caller: Webview, app: AppHandle) -> CommandResult {
    ui_only(&caller)?;
    if let Some(window) = app.get_webview_window(PRIVATE) {
        return window.set_focus().map_err(as_message);
    }
    let directory = app.path().app_local_data_dir().map_err(as_message)?.join("Private");
    WebviewWindowBuilder::new(&app, PRIVATE, WebviewUrl::App("private.html".into()))
        .title("Orla · Janela privada")
        .inner_size(1040.0, 720.0)
        .min_inner_size(460.0, 360.0)
        .data_directory(directory)
        .incognito(true)
        .build().map_err(as_message)?;
    Ok(())
}

#[cfg(windows)]
async fn verify_private(view: &Webview) -> CommandResult {
    use tauri::async_runtime::channel;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_13;
    use windows_core::Interface;
    let (send, mut receive) = channel(1);
    view.with_webview(move |native| {
        let result = (|| unsafe {
            let profile = native.controller().CoreWebView2()?.cast::<ICoreWebView2_13>()?.Profile()?;
            let mut enabled = Default::default();
            profile.IsInPrivateModeEnabled(&mut enabled)?;
            Ok::<_, windows_core::Error>(enabled.as_bool())
        })();
        let _ = send.try_send(result);
    }).map_err(as_message)?;
    match receive.recv().await {
        Some(Ok(true)) => Ok(()),
        _ => Err("O runtime não confirmou o modo privado. Atualize o WebView2.".into()),
    }
}

#[tauri::command]
pub async fn private_page(
    caller: Webview, app: AppHandle, action: String, address: Option<String>, viewport: Viewport,
) -> CommandResult {
    if caller.label() != PRIVATE { return Err("Ação exclusiva da janela privada.".into()); }
    let window = app.get_window(PRIVATE).ok_or("Janela indisponível.")?;
    let bounds = viewport.bounds(&window)?;
    let existing = app.get_webview(PAGE);
    if action != "navigate" {
        let Some(view) = existing else { return Ok(()) };
        return match action.as_str() {
            "back" => view.eval("history.back()"),
            "forward" => view.eval("history.forward()"),
            "reload" => view.eval("location.reload()"),
            "resize" => view.set_bounds(bounds),
            _ => return Err("Ação inválida.".into()),
        }.map_err(as_message);
    }
    let url = address.and_then(|value| Url::parse(&value).ok()).filter(website).ok_or("Endereço inválido.")?;
    if let Some(view) = existing { return view.navigate(url).map_err(as_message); }
    let data = app.path().app_local_data_dir().map_err(as_message)?.join("Private");
    let builder = WebviewBuilder::new(PAGE, WebviewUrl::External("about:blank".parse().unwrap()))
        .incognito(true).data_directory(data)
        .on_navigation(|url| url.as_str() == "about:blank" || website(url))
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_page_load(|view, payload| {
            if website(payload.url()) {
                let _ = view.app_handle().emit_to(PRIVATE, "orla-private-location", payload.url().as_str());
            }
        });
    let view = window.add_child(builder, bounds.position, bounds.size).map_err(as_message)?;
    #[cfg(windows)]
    if let Err(error) = verify_private(&view).await {
        let _ = view.close();
        return Err(error);
    }
    view.navigate(url).map_err(as_message)
}
