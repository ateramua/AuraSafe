import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gcm } from '@noble/ciphers/aes';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { parseBackupFileContent } from './parse-backup.js';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('parseBackupFileContent', () => {
  it('parses plain entry list', () => {
    const content = JSON.stringify([{ id: '1', title: 'Test', username: 'u', password: 'p' }]);
    const result = parseBackupFileContent(content);
    assert.equal(result.needsPassword, undefined);
    assert.equal(result.vaultData?.entries.length, 1);
  });

  it('parses backup-manager encrypted container', () => {
    const password = 'backup-secret';
    const payload = { entries: [{ id: '2', title: 'Enc', username: 'a', password: 'b' }] };
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const key = pbkdf2(sha256, new TextEncoder().encode(password), salt, { c: 100_000, dkLen: 32 });
    const plain = new TextEncoder().encode(JSON.stringify(payload));
    const sealed = gcm(key, iv).encrypt(plain);
    const authTag = sealed.slice(-16);
    const ciphertext = sealed.slice(0, -16);

    const inner = {
      salt: toBase64(salt),
      iv: toBase64(iv),
      authTag: toBase64(authTag),
      data: toBase64(ciphertext),
    };
    const file = JSON.stringify({ version: '1.0', timestamp: Date.now(), data: inner });

    assert.deepEqual(parseBackupFileContent(file), { needsPassword: true });
    const decrypted = parseBackupFileContent(file, { password });
    assert.equal(decrypted.vaultData?.entries.length, 1);
  });
});
