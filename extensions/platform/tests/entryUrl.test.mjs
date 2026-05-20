import assert from 'node:assert/strict';
import test from 'node:test';
import { entryHasLaunchUrl, normalizeEntryUrl } from '../shared/domain/entryUrl.js';

test('normalizeEntryUrl adds https when scheme missing', () => {
  assert.equal(normalizeEntryUrl({ url: 'github.com' }), 'https://github.com');
});

test('normalizeEntryUrl preserves explicit https', () => {
  assert.equal(normalizeEntryUrl({ website: 'https://example.com/login' }), 'https://example.com/login');
});

test('entryHasLaunchUrl is false without url fields', () => {
  assert.equal(entryHasLaunchUrl({ title: 'Test' }), false);
});

test('normalizeEntryUrl uses displayUrl fallback', () => {
  assert.equal(normalizeEntryUrl({ displayUrl: 'notion.so' }), 'https://notion.so');
});
