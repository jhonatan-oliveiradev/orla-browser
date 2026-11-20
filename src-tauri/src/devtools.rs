use std::{cell::{Cell, RefCell}, rc::Rc, time::{Duration, Instant}};

use serde_json::{json, Value};
use tauri::{async_runtime::channel, AppHandle, Emitter, Manager, Webview};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::ICoreWebView2, take_pwstr,
    CallDevToolsProtocolMethodCompletedHandler, DevToolsProtocolEventReceivedEventHandler,
};
use windows_core::HSTRING;

use crate::{as_message, tab_label, ui_only, website, SHELL};

const MAX_PAYLOAD: usize = 240_000;

thread_local! {
    static INSPECTED: RefCell<Option<u32>> = const { RefCell::new(None) };
}

pub fn register(core: &ICoreWebView2, app: &AppHandle, label: &str) -> windows_core::Result<()> {
    let Ok(id) = label.trim_start_matches("tab-").parse::<u32>() else { return Ok(()) };
    // Keep the engine's shortcut and context-menu item from opening its external window.
    unsafe { core.Settings()?.SetAreDevToolsEnabled(false)? };
    let budget = Rc::new(Cell::new((Instant::now(), 0u16)));
    for event in [
        "DOM.setChildNodes", "Page.frameNavigated", "Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Log.entryAdded",
        "Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFailed", "Network.loadingFinished",
    ] {
        let receiver = unsafe { core.GetDevToolsProtocolEventReceiver(&HSTRING::from(event))? };
        let app = app.clone();
        let budget = budget.clone();
        let callback = DevToolsProtocolEventReceivedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            if !INSPECTED.with_borrow(|current| *current == Some(id)) { return Ok(()) }
            if event != "DOM.setChildNodes" {
                let (started, count) = budget.get();
                if started.elapsed() >= Duration::from_secs(1) {
                    budget.set((Instant::now(), 1));
                } else if count < 240 {
                    budget.set((started, count + 1));
                } else {
                    return Ok(());
                }
            }
            let mut raw = Default::default();
            unsafe { args.ParameterObjectAsJson(&mut raw)? };
            let payload = take_pwstr(raw);
            if payload.len() <= MAX_PAYLOAD {
                if let Ok(data) = serde_json::from_str::<Value>(&payload) {
                    let data = event_data(event, data);
                    let _ = app.emit_to(SHELL, "orla-devtools", json!({ "id": id, "event": event, "data": data }));
                }
            }
            Ok(())
        }));
        let mut token = 0;
        unsafe { receiver.add_DevToolsProtocolEventReceived(&callback, &mut token)? };
    }
    Ok(())
}

fn event_data(event: &str, data: Value) -> Value {
    match event {
        "Page.frameNavigated" => json!({
            "frame": data["frame"]["id"], "parent": data["frame"]["parentId"],
        }),
        "Network.requestWillBeSent" => json!({
            "id": data["requestId"], "method": data["request"]["method"],
            "url": data["request"]["url"], "kind": data["type"], "timestamp": data["timestamp"],
            "document": data["loaderId"], "frame": data["frameId"],
        }),
        "Network.responseReceived" => json!({
            "id": data["requestId"], "status": data["response"]["status"],
            "kind": data["type"], "url": data["response"]["url"],
            "mime": data["response"]["mimeType"], "protocol": data["response"]["protocol"],
            "cache": data["response"]["fromDiskCache"], "timestamp": data["timestamp"],
        }),
        "Network.loadingFailed" => json!({ "id": data["requestId"], "error": data["errorText"], "timestamp": data["timestamp"] }),
        "Network.loadingFinished" => json!({
            "id": data["requestId"], "bytes": data["encodedDataLength"], "timestamp": data["timestamp"],
        }),
        "Runtime.consoleAPICalled" => {
            let args = data["args"].as_array().into_iter().flatten().take(12)
                .map(console_value).collect::<Vec<_>>().join(" ");
            json!({ "level": data["type"], "text": args })
        }
        "Runtime.exceptionThrown" => {
            let details = &data["exceptionDetails"];
            let exception = details["exception"]["description"].as_str().or(details["text"].as_str()).unwrap_or("");
            json!({ "level": "error", "text": clip(exception) })
        }
        "Log.entryAdded" => json!({
            "level": data["entry"]["level"], "text": clip(data["entry"]["text"].as_str().unwrap_or("")),
        }),
        _ => data,
    }
}

fn clip(value: &str) -> String {
    value.chars().take(1600).collect()
}

fn console_value(arg: &Value) -> String {
    if let Some(value) = arg["value"].as_str().or(arg["unserializableValue"].as_str()).or(arg["description"].as_str()) {
        return clip(value);
    }
    if let Some(value) = arg.get("value") { return clip(&value.to_string()); }
    clip(arg["type"].as_str().unwrap_or(""))
}

async fn query(view: &Webview, id: u32, method: &'static str, params: Value, capture: Option<bool>) -> Result<Value, String> {
    let (sender, mut receiver) = channel(1);
    view.with_webview(move |platform| {
        let send = sender.clone();
        let result = (|| {
            let core = unsafe { platform.controller().CoreWebView2()? };
            if let Some(capture) = capture {
                INSPECTED.with_borrow_mut(|current| {
                    if capture { *current = Some(id); }
                    else if *current == Some(id) { *current = None; }
                });
            }
            if matches!(method, "DOM.getDocument" | "DOM.requestChildNodes" | "CSS.getComputedStyleForNode" | "CSS.getMatchedStylesForNode" | "Runtime.evaluate" | "Overlay.highlightNode" | "Overlay.hideHighlight")
                && !INSPECTED.with_borrow(|current| *current == Some(id))
            {
                let _ = send.try_send(Err("A aba não está em inspeção.".into()));
                return Ok(());
            }
            let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |result, data| {
                let reply = result.map_err(|error| error.to_string()).and_then(|_| {
                    if data.len() > MAX_PAYLOAD {
                        return Err("A resposta do DevTools excedeu o tamanho permitido.".into());
                    }
                    serde_json::from_str(&data).map_err(|error| error.to_string())
                });
                let _ = send.try_send(reply);
                Ok(())
            }));
            unsafe { core.CallDevToolsProtocolMethod(&HSTRING::from(method), &HSTRING::from(params.to_string()), &callback) }
        })();
        if let Err(error) = result { let _ = sender.try_send(Err(error.to_string())); }
    }).map_err(as_message)?;
    receiver.recv().await.ok_or_else(|| "A aba foi fechada durante a inspeção.".to_string())?
}

#[tauri::command]
pub async fn devtools_action(
    caller: Webview, app: AppHandle, id: u32, action: String, node_id: Option<u32>, expression: Option<String>,
) -> Result<Value, String> {
    ui_only(&caller)?;
    let Some(view) = app.get_webview(&tab_label(id)) else {
        return if action == "stop" { Ok(Value::Null) } else { Err("A aba ainda não está disponível.".into()) };
    };
    if action != "stop" && !website(&view.url().map_err(as_message)?) {
        return Err("Abra uma página HTTP ou HTTPS para inspecionar.".into());
    }
    match action.as_str() {
        "start" => {
            query(&view, id, "DOM.enable", json!({}), Some(true)).await?;
            for method in ["CSS.enable", "Runtime.enable", "Log.enable", "Network.enable"] {
                query(&view, id, method, json!({}), None).await?;
            }
            let _ = query(&view, id, "Overlay.enable", json!({}), None).await;
            let _ = query(&view, id, "Page.enable", json!({}), None).await;
            let frame = query(&view, id, "Page.getFrameTree", json!({}), None).await.unwrap_or(Value::Null);
            Ok(json!({ "frame": frame["frameTree"]["frame"]["id"] }))
        }
        "stop" => {
            let result = query(&view, id, "Network.disable", json!({}), Some(false)).await;
            for method in ["Overlay.disable", "Page.disable", "Log.disable", "Runtime.disable", "CSS.disable", "DOM.disable"] {
                let _ = query(&view, id, method, json!({}), None).await;
            }
            result
        }
        "document" => query(&view, id, "DOM.getDocument", json!({ "depth": 2 }), None).await,
        "children" | "styles" | "rules" => {
            let node = node_id.filter(|node| *node > 0).ok_or("Elemento inválido.")?;
            let method = match action.as_str() {
                "children" => "DOM.requestChildNodes",
                "rules" => "CSS.getMatchedStylesForNode",
                _ => "CSS.getComputedStyleForNode",
            };
            let params = if action == "children" { json!({ "nodeId": node, "depth": 1 }) } else { json!({ "nodeId": node }) };
            query(&view, id, method, params, None).await
        }
        "highlight" => {
            let node = node_id.filter(|node| *node > 0).ok_or("Elemento inválido.")?;
            query(&view, id, "Overlay.highlightNode", json!({
                "nodeId": node,
                "highlightConfig": {
                    "showInfo": true,
                    "contentColor": { "r": 103, "g": 164, "b": 240, "a": 0.30 },
                    "paddingColor": { "r": 111, "g": 204, "b": 148, "a": 0.30 },
                    "borderColor": { "r": 250, "g": 205, "b": 111, "a": 0.45 },
                    "marginColor": { "r": 232, "g": 153, "b": 116, "a": 0.34 },
                }
            }), None).await
        }
        "hide-highlight" => query(&view, id, "Overlay.hideHighlight", json!({}), None).await,
        "evaluate" => {
            let expression = expression.filter(|value| !value.trim().is_empty() && value.len() <= 4096)
                .ok_or("Digite uma expressão de até 4096 bytes.")?;
            let result = query(&view, id, "Runtime.evaluate", json!({
                "expression": expression, "returnByValue": true, "timeout": 2000,
                "allowUnsafeEvalBlockedByCSP": false, "replMode": true,
            }), None).await?;
            if !result["exceptionDetails"].is_null() {
                return Err(console_value(&result["result"]));
            }
            Ok(json!({ "text": console_value(&result["result"]) }))
        }
        _ => Err("Ação do DevTools desconhecida.".into()),
    }
}
