import assert from 'node:assert/strict';
import test from 'node:test';
import { readSession, websiteAddress } from '../ui/session.js';

test('starts with one blank tab and the original favorites when storage is unavailable', () => {
  for (const value of [null, '{', '{}', '{"tabs":[]}']) {
    const session = readSession(value);
    assert.deepEqual(session.tabs, ['']);
    assert.equal(session.activeIndex, 0);
    assert.deepEqual(Array.from(session.favorites.values()), ['GitHub', 'MDN Web Docs', 'Figma']);
  }
});

test('restores the order and selected tab, including an empty tab and an empty favorites list', () => {
  const session = readSession(JSON.stringify({
    tabs: ['https://example.org/work', '', 'http://localhost:3000/'],
    activeIndex: 2,
    favorites: [],
  }));
  assert.deepEqual(session.tabs, ['https://example.org/work', '', 'http://localhost:3000/']);
  assert.equal(session.activeIndex, 2);
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
  assert.deepEqual(session.tabs, ['', 'https://example.org/']);
  assert.equal(session.activeIndex, 0);
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
  assert.equal(readSession(JSON.stringify({ tabs })).pinnedIndices.size, 0);
  const session = readSession(JSON.stringify({
    tabs, activeIndex: 2, pinnedIndices: [2, 0, 2, 1, -1, 3, '0', null],
  }));
  assert.deepEqual([...session.pinnedIndices], [2, 0]);
  assert.deepEqual(session.tabs, tabs);
  assert.equal(session.activeIndex, 2);
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
