import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAddress } from '../ui/address.js';

test('opens explicit websites and infers HTTPS for domains', () => {
  assert.equal(resolveAddress(' https://example.org/a '), 'https://example.org/a');
  assert.equal(resolveAddress('example.org:8443/a'), 'https://example.org:8443/a');
  assert.equal(resolveAddress('localhost:3000'), 'https://localhost:3000/');
});

test('encodes the entire search term', () => {
  const result = new URL(resolveAddress('isolamento de sites & abas'));
  assert.equal(result.hostname, 'duckduckgo.com');
  assert.equal(result.searchParams.get('q'), 'isolamento de sites & abas');
  assert.equal(result.searchParams.size, 1);
});

test('rejects unsafe schemes, explicit credentials and empty input', () => {
  for (const value of ['javascript:alert(1)', 'file:///C:/', 'https://x:y@example.org', '   ']) {
    assert.throws(() => resolveAddress(value));
  }
});
