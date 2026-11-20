import assert from 'node:assert/strict';
import test from 'node:test';
import { readSession, websiteAddress } from '../ui/session.js';

test('starts with one blank tab and the original favorites when storage is unavailable', () => {
  for (const value of [null, '{', '{}', '{"tabs":[]}']) {
    const session = readSession(value);
    assert.deepEqual(session.workspaces[0].tabs, ['']);
    assert.equal(session.workspaces[0].activeIndex, 0);
    assert.deepEqual(Array.from(session.favorites.values()), ['GitHub', 'MDN Web Docs', 'Figma']);
  }
});

test('restores the order and selected tab, including an empty tab and an empty favorites list', () => {
  const session = readSession(JSON.stringify({
    tabs: ['https://example.org/work', '', 'http://localhost:3000/'],
    activeIndex: 2,
    favorites: [],
  }));
  assert.deepEqual(session.workspaces[0].tabs, ['https://example.org/work', '', 'http://localhost:3000/']);
  assert.equal(session.workspaces[0].activeIndex, 2);
  assert.equal(session.favorites.size, 0);
});

test('repairs invalid tab positions and deduplicates valid favorites', () => {
  const session = readSession(JSON.stringify({
    tabs: ['garbage', 'https://example.org'],
    activeIndex: 3,
    favorites: [
      null,
      { url: 'https://example.org', title: '  ' },
      { url: 'https://example.org/', title: 'Duplicate' },
      { url: 'https://example.net/#a', title: '  Referência  ' },
      { url: 'file:///C:/temp', title: 'Local' },
    ],
  }));
  assert.deepEqual(session.workspaces[0].tabs, ['', 'https://example.org/']);
  assert.equal(session.workspaces[0].activeIndex, 0);
  assert.deepEqual(Array.from(session.favorites), [
    ['https://example.org/', 'example.org'],
    ['https://example.net/#a', 'Referência'],
  ]);
});

test('restorable addresses exclude local app origins, credentials and unsupported schemes', () => {
  for (const value of [
    'https://tauri.localhost/',
    'http://ipc.localhost./',
    'https://alice:secret@example.org/',
    'javascript:alert(1)',
    'file:///C:/temp',
    'example.org',
    null,
  ]) assert.equal(websiteAddress(value), '');
  assert.equal(websiteAddress('https://[::1]:8080/?q=a#b'), 'https://[::1]:8080/?q=a#b');
});

test('restores pins for valid pages and leaves older sessions unpinned', () => {
  const tabs = ['https://example.org/', '', 'https://example.com/'];
  assert.equal(readSession(JSON.stringify({ tabs })).workspaces[0].pinnedIndices.size, 0);
  const session = readSession(JSON.stringify({
    tabs, activeIndex: 2, pinnedIndices: [2, 0, 2, 1, -1, 3, '0', null],
  }));
  assert.deepEqual([...session.workspaces[0].pinnedIndices], [2, 0]);
  assert.deepEqual(session.workspaces[0].tabs, tabs);
  assert.equal(session.workspaces[0].activeIndex, 2);
});

test('restores sidebar width and collapse state without breaking existing sessions', () => {
  assert.deepEqual(readSession('{}').sidebar, { width: 240, collapsed: false });
  for (const [width, expected] of [[88, 184], [260.7, 261], [700, 360], ['260', 240]]) {
    const session = readSession(JSON.stringify({ sidebar: { width, collapsed: true } }));
    assert.deepEqual(session.sidebar, { width: expected, collapsed: true });
  }
});

test('restores a supported theme and the background animation preference', () => {
  assert.deepEqual(readSession('{}').appearance, { theme: 'lima', motion: true });
  assert.deepEqual(readSession('{"appearance":{"theme":"lavanda","motion":false}}').appearance,
    { theme: 'lavanda', motion: false });
  assert.deepEqual(readSession('{"appearance":{"theme":"inexistente","motion":"false"}}').appearance,
    { theme: 'lima', motion: true });
});


test('migrates the previous flat session to Principal with its selected tab and pins', () => {
  const tabs = ['https://example.org/', 'https://example.net/', ''];
  const session = readSession(JSON.stringify({ tabs, activeIndex: 1, pinnedIndices: [0] }));
  assert.equal(session.activeWorkspaceId, 0);
  assert.deepEqual(session.workspaces, [{
    id: 0, name: 'Principal', tabs, activeIndex: 1, pinnedIndices: new Set([0]), queries: ['', '', ''],
  }]);
});

test('restores workspace tabs, searches and pins independently', () => {
  const workspaces = [
    { id: 4, name: '  Pessoal  ', tabs: ['https://example.org/', ''], queries: ['ignored', 'orla'], activeIndex: 1, pinnedIndices: [0] },
    { id: 7, name: 'Trabalho', tabs: ['https://example.net/', ''], queries: [null, ''], activeIndex: 0, pinnedIndices: [] },
  ];
  const session = readSession(JSON.stringify({ workspaces, activeWorkspaceId: 7 }));
  assert.equal(session.activeWorkspaceId, 7);
  assert.deepEqual(session.workspaces, [
    { ...workspaces[0], name: 'Pessoal', queries: ['', 'orla'], pinnedIndices: new Set([0]) },
    { ...workspaces[1], queries: ['', ''], pinnedIndices: new Set() },
  ]);
});

test('repairs invalid or duplicate workspace records without losing earlier valid ones', () => {
  const session = readSession(JSON.stringify({
    activeWorkspaceId: -2,
    workspaces: [null, { id: -2 }, { id: 2, name: '  ', tabs: [] }, { id: 2, name: 'Ignorado' }],
  }));
  assert.equal(session.activeWorkspaceId, 2);
  assert.deepEqual(session.workspaces, [{
    id: 2, name: 'Espaço de trabalho', tabs: [''], activeIndex: 0, pinnedIndices: new Set(), queries: [''],
  }]);
});

test('migrates the old note into the original workspace only until it has an explicit note', () => {
  const base = { workspaces: [{ id: 0, name: 'Principal' }, { id: 3, name: 'Projeto' }], activeWorkspaceId: 3 };
  assert.deepEqual([...readSession(JSON.stringify(base), 'Nota antiga').notes], [[0, 'Nota antiga'], [3, '']]);
  base.workspaces[0].notes = '';
  assert.deepEqual([...readSession(JSON.stringify(base), 'Nota antiga').notes], [[0, ''], [3, '']]);
});

test('restores valid saved projects, preserving tab selection, queries, pins and notes', () => {
  const projects = [
    { name: ' Revisão ', savedAt: 10, notes: 'Rascunho', tabs: ['https://example.org', ''], queries: ['ignorar', 'consulta'], activeIndex: 1, pinnedIndices: [0, 1] },
    { name: 'Inválido', savedAt: 10, tabs: ['javascript:alert(1)', 'https://tauri.localhost/'] },
    null,
  ];
  assert.deepEqual(readSession(JSON.stringify({ projects })).projects, [{
    name: 'Revisão', savedAt: 10, notes: 'Rascunho', tabs: ['https://example.org/', ''],
    queries: ['', 'consulta'], activeIndex: 1, pinnedIndices: [0],
  }]);
});
