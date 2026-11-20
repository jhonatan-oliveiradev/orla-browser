use std::{io::Read, path::PathBuf, sync::OnceLock};

use tauri::{async_runtime::{channel, Mutex}, webview::WebviewBuilder, AppHandle, LogicalPosition, LogicalSize, Manager, Webview, WebviewUrl};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::{ICoreWebView2BrowserExtension, ICoreWebView2Profile7, ICoreWebView2_13},
    take_pwstr, BrowserExtensionEnableCompletedHandler, BrowserExtensionRemoveCompletedHandler,
    ProfileAddBrowserExtensionCompletedHandler, ProfileGetBrowserExtensionsCompletedHandler,
};
use windows_core::{HSTRING, Interface};

use crate::{as_message, ui_only, SHELL};

const HOST: &str = "extension-profile";
static HOST_INIT: OnceLock<Mutex<()>> = OnceLock::new();

pub fn site_profile(builder: WebviewBuilder<tauri::Wry>, app: &AppHandle) -> Result<WebviewBuilder<tauri::Wry>, String> {
    let directory = app.path().app_local_data_dir().map_err(as_message)?.join("Sites");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(builder.data_directory(directory).browser_extensions_enabled(true))
}

fn host(app: &AppHandle) -> Result<Webview, String> {
    if let Some(view) = app.get_webview(HOST) { return Ok(view); }
    let window = app.get_window(SHELL).ok_or("Janela indisponível.")?;
    let builder = WebviewBuilder::new(HOST, WebviewUrl::External("about:blank".parse().unwrap()))
        .on_navigation(|url| url.as_str() == "about:blank");
    let view = window.add_child(site_profile(builder, app)?, LogicalPosition::new(-100, -100), LogicalSize::new(1, 1))
        .map_err(as_message)?;
    view.hide().map_err(as_message)?;
    Ok(view)
}

fn extension_info(extension: &ICoreWebView2BrowserExtension) -> windows_core::Result<serde_json::Value> {
    let mut id = Default::default();
    let mut name = Default::default();
    let mut enabled = Default::default();
    unsafe { extension.Id(&mut id)? };
    let id = take_pwstr(id);
    unsafe { extension.Name(&mut name)? };
    let name = take_pwstr(name);
    unsafe { extension.IsEnabled(&mut enabled)? };
    Ok(serde_json::json!({ "id": id, "name": name, "enabled": enabled.as_bool() }))
}

fn folder(value: Option<String>) -> Result<PathBuf, String> {
    let path = PathBuf::from(value.as_deref().unwrap_or("").trim().trim_matches('"'));
    if !path.is_absolute() || !path.join("manifest.json").is_file() {
        return Err("Informe o caminho completo da pasta que contém manifest.json.".into());
    }
    Ok(path)
}

fn preview(path: PathBuf) -> Result<serde_json::Value, String> {
    let file = std::fs::File::open(path.join("manifest.json")).map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    file.take(524_289).read_to_end(&mut bytes).map_err(|error| error.to_string())?;
    if bytes.len() > 524_288 { return Err("O manifesto excede 512 KB.".into()); }
    let manifest: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| "O manifesto deve ser um JSON válido.")?;
    let name = manifest["name"].as_str().filter(|value| !value.trim().is_empty()).ok_or("O manifesto precisa indicar o nome da extensão.")?;
    let version = manifest["version"].as_str().ok_or("O manifesto precisa indicar a versão da extensão.")?;
    let mut permissions = std::collections::BTreeSet::new();
    for key in ["permissions", "host_permissions", "optional_permissions", "optional_host_permissions"] {
        for value in manifest[key].as_array().into_iter().flatten().filter_map(serde_json::Value::as_str) {
            let label = if key.starts_with("optional") { format!("{value} (opcional)") } else { value.to_owned() };
            permissions.insert(label.chars().take(300).collect::<String>());
        }
    }
    for script in manifest["content_scripts"].as_array().into_iter().flatten() {
        for site in script["matches"].as_array().into_iter().flatten().filter_map(serde_json::Value::as_str) {
            permissions.insert(site.chars().take(300).collect());
        }
    }
    let truncated = permissions.len() > 100;
    Ok(serde_json::json!({
        "name": name.chars().take(140).collect::<String>(),
        "version": version.chars().take(32).collect::<String>(),
        "manifestVersion": manifest["manifest_version"],
        "permissions": permissions.into_iter().take(100).collect::<Vec<_>>(),
        "truncated": truncated,
    }))
}

#[tauri::command]
pub async fn extension_action(
    caller: Webview, app: AppHandle, action: String, path: Option<String>, id: Option<String>, enabled: Option<bool>,
) -> Result<serde_json::Value, String> {
    ui_only(&caller)?;
    if action == "preview" { return preview(folder(path)?); }
    let path = match action.as_str() {
        "install" => Some(folder(path)?),
        "list" => None,
        "enable" if id.is_some() && enabled.is_some() => None,
        "remove" if id.is_some() => None,
        _ => return Err("Ação de extensão inválida.".into()),
    };

    let view = {
        let _guard = HOST_INIT.get_or_init(|| Mutex::new(())).lock().await;
        host(&app)?
    };
    let (done, mut receiver) = channel(1);
    view.with_webview(move |platform| {
    let report = done.clone();
    let result = (|| {
        let core = unsafe { platform.controller().CoreWebView2()? };
        let profile = unsafe { core.cast::<ICoreWebView2_13>()?.Profile()?.cast::<ICoreWebView2Profile7>()? };
        if let Some(path) = path {
            let callback = ProfileAddBrowserExtensionCompletedHandler::create(Box::new(move |status, extension| {
                let result = status.and_then(|_| extension.ok_or_else(|| windows_core::Error::from_hresult(windows_core::HRESULT(0x80004005u32 as i32))))
                    .and_then(|extension| extension_info(&extension));
                let _ = done.try_send(result.map_err(|error| format!("Não foi possível carregar a extensão. {error}")));
                Ok(())
            }));
            let path = HSTRING::from(path.as_os_str());
            return unsafe { profile.AddBrowserExtension(&path, &callback) };
        }
        let callback = ProfileGetBrowserExtensionsCompletedHandler::create(Box::new(move |status, list| {
            let result = (|| {
                status?;
                let list = list.ok_or_else(|| windows_core::Error::from_hresult(windows_core::HRESULT(0x80004005u32 as i32)))?;
                let mut count = 0;
                unsafe { list.Count(&mut count)? };
                let mut items = Vec::new();
                for index in 0..count {
                    let extension = unsafe { list.GetValueAtIndex(index)? };
                    let info = extension_info(&extension)?;
                    if action == "list" {
                        items.push(info);
                    } else if info["id"].as_str() == id.as_deref() {
                        let complete = done.clone();
                        if let Some(enabled) = enabled.filter(|_| action == "enable") {
                            let callback = BrowserExtensionEnableCompletedHandler::create(Box::new(move |status| {
                                let _ = complete.try_send(status.map(|_| serde_json::Value::Null).map_err(|e| e.to_string()));
                                Ok(())
                            }));
                            return unsafe { extension.Enable(enabled, &callback) };
                        }
                        let callback = BrowserExtensionRemoveCompletedHandler::create(Box::new(move |status| {
                            let _ = complete.try_send(status.map(|_| serde_json::Value::Null).map_err(|e| e.to_string()));
                            Ok(())
                        }));
                        return unsafe { extension.Remove(&callback) };
                    }
                }
                let _ = done.try_send(if action == "list" {
                    Ok(serde_json::Value::Array(items))
                } else {
                    Err("Esta extensão não está mais instalada.".into())
                });
                Ok(())
            })();
            if let Err(error) = result { let _ = done.try_send(Err(error.to_string())); }
            Ok(())
        }));
        unsafe { profile.GetBrowserExtensions(&callback) }
    })();
    if let Err(error) = result {
        let _ = report.try_send(Err(format!("O WebView2 não conseguiu acessar as extensões. {error}")));
    }
    }).map_err(as_message)?;
    receiver.recv().await.ok_or("Não foi possível acessar o perfil de extensões.")?
}

#[tauri::command]
pub async fn choose_extension_folder(caller: Webview, app: AppHandle) -> Result<Option<String>, String> {
    use windows::Win32::{
        System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
        UI::Shell::{FileOpenDialog, IFileOpenDialog, FOS_FORCEFILESYSTEM, FOS_PICKFOLDERS, SIGDN_FILESYSPATH},
    };

    ui_only(&caller)?;
    let (send, mut receive) = channel(1);
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let result = (|| {
            let window = handle.get_window(SHELL).ok_or("Janela indisponível.")?;
            let parent = window.hwnd().map_err(as_message)?;
            let selected = (|| unsafe {
                let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None::<&windows_core::IUnknown>, CLSCTX_INPROC_SERVER)?;
                dialog.SetTitle(windows_core::w!("Selecionar a pasta da extensão"))?;
                dialog.SetOptions(dialog.GetOptions()? | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM)?;
                match dialog.Show(Some(parent)) {
                    Ok(()) => Ok(Some(take_pwstr(dialog.GetResult()?.GetDisplayName(SIGDN_FILESYSPATH)?))),
                    Err(error) if error.code().0 as u32 == 0x800704c7 => Ok(None),
                    Err(error) => Err(error),
                }
            })();
            selected.map_err(|error: windows_core::Error| error.to_string())
        })();
        let _ = send.try_send(result);
    }).map_err(as_message)?;
    receive.recv().await.ok_or("O seletor de pastas foi fechado.")?
}
