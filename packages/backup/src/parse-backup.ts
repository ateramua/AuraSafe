import { gcm } from '@noble/ciphers/aes';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import type { VaultEntry, VaultPayload } from '@aurasafe/types';

const VAULT_EXPORT_AAD = new TextEncoder().encode('AuraSafe Vault Export');
const PBKDF2_ITERATIONS = 100_000;

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function fromHex(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'hex'));
  }
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(password), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

function decryptAesGcm(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  authTag: Uint8Array,
  aad?: Uint8Array,
): string {
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  const aes = aad ? gcm(key, iv, aad) : gcm(key, iv);
  const plain = aes.decrypt(combined);
  return new TextDecoder().decode(plain);
}

export function normalizeVaultData(data: unknown): VaultPayload {
  if (Array.isArray(data)) {
    return { entries: data as VaultEntry[], _meta: { lastModified: Date.now(), version: '1.0' } };
  }
  if (data && typeof data === 'object' && Array.isArray((data as VaultPayload).entries)) {
    const payload = data as VaultPayload;
    return {
      entries: payload.entries,
      _meta: payload._meta || { lastModified: Date.now(), version: '1.0' },
    };
  }
  throw new Error('No password entries found in backup file');
}

function isBackupManagerEncrypted(data: Record<string, unknown>): boolean {
  return Boolean(
    data.salt &&
      data.iv &&
      data.authTag &&
      data.data &&
      !Array.isArray(data.entries),
  );
}

export function isVaultExportEncrypted(parsed: Record<string, unknown>): boolean {
  const required = ['salt', 'iv', 'tag', 'data', 'version'];
  for (const field of required) {
    if (!parsed[field]) return false;
  }
  if (parsed.version !== '1.0') return false;
  const hexFields = ['salt', 'iv', 'tag', 'data'];
  return hexFields.every((f) => typeof parsed[f] === 'string' && /^[0-9a-f]+$/i.test(parsed[f] as string));
}

function requiredField(pkg: Record<string, string>, key: string): string {
  const value = pkg[key];
  if (!value) throw new Error(`Backup package missing ${key}`);
  return value;
}

function decryptBackupManagerPackage(
  encryptedPackage: Record<string, string>,
  password: string,
): unknown {
  const salt = fromBase64(requiredField(encryptedPackage, 'salt'));
  const iv = fromBase64(requiredField(encryptedPackage, 'iv'));
  const authTag = fromBase64(requiredField(encryptedPackage, 'authTag'));
  const encryptedData = fromBase64(requiredField(encryptedPackage, 'data'));
  const key = deriveKey(password, salt);
  const json = decryptAesGcm(key, iv, encryptedData, authTag);
  return JSON.parse(json);
}

function decryptVaultExport(parsed: Record<string, string>, password: string): unknown {
  const salt = fromHex(requiredField(parsed, 'salt'));
  const iv = fromHex(requiredField(parsed, 'iv'));
  const tag = fromHex(requiredField(parsed, 'tag'));
  const data = fromHex(requiredField(parsed, 'data'));
  const key = deriveKey(password, salt);
  const json = decryptAesGcm(key, iv, data, tag, VAULT_EXPORT_AAD);
  return JSON.parse(json);
}

export type ParseBackupResult =
  | { vaultData: VaultPayload; needsPassword?: false }
  | { needsPassword: true; vaultData?: undefined };

/**
 * Parse .aura / JSON backup (plain or encrypted). Matches desktop parse-backup-file.mjs.
 */
export function parseBackupFileContent(
  fileContent: string,
  options: { password?: string } = {},
): ParseBackupResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fileContent) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid backup file: not valid JSON');
  }

  if (isVaultExportEncrypted(parsed)) {
    if (!options.password) {
      return { needsPassword: true };
    }
    const data = decryptVaultExport(parsed as Record<string, string>, options.password);
    return { vaultData: normalizeVaultData(data) };
  }

  if (parsed.version === '1.0' && parsed.data !== undefined) {
    let inner: unknown = parsed.data;
    if (inner && typeof inner === 'object' && isBackupManagerEncrypted(inner as Record<string, unknown>)) {
      if (!options.password) {
        return { needsPassword: true };
      }
      inner = decryptBackupManagerPackage(inner as Record<string, string>, options.password);
    }
    return { vaultData: normalizeVaultData(inner) };
  }

  return { vaultData: normalizeVaultData(parsed) };
}
