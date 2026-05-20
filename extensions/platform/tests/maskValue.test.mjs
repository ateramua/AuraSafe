import assert from 'node:assert/strict';
import test from 'node:test';
import { maskPassword, maskValue } from '../shared/domain/maskValue.js';

test('maskValue hides middle of long values', () => {
  assert.equal(maskValue('user@example.com'), 'us••••om');
});

test('maskValue uses bullets for short values', () => {
  assert.equal(maskValue('abcd'), '••••••');
  assert.equal(maskValue(''), '');
});

test('maskPassword is fixed bullets', () => {
  assert.equal(maskPassword(), '••••••••');
});
