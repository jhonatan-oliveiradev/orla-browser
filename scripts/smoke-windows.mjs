import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const app = process.argv[2];
assert.ok(app, 'Informe o caminho do executável instalado.');
const fixture = createServer((request, response) => {
  if (request.url === '/fixture.txt') {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename=orla-smoke.txt' });
    response.end('Download de teste do Orla.');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Teste local Orla</title><main><p>marcador</p><p>marcador</p><a id="download" href="/fixture.txt" download>Baixar</a></main>');
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
const url = 'http://127.0.0.1:' + fixture.address().port + '/';
const extension = await mkdtemp(join(tmpdir(), 'orla-smoke-extension-'));
await writeFile(join(extension, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Orla smoke fixture', version: '1.0.0',
  content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['fixture.js'] }],
}));
await writeFile(join(extension, 'fixture.js'), "document.documentElement.dataset.orlaSmoke = 'loaded';");

async function until(label, run, timeout = 25000) {
  const end = Date.now() + timeout;
  let failure;
  while (Date.now() < end) {
    try {
      const result = await run();
      if (result) return result;
    } catch (error) { failure = error.message; }
    await delay(225);
  }
  throw new Error(label + (failure ? ' (' + failure + ')' : ''));
}

async function open() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(app, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + port },
    stdio: 'ignore',
  });
  let socket;
  try {
    const target = await until('A interface do Orla não respondeu ao teste de inicialização.', async () => {
      if (child.exitCode !== null) throw new Error('Saída do aplicativo: ' + child.exitCode);
      const pages = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(1000) }).then((r) => r.json());
      return pages.find((page) => page.type === 'page' && new URL(page.url).hostname === 'tauri.localhost');
    });
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
    let sequence = 0;
    async function evaluate(expression) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(new Error('Sem resposta da interface.')), 8000);
        function finish(error, value) {
          socket.removeEventListener('message', onMessage);
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(value);
        }
        function onMessage({ data }) {
          const message = JSON.parse(data);
          if (message.id !== id) return;
          const failure = message.error?.message || message.result?.exceptionDetails?.exception?.description;
          finish(failure ? new Error(failure) : null, message.result?.result?.value);
        }
        socket.addEventListener('message', onMessage);
        socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
      });
    }
    await until('A barra do Orla não ficou disponível.', () => evaluate("Boolean(document.querySelector('#address') && window.__TAURI__?.core)"));
    return { child, socket, evaluate };
  } catch (error) {
    socket?.close();
    child.kill();
    throw error;
  }
}

function click(selector) {
  return 'document.querySelector(' + JSON.stringify(selector) + ').click()';
}

function fill(selector, value) {
  return `(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    field.value = ${JSON.stringify(value)};
    field.dispatchEvent(new Event('input', { bubbles: true }));
  })()`;
}

function visibleText(selector, value) {
  return `document.querySelector(${JSON.stringify(selector)})?.innerText.includes(${JSON.stringify(value)})`;
}

async function close(run) {
  run.socket.close();
  if (run.child.exitCode !== null) return;
  const exited = once(run.child, 'exit');
  run.child.kill();
  await exited;
}

let running;
try {
  running = await open();
  let evaluate = running.evaluate;
  await evaluate(fill('#address', url) + "; document.querySelector('#address-form').requestSubmit()");
  await until('A página de teste não abriu no WebView2.', () => evaluate(visibleText('#tab-list', 'Teste local Orla')));
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })); " + fill('#find-query', 'marcador'));
  await until('A busca nativa não retornou duas ocorrências.', () => evaluate(visibleText('#find-status', '/ 2')));
  await evaluate(click('#find-close'));
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true }))");
  await until('A DevTools integrada não inspecionou o documento.', () => evaluate(visibleText('#devtools-tree', '<body>')));
  await evaluate(click('#devtools-close'));

  await evaluate(click('#extensions-toggle'));
  await until('O gerenciador de extensões não abriu.', () => evaluate("document.querySelector('#extensions-dialog').open && !document.querySelector('#extensions-dialog').hasAttribute('aria-busy')"));
  await evaluate(fill('#extension-path', extension) + "; document.querySelector('#extension-form').requestSubmit()");
  await until('A extensão local não foi instalada.', () => evaluate(visibleText('#extensions-list', 'Orla smoke fixture')));
  await evaluate("document.querySelector('#extensions-dialog').close()");
  await evaluate(click('[data-tab-action="reload"]') + '; ' + click('#devtools-toggle'));
  await until('A extensão não foi executada na página.', async () => evaluate(
    `(async () => (await __TAURI__.core.invoke('devtools_action', {
       id: Number(document.querySelector('#tab-list [aria-current="true"]').dataset.tabId),
       action: 'evaluate', expression: 'document.documentElement.dataset.orlaSmoke',
    })).text === 'loaded')()`));
  await evaluate(`__TAURI__.core.invoke('devtools_action', {
     id: Number(document.querySelector('#tab-list [aria-current="true"]').dataset.tabId),
     action: 'evaluate', expression: 'document.getElementById("download").click()',
  })`);
  await evaluate(click('#downloads-toggle'));
  await until('O download não foi concluído.', () => evaluate(visibleText('#downloads-list', 'Concluído')));

  await close(running);
  running = await open();
  evaluate = running.evaluate;
  await until('A aba do projeto não foi restaurada após encerrar o aplicativo.', () => evaluate(visibleText('#tab-list', 'Teste local Orla')));
  await evaluate(click('#downloads-toggle'));
  await until('O histórico de downloads não foi restaurado.', () => evaluate(visibleText('#downloads-list', 'orla-smoke.txt')));
  console.log('Passou: inicialização, busca nativa, DevTools integrada, extensão e histórico após reinício.');
} finally {
  if (running) await close(running);
  fixture.close();
  await rm(extension, { force: true, recursive: true });
}
