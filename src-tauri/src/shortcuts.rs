use tauri::{Emitter, Manager, Webview};
use webview2_com::{
    AcceleratorKeyPressedEventHandler,
    Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
        COREWEBVIEW2_PHYSICAL_KEY_STATUS,
    },
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, VK_CONTROL, VK_F12, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};

use crate::{as_message, CommandResult, SHELL};

fn pressed(key: u16) -> bool {
    // GetKeyState reports the state for the input message on this UI thread.
    unsafe { GetKeyState(i32::from(key)) < 0 }
}

pub fn attach(view: &Webview) -> CommandResult {
    let app = view.app_handle().clone();
    view.with_webview(move |platform| {
        let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
            let mut key = 0;
            let mut status = COREWEBVIEW2_PHYSICAL_KEY_STATUS::default();

            // These arguments are valid only for this WebView2 callback.
            unsafe {
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut key)?;
                args.PhysicalKeyStatus(&mut status)?;
            }
            if kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN || pressed(VK_MENU) || pressed(VK_LWIN) || pressed(VK_RWIN)
            {
                return Ok(());
            }

            let action = match (key, pressed(VK_CONTROL), pressed(VK_SHIFT)) {
                (key, false, false) if key == u32::from(VK_F12) => "devtools",
                (0x49, true, true) => "devtools",
                (0x46, true, false) => "find",
                (0x4c, true, false) => "address",
                (0x54, true, false) => "new-tab",
                (0x54, true, true) => "reopen-tab",
                (0x57, true, false) => "close-tab",
                _ => return Ok(()),
            };
            unsafe { args.SetHandled(true)? };
            if status.WasKeyDown.as_bool() {
                return Ok(());
            }

            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(shell) = app.get_webview(SHELL) {
                    let _ = shell.set_focus();
                    let _ = app.emit_to(SHELL, "orla-shortcut", action);
                }
            });
            Ok(())
        }));
        let mut token = 0;
        // The controller holds the handler for the lifetime of the tab.
        if let Err(error) = unsafe { platform.controller().add_AcceleratorKeyPressed(&handler, &mut token) } {
            eprintln!("Não foi possível registrar atalhos da aba: {error}");
        }
    })
    .map_err(as_message)
}
