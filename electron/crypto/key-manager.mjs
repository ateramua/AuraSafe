import crypto from 'crypto';
import Store from 'electron-store';
import { deriveKey, encrypt, decrypt, generateSalt } from './encryption-engine.mjs';

const store = new Store({ name: 'vault' });
const settingsStore = new Store({ name: 'settings' });
const metadataStore = new Store({ name: 'vault-metadata' });

let masterKey = null;
let vaultKey = null;

export async function initVault(masterPassword) {
  const salt = generateSalt();
  const derivedMasterKey = await deriveKey(masterPassword, salt);
  const vaultKeyRaw = crypto.randomBytes(32);
  const { iv, authTag, ciphertext } = encrypt(vaultKeyRaw.toString('hex'), derivedMasterKey);
  store.set('masterSalt', salt.toString('base64'));
  store.set('encryptedVaultKey', {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
  masterKey = derivedMasterKey;
  vaultKey = vaultKeyRaw;
  const data = { entries: [], _meta: { lastModified: Date.now(), version: '1.0' } };
  const { iv: dataIv, authTag: dataTag, ciphertext: dataCipher } = encrypt(JSON.stringify(data), vaultKey);
  store.set('vaultData', {
    iv: dataIv.toString('base64'),
    authTag: dataTag.toString('base64'),
    ciphertext: dataCipher.toString('base64'),
  });
  metadataStore.set('metadata', data._meta);
  
  // Return success object
  return { success: true };
}

export async function unlockVault(masterPassword) {
  const saltBase64 = store.get('masterSalt');
  if (!saltBase64) {
    console.error('[KeyManager] No master salt found');
    return { success: false, error: 'Vault not initialized' };
  }
  
  const salt = Buffer.from(saltBase64, 'base64');
  const derivedMasterKey = await deriveKey(masterPassword, salt);
  const encryptedVaultKeyObj = store.get('encryptedVaultKey');
  
  if (!encryptedVaultKeyObj) {
    console.error('[KeyManager] No encrypted vault key found');
    return { success: false, error: 'Vault not properly initialized' };
  }
  
  try {
    const iv = Buffer.from(encryptedVaultKeyObj.iv, 'base64');
    const authTag = Buffer.from(encryptedVaultKeyObj.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedVaultKeyObj.ciphertext, 'base64');
    const vaultKeyHex = decrypt(ciphertext, derivedMasterKey, iv, authTag);
    vaultKey = Buffer.from(vaultKeyHex, 'hex');
    masterKey = derivedMasterKey;
    
    // Load entries after successful unlock
    const entries = loadVaultEntries();
    
    console.log('[KeyManager] Vault unlocked successfully');
    return { 
      success: true, 
      entries: entries,
      key: vaultKeyHex
    };
  } catch (err) {
    console.error('[KeyManager] Unlock failed:', err);
    return { success: false, error: 'Invalid password' };
  }
}

export function lockVault() {
  masterKey = null;
  vaultKey = null;
  return { success: true };
}

export function isUnlocked() {
  return vaultKey !== null;
}

export function getVaultKey() {
  return vaultKey;
}

export function getVaultMetadata() {
  return metadataStore.get('metadata', { lastModified: 0 });
}

export function setVaultMetadata(metadata) {
  metadataStore.set('metadata', metadata);
}

export function isAutoSyncEnabled() {
  return settingsStore.get('autoSync', false);
}

export function setAutoSyncEnabled(enabled) {
  settingsStore.set('autoSync', enabled);
}

export function importVaultData(data) {
  if (!vaultKey) throw new Error('Vault is locked');
  const json = JSON.stringify(data);
  const { iv, authTag, ciphertext } = encrypt(json, vaultKey);
  store.set('vaultData', {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
  setVaultMetadata(data._meta);
  return { success: true };
}

export function saveVaultEntries(entries) {
  if (!vaultKey) throw new Error('Vault is locked');
  const data = {
    entries,
    _meta: { lastModified: Date.now(), version: '1.0' },
  };
  const json = JSON.stringify(data);
  const { iv, authTag, ciphertext } = encrypt(json, vaultKey);
  store.set('vaultData', {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
  setVaultMetadata(data._meta);
  return { success: true };
}

export function loadVaultEntries() {
  if (!vaultKey) throw new Error('Vault is locked');
  const encryptedData = store.get('vaultData');
  if (!encryptedData) return [];
  
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  const json = decrypt(ciphertext, vaultKey, iv, authTag);
  const data = JSON.parse(json);
  return data.entries || [];
}

export async function enableBiometricUnlock() {
  if (!vaultKey) throw new Error('Vault must be unlocked to enable biometrics');
  return { success: true };
}

export async function unlockWithBiometric() {
  return { success: false, error: 'Biometric unlock not configured' };
}

export async function disableBiometricUnlock() {
  return { success: true };
}

export async function isBiometricUnlockAvailable() {
  return false;
}

// Add reset function for debugging
export async function resetVault() {
  try {
    store.clear();
    settingsStore.clear();
    metadataStore.clear();
    masterKey = null;
    vaultKey = null;
    console.log('[KeyManager] Vault reset successfully');
    return { success: true };
  } catch (error) {
    console.error('[KeyManager] Reset failed:', error);
    return { success: false, error: error.message };
  }
}