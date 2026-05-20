import crypto from 'crypto';
import { VaultEncryption, validateEncryptedFile } from '../crypto/vault-encryption.mjs';

/**
 * Decrypt backup-manager style inner payload (salt/iv/authTag as base64).
 */
function decryptBackupManagerPackage(encryptedPackage, password) {
  const salt = Buffer.from(encryptedPackage.salt, 'base64');
  const iv = Buffer.from(encryptedPackage.iv, 'base64');
  const authTag = Buffer.from(encryptedPackage.authTag, 'base64');
  const encryptedData = Buffer.from(encryptedPackage.data, 'base64');

  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function isBackupManagerEncrypted(data) {
  return (
    data &&
    typeof data === 'object' &&
    data.salt &&
    data.iv &&
    data.authTag &&
    data.data &&
    !Array.isArray(data.entries)
  );
}

function isVaultExportEncrypted(parsed) {
  try {
    validateEncryptedFile(parsed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize backup payload to { entries: [...] } for pre-vault restore.
 */
export function normalizeVaultData(data) {
  if (Array.isArray(data)) {
    return { entries: data };
  }
  if (data && Array.isArray(data.entries)) {
    return { entries: data.entries };
  }
  throw new Error('No password entries found in backup file');
}

/**
 * Parse .aura / JSON backup content. Supports plain and encrypted exports.
 * @returns {{ vaultData?: object, needsPassword?: boolean }}
 */
export function parseBackupFileContent(fileContent, { password } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid backup file: not valid JSON');
  }

  // Whole-file VaultEncryption export (Settings → Vault Backup Manager)
  if (isVaultExportEncrypted(parsed)) {
    if (!password) {
      return { needsPassword: true };
    }
    const data = VaultEncryption.decrypt(parsed, password);
    return { vaultData: normalizeVaultData(data) };
  }

  // Standard container: { version, data, checksum?, timestamp? }
  if (parsed.version === '1.0' && parsed.data !== undefined) {
    let inner = parsed.data;

    if (isBackupManagerEncrypted(inner)) {
      if (!password) {
        return { needsPassword: true };
      }
      inner = decryptBackupManagerPackage(inner, password);
    }

    return { vaultData: normalizeVaultData(inner) };
  }

  // Raw vault object or entry list
  return { vaultData: normalizeVaultData(parsed) };
}
