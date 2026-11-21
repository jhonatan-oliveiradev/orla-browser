use std::{sync::mpsc, time::{Duration, Instant}};

use serde_json::Value;
use tauri::{App, AppHandle, Manager, Webview};

use crate::SHELL;

pub fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let (Ok(url), Some(result_path)) = (std::env::var("ORLA_SMOKE_URL"), std::env::var_os("ORLA_SMOKE_RESULT")) else {
        return Ok(());
    };
    let webview = app.get_webview(SHELL).ok_or("A janela do teste não foi criada.")?;
    let state = serde_json::json!({
        "url": &url,
        "extension": std::env::var("ORLA_SMOKE_EXTENSION").unwrap_or_default(),
        "phase": std::env::var("ORLA_SMOKE_PHASE").unwrap_or_default(),
    });
    let app = app.handle().clone();
    let script = format!(r#"
        (() => {{
          if (window.__TAURI__?.core && document.querySelector('#tab-list button') && !window.orlaSmoke) {{
            window.orlaSmoke = {state};
            {}
          }}
          return {{ result: window.orlaSmokeResult || '', url: location.href,
                    status: document.querySelector('#status')?.textContent, started: Boolean(window.orlaSmoke),
                    privateRequested: Boolean(window.orlaSmokePrivate) }};
        }})()
    "#, include_str!("../../scripts/smoke-windows-ui.js"));
    std::thread::spawn(move || {
        let started = Instant::now();
        let mut private_checked = false;
        let mut status = "A interface não respondeu.".to_owned();
        while started.elapsed() < Duration::from_secs(65) {
            let (send, receive) = mpsc::channel();
            let response = webview.eval_with_callback(script.clone(), move |result| {
                let _ = send.send(result);
            });
            if let Err(error) = response {
                status = error.to_string();
                break;
            }
            if let Ok(reply) = receive.recv_timeout(Duration::from_secs(2)) {
                if let Ok(data) = serde_json::from_str::<Value>(&reply) {
                    if data["privateRequested"].as_bool() == Some(true) && !private_checked {
                        let result = check_private(&app, &url);
                        if let Err(error) = result {
                            let _ = std::fs::write(&result_path, error);
                            return;
                        }
                        private_checked = true;
                        let _ = webview.eval("window.orlaSmokePrivatePassed = true");
                    }
                    if let Some(message) = data["result"].as_str().filter(|message| !message.is_empty()) {
                        let _ = std::fs::write(&result_path, message);
                        return;
                    }
                }
                status = format!("Última resposta da janela: {reply}");
            }
            std::thread::sleep(Duration::from_millis(475));
        }
        let _ = std::fs::write(&result_path, status);
    });
    Ok(())
}


fn evaluate(view: &Webview, script: impl Into<String>) -> Option<Value> {
    let (send, receive) = mpsc::channel();
    view.eval_with_callback(script, move |value| { let _ = send.send(value); }).ok()?;
    serde_json::from_str(&receive.recv_timeout(Duration::from_secs(2)).ok()?).ok()
}

fn check_private(app: &AppHandle, url: &str) -> Result<(), String> {
    let address = serde_json::to_string(url).map_err(|error| error.to_string())?;
    let launch = format!(r#"
        (() => {{
            const form = document.getElementById('private-form');
            if (!form || !window.__TAURI__?.core || document.readyState !== 'complete') return false;
            document.getElementById('private-address').value = {address};
            form.requestSubmit();
            return true;
        }})()
    "#);
    let limit = Instant::now() + Duration::from_secs(15);
    let mut requested = false;
    while Instant::now() < limit {
        if !requested {
            if let Some(shell) = app.get_webview("orla-private") {
                requested = evaluate(&shell, launch.clone()) == Some(Value::Bool(true));
            }
        } else if let Some(page) = app.get_webview("private-page") {
            if page.url().ok().is_some_and(|current| current.as_str() == url) {
                if let Some(value) = evaluate(&page, "document.cookie") {
                    if value.as_str() != Some("") {
                        return Err("O perfil privado recebeu cookies da sessão principal.".into());
                    }
                    if let Some(window) = app.get_webview_window("orla-private") { let _ = window.close(); }
                    return Ok(());
                }
            }
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err("A janela privada não navegou com o perfil InPrivate ativo.".into())
}
