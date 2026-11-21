use std::{sync::mpsc, time::{Duration, Instant}};

use serde_json::Value;
use tauri::{App, Manager};

use crate::SHELL;

pub fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let (Ok(url), Some(result_path)) = (std::env::var("ORLA_SMOKE_URL"), std::env::var_os("ORLA_SMOKE_RESULT")) else {
        return Ok(());
    };
    let webview = app.get_webview(SHELL).ok_or("A janela do teste não foi criada.")?;
    let state = serde_json::json!({
        "url": url,
        "extension": std::env::var("ORLA_SMOKE_EXTENSION").unwrap_or_default(),
        "phase": std::env::var("ORLA_SMOKE_PHASE").unwrap_or_default(),
    });
    let script = format!(r#"
        (() => {{
          if (window.__TAURI__?.core && document.querySelector('#tab-list button') && !window.orlaSmoke) {{
            window.orlaSmoke = {state};
            {}
          }}
          return {{ result: window.orlaSmokeResult || '', url: location.href,
                    status: document.querySelector('#status')?.textContent, started: Boolean(window.orlaSmoke) }};
        }})()
    "#, include_str!("../../scripts/smoke-windows-ui.js"));
    std::thread::spawn(move || {
        let started = Instant::now();
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
