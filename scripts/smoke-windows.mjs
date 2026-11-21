import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const app = process.argv[2];
assert.ok(app, 'Informe o caminho do executável de teste.');
const fixture = createServer((request, response) => {
  if (request.url === '/fixture.txt') {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename=orla-smoke.txt' });
    response.end('Download de teste do Orla.');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const title = request.url === '/second' ? 'Segundo painel Orla' : 'Teste local Orla';
  response.end('<!doctype html><title>' + title + '</title><style>body{background:white}</style><main><h1>Artigo Orla</h1><p>marcador</p><p>marcador</p><p>' + 'Uma frase para validar a leitura simplificada. '.repeat(5) + '</p><a id="download" href="/fixture.txt" download>Baixar</a></main>');
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
const url = 'http://127.0.0.1:' + fixture.address().port + '/';
const scratch = await mkdtemp(join(tmpdir(), 'orla-smoke-'));
const extension = join(scratch, 'extension');
await mkdir(extension);
await writeFile(join(extension, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Orla smoke fixture', version: '1.0.0',
  content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['fixture.js'] }],
}));
await writeFile(join(extension, 'fixture.js'), "document.documentElement.dataset.orlaSmoke = 'loaded';");

async function run(phase) {
  const result = join(scratch, phase + '.txt');
  const child = spawn(app, [], {
    env: {
      ...process.env,
      ORLA_SMOKE_URL: url,
      ORLA_SMOKE_PHASE: phase,
      ORLA_SMOKE_RESULT: result,
      ORLA_SMOKE_EXTENSION: extension,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const exit = once(child, 'exit');
  // This time budget covers opening the UI as well as the full fixture flow.
  const deadline = Date.now() + 90_000;
  try {
    while (Date.now() < deadline) {
      const reply = await readFile(result, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return '';
        throw error;
      });
      if (reply) {
        assert.equal(reply, 'ok');
        if (phase === 'exercise') await delay(4500);
        return;
      }
      if (child.exitCode !== null) throw new Error('Saída antecipada do Orla: ' + child.exitCode);
      await delay(250);
    }
    throw new Error('O WebView2 não concluiu a etapa ' + phase + '.');
  } finally {
    if (child.exitCode === null) child.kill();
    await exit;
  }
}

try {
  await run('exercise');
  await run('verify');
  console.log('Passou: busca nativa, DevTools, extensão, tela dividida, leitura, cookies isolados e persistência de abas, notas e downloads.');
} finally {
  fixture.close();
  await rm(scratch, { recursive: true, force: true });
}
