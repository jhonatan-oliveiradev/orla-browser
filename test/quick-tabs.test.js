import assert from 'node:assert/strict';
import test from 'node:test';
import { findTabs } from '../ui/quick-tabs.js';

test('matches multiple terms across title, workspace and address, ignoring accents', () => {
  const entries = [
    { title: 'Estúdio' }, { title: 'Pedidos', url: 'https://app.example/painel', workspace: 'Estúdio' },
    { title: 'Pedidos', url: 'https://other.example', workspace: 'Principal' },
  ];
  assert.deepEqual(findTabs('estudio painel', entries), [entries[1]]);
  assert.deepEqual(findTabs('estúdio', entries), entries.slice(0, 2));
  assert.deepEqual(findTabs('outro título', entries), []);
});
