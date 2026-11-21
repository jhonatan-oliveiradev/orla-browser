import assert from 'node:assert/strict';
import test from 'node:test';
import { reorderTabs } from '../ui/tab-order.js';

function entries() {
  return [10, 11, 12, 13, 14].map((id) => [id, { pinned: id < 12 }]);
}

test('reorders tabs in both directions without mutating the current order', () => {
  const tabs = entries();
  assert.deepEqual(reorderTabs(tabs, 12, 14, true).map(([id]) => id), [10, 11, 13, 14, 12]);
  assert.deepEqual(reorderTabs(tabs, 14, 12).map(([id]) => id), [10, 11, 14, 12, 13]);
  assert.deepEqual(reorderTabs(tabs, 10, 11, true).map(([id]) => id), [11, 10, 12, 13, 14]);
  assert.deepEqual(tabs.map(([id]) => id), [10, 11, 12, 13, 14]);
});

test('keeps pinned tabs separate and ignores missing or unchanged positions', () => {
  const tabs = entries();
  assert.equal(reorderTabs(tabs, 12, 11, true), null);
  assert.equal(reorderTabs(tabs, 13, 12, true), null);
  assert.equal(reorderTabs(tabs, 12, 13), null);
  assert.equal(reorderTabs(tabs, 11, 11), null);
  assert.equal(reorderTabs(tabs, 99, 12), null);
});
