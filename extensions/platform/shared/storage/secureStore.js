import { storageGet, storageRemove, storageSet } from '../browser/runtime.js';

const PREFIX = 'aurasafe.secure.';
const KEY_STORAGE_KEY = `${PREFIX}encryptionKey.v1`;
const ENVELOPE_VERSION = 1;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function isEncryptedEnvelope(value) {
  return value?.version === ENVELOPE_VERSION && value?.algorithm === 'AES-GCM' && value?.iv && value?.ciphertext;
}

async function getEncryptionKey() {
  const existing = (await storageGet(KEY_STORAGE_KEY))[KEY_STORAGE_KEY];
  if (existing) {
    return crypto.subtle.importKey(
      'raw',
      base64ToBytes(existing),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  await storageSet({ [KEY_STORAGE_KEY]: bytesToBase64(rawKey) });
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptValue(value) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    version: ENVELOPE_VERSION,
    algorithm: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    updatedAt: Date.now(),
  };
}

async function decryptValue(envelope) {
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export async function secureGet(key) {
  const value = await storageGet(`${PREFIX}${key}`);
  const stored = value[`${PREFIX}${key}`] ?? null;
  if (!isEncryptedEnvelope(stored)) {
    return stored;
  }
  return decryptValue(stored);
}

export async function secureSet(key, value) {
  await storageSet({ [`${PREFIX}${key}`]: await encryptValue(value) });
}

export async function secureRemove(key) {
  await storageRemove(`${PREFIX}${key}`);
}

export async function clearSecureKeys(keys) {
  await storageRemove(keys.map((key) => `${PREFIX}${key}`));
}

export async function resetSecureStore() {
  await storageRemove(KEY_STORAGE_KEY);
}
