import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import type { EncryptedBlob } from '@aurasafe/types';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const IV_LEN = 12;

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function generateSalt(): Uint8Array {
  return randomBytes(32);
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  return scryptAsync(passwordBytes, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: KEY_LEN });
}

export function encrypt(plaintext: string, key: Uint8Array): EncryptedBlob {
  const iv = randomBytes(IV_LEN);
  const data = new TextEncoder().encode(plaintext);
  const aes = gcm(key, iv);
  const sealed = aes.encrypt(data);
  const ciphertext = sealed.slice(0, -16);
  const authTag = sealed.slice(-16);
  return {
    iv: toBase64(iv),
    authTag: toBase64(authTag),
    ciphertext: toBase64(ciphertext),
  };
}

export function decrypt(blob: EncryptedBlob, key: Uint8Array): string {
  const iv = fromBase64(blob.iv);
  const authTag = fromBase64(blob.authTag);
  const ciphertext = fromBase64(blob.ciphertext);
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  const aes = gcm(key, iv);
  const plain = aes.decrypt(combined);
  return new TextDecoder().decode(plain);
}

export function generateVaultKey(): Uint8Array {
  return randomBytes(KEY_LEN);
}

export function vaultKeyToHex(key: Uint8Array): string {
  return Array.from(key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function vaultKeyFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
