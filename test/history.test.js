import assert from 'node:assert/strict';
import test from 'node:test';
import { addVisit, matchesPage, readHistory, suggestPages } from '../ui/history.js';
import { resolveNavigation } from '../ui/address.js';
import { providerAddress } from '../ui/web-search.js';

test('keeps individual visits, orders by date and ignores malformed records', () => {
  const history = [];
  addVisit(history, 'https://orla.example/artigo', 'Artigo', 10);
  addVisit(history, 'https://orla.example/artigo', 'Voltei ao artigo', 20);
  assert.equal(addVisit(history, 'javascript:alert(1)', '', 30), null);
  const restored = readHistory(JSON.stringify([history[1], false, history[0], { url: 'about:blank', visitedAt: 5 }]));
  assert.deepEqual(restored.map(({ title, visitedAt }) => [title, visitedAt]), [
    ['Voltei ao artigo', 20], ['Artigo', 10],
  ]);
  assert.equal(matchesPage('acao dev', 'https://orla.dev/a%C3%A7%C3%A3o', 'Orla'), true);
});

test('deduplicates suggestions and prioritizes an open tab over a favorite or visit for the same URL', () => {
  const tab = 'https://github.com/orla';
  const history = [{ url: tab, title: 'Orla GitHub' }, { url: 'https://github.com/other', title: 'Outro' }];
  const entries = suggestPages('github', {
    tabs: new Map([[9, { url: tab }], [10, { url: 'https://github.com/current' }]]),
    activeId: 10, favorites: new Map([[tab, 'GitHub']]), history,
  });
  assert.deepEqual(entries.map(({ kind, id }) => [kind, id]), [['tab', 9], ['history', undefined]]);
  const [matchedAlias] = suggestPages('design kit', {
    tabs: new Map([[9, { url: tab, title: 'GitHub' }]]),
    activeId: 0, favorites: new Map([[tab, 'Design Kit']]), history,
  });
  assert.deepEqual([matchedAlias.kind, matchedAlias.id], ['tab', 9]);
  assert.equal(suggestPages(' ', { tabs: [], favorites: [], history }).length, 0);
});

test('separates browser queries from URLs and accepts explicit SearXNG origins', () => {
  assert.deepEqual(resolveNavigation(' Orla browser '), { query: 'Orla browser' });
  assert.deepEqual(resolveNavigation('example.org'), { url: 'https://example.org/' });
  assert.equal(providerAddress('https://busca.example/searxng'), 'https://busca.example/searxng');
  assert.equal(providerAddress('http://127.0.0.1:8080'), 'http://127.0.0.1:8080/');
  for (const invalid of ['http://busca.example', 'https://user@busca.example', 'https://busca.example/?q=1']) {
    assert.throws(() => providerAddress(invalid), /HTTPS/);
  }
});

test('finds workspaces and preserves separate tabs with the same address in different workspaces', () => {
  const url = 'https://example.org/review';
  const options = {
    tabs: new Map([[11, { url, title: 'Review', workspaceId: 1 }], [22, { url, title: 'Review', workspaceId: 2 }]]),
    workspaces: new Map([[1, { name: 'Pessoal' }], [2, { name: 'Estúdio NX' }]]),
    activeWorkspaceId: 1, activeId: 99, favorites: new Map([[url, 'Review']]), history: [],
  };
  assert.deepEqual(suggestPages('review', options).map(({ kind, id, workspace }) => [kind, id, workspace]), [
    ['tab', 11, 'Pessoal'], ['tab', 22, 'Estúdio NX'],
  ]);
  assert.deepEqual(suggestPages('estudio', options).map(({ kind, id }) => [kind, id]), [
    ['workspace', 2], ['tab', 22],
  ]);
  assert.deepEqual(suggestPages('estudio review', options).map(({ kind, id }) => [kind, id]), [['tab', 22]]);
});
