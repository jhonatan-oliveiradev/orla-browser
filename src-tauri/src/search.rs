use serde::{Deserialize, Serialize};
use tauri::{Url, Webview};

use crate::{ui_only, website};

#[derive(Deserialize)]
struct SearchResponse {
    results: Vec<ProviderResult>,
}

#[derive(Deserialize)]
struct ProviderResult {
    url: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    content: String,
}

#[derive(Serialize)]
pub struct SearchResult {
    url: String,
    title: String,
    excerpt: String,
}

fn search_url(provider: &str, query: &str) -> Result<Url, String> {
    let mut url = Url::parse(provider.trim()).map_err(|_| "Endereço do provedor inválido.")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !website(&url) || url.query().is_some() || url.fragment().is_some()
        || (url.scheme() != "https" && !local)
    {
        return Err("Use um provedor HTTPS ou uma instância HTTP no próprio computador.".into());
    }
    let path = format!("{}/search", url.path().trim_end_matches('/'));
    url.set_path(&path);
    url.query_pairs_mut()
        .append_pair("q", query)
        .append_pair("format", "json")
        .append_pair("language", "pt-BR");
    Ok(url)
}

#[tauri::command]
pub async fn search_web(
    caller: Webview, provider: String, query: String,
) -> Result<Vec<SearchResult>, String> {
    ui_only(&caller)?;
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 300 {
        return Err("Digite uma pesquisa de até 300 caracteres.".into());
    }
    let url = search_url(&provider, query)?;
    let body = tauri::async_runtime::spawn_blocking(move || request::get(&url))
        .await
        .map_err(|_| "Não foi possível concluir a pesquisa.")??;
    let response: SearchResponse = serde_json::from_slice(&body)
        .map_err(|_| "O provedor não retornou resultados JSON válidos. Confira a configuração do SearXNG.")?;
    let mut seen = std::collections::HashSet::new();
    Ok(response.results.into_iter()
        .filter_map(|item| {
            let url = Url::parse(&item.url).ok()?;
            if !website(&url) || !seen.insert(url.to_string()) { return None; }
            Some(SearchResult {
                url: url.to_string(),
                title: item.title.trim().chars().take(180).collect(),
                excerpt: item.content.trim().chars().take(520).collect(),
            })
        })
        .take(20)
        .collect())
}

#[cfg(not(windows))]
mod request {
    pub fn get(_url: &tauri::Url) -> Result<Vec<u8>, String> {
        Err("O buscador nativo está disponível no Orla para Windows.".into())
    }
}

#[cfg(windows)]
mod request {
    use std::{ffi::c_void, mem::size_of, ptr::{null, null_mut}, time::{Duration, Instant}};
    use tauri::Url;
    use windows_sys::Win32::Networking::WinHttp::*;

    struct Handle(*mut c_void);

    impl Handle {
        fn new(raw: *mut c_void) -> Result<Self, String> {
            if raw.is_null() { Err(failure()) } else { Ok(Self(raw)) }
        }

        fn option(&self, option: u32, value: u32) -> Result<(), String> {
            check(unsafe {
                WinHttpSetOption(self.0, option, (&value as *const u32).cast(), size_of::<u32>() as u32)
            })
        }
    }

    impl Drop for Handle {
        fn drop(&mut self) {
            unsafe { WinHttpCloseHandle(self.0) };
        }
    }

    fn failure() -> String {
        "Não foi possível conectar ao provedor de pesquisa. Confira o endereço e tente novamente.".into()
    }

    fn check(result: i32) -> Result<(), String> {
        if result == 0 { Err(failure()) } else { Ok(()) }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn get(url: &Url) -> Result<Vec<u8>, String> {
        let started = Instant::now();
        let https = url.scheme() == "https";
        let access = if https { WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY } else { WINHTTP_ACCESS_TYPE_NO_PROXY };
        let session = Handle::new(unsafe { WinHttpOpen(wide("Orla Browser").as_ptr(), access, null(), null(), 0) })?;
        check(unsafe { WinHttpSetTimeouts(session.0, 3500, 3500, 4500, 5500) })?;
        let host = wide(url.host_str().ok_or_else(failure)?);
        let port = url.port_or_known_default().ok_or_else(failure)?;
        let connection = Handle::new(unsafe { WinHttpConnect(session.0, host.as_ptr(), port, 0) })?;
        let target = wide(&format!("{}?{}", url.path(), url.query().unwrap_or_default()));
        let flags = if https { WINHTTP_FLAG_SECURE } else { 0 };
        let request = Handle::new(unsafe {
            WinHttpOpenRequest(connection.0, wide("GET").as_ptr(), target.as_ptr(), null(), null(), null(), flags)
        })?;
        request.option(WINHTTP_OPTION_REDIRECT_POLICY, WINHTTP_OPTION_REDIRECT_POLICY_NEVER)?;
        request.option(WINHTTP_OPTION_DISABLE_FEATURE, WINHTTP_DISABLE_COOKIES | WINHTTP_DISABLE_AUTHENTICATION)?;
        check(unsafe { WinHttpSendRequest(request.0, null(), 0, null(), 0, 0, 0) })?;
        check(unsafe { WinHttpReceiveResponse(request.0, null_mut()) })?;

        let mut status = 0u32;
        let mut size = size_of::<u32>() as u32;
        check(unsafe {
            WinHttpQueryHeaders(request.0, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                null(), (&mut status as *mut u32).cast(), &mut size, null_mut())
        })?;
        if status == 403 {
            return Err("O provedor recusou o formato JSON. Ative o formato json no SearXNG.".into());
        }
        if status != 200 {
            return Err(format!("O provedor retornou HTTP {status}. Confira o endereço configurado."));
        }

        let mut body = Vec::new();
        let mut buffer = [0u8; 8192];
        loop {
            if started.elapsed() > Duration::from_secs(12) {
                return Err("O provedor demorou para responder. Tente novamente.".into());
            }
            let mut read = 0;
            check(unsafe { WinHttpReadData(request.0, buffer.as_mut_ptr().cast(), buffer.len() as u32, &mut read) })?;
            if read == 0 { break; }
            if body.len() + read as usize > 1024 * 1024 {
                return Err("O provedor enviou uma resposta grande demais.".into());
            }
            body.extend_from_slice(&buffer[..read as usize]);
        }
        Ok(body)
    }
}
