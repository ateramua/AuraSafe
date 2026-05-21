import assert from 'node:assert/strict';
import test from 'node:test';
import { decrypt, deriveKey, encrypt, fromBase64, generateSalt, toBase64 } from './crypto.js';

test('encrypt/decrypt roundtrip', async () => {
  const salt = generateSalt();
  const key = await deriveKey('test-password-123', salt);
  const blob = encrypt('{"entries":[]}', key);
  const plain = decrypt(blob, key);
  assert.equal(plain, '{"entries":[]}');
});

test('base64 roundtrip', () => {
  const bytes = generateSalt();
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});
