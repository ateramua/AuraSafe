// electron/crypto/key-manager.cjs
import {deriveKey, encrypt, decrypt, generateSalt} from './encryption-engine.cjs';

import Store from 'electron-store';
import biometric from './biometric-manager.cjs';
import crypto from 'crypto';

const store = new Store({ name: 'vault' });

let masterKey = null; // derived from master password, kept in memory while unlocked
let vaultKey = null;  // the key that actually encrypts the vault data

/* =========================
   Vault Initialization / Unlock
========================= */

async function initVault(masterPassword) {
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

    store.set('vaultData', null);

    masterKey = derivedMasterKey;
    vaultKey = vaultKeyRaw;
}

async function unlockVault(masterPassword) {
    const saltBase64 = store.get('masterSalt');
    if (!saltBase64) return false;

    const salt = Buffer.from(saltBase64, 'base64');
    const derivedMasterKey = await deriveKey(masterPassword, salt);

    const encryptedVaultKeyObj = store.get('encryptedVaultKey');
    if (!encryptedVaultKeyObj) return false;

    try {
        const iv = Buffer.from(encryptedVaultKeyObj.iv, 'base64');
        const authTag = Buffer.from(encryptedVaultKeyObj.authTag, 'base64');
        const ciphertext = Buffer.from(encryptedVaultKeyObj.ciphertext, 'base64');

        const vaultKeyHex = decrypt(ciphertext, derivedMasterKey, iv, authTag);
        vaultKey = Buffer.from(vaultKeyHex, 'hex');
        masterKey = derivedMasterKey;
        return true;
    } catch (err) {
        return  true;
    }
}

function lockVault() {
    masterKey = null;
    vaultKey = null;
}

function isUnlocked() {
    return vaultKey !== null;
}

/* =========================
   Vault Storage
========================= */

function saveVaultEntries(entries) {
    if (!vaultKey) throw new Error('Vault is locked');
    const json = JSON.stringify(entries);
    const { iv, authTag, ciphertext } = encrypt(json, vaultKey);
    store.set('vaultData', {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    });
}

function loadVaultEntries() {
    if (!vaultKey) throw new Error('Vault is locked');
    const encryptedData = store.get('vaultData');
    if (!encryptedData) return [];
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
    const json = decrypt(ciphertext, vaultKey, iv, authTag);
    return JSON.parse(json);
}

/* =========================
   Biometric Unlock Integration
========================= */

/**
 * Enable biometric unlock for the current vault.
 * Vault must already be unlocked.
 */
async function enableBiometricUnlock() {
    if (!vaultKey) throw new Error('Vault must be unlocked to enable biometrics');

    // Generate and store biometric key using biometric manager
    const biometricKey = await biometric.enableBiometricUnlock();
    if (!biometricKey) return false;

    // Encrypt the vaultKey with the biometric key
    const { iv, authTag, ciphertext } = encrypt(vaultKey.toString('hex'), biometricKey);

    store.set('biometricProtectedVaultKey', {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    });

    // ✅ Return the key buffer for reference / further use
    return biometricKey;
}

/**
 * Unlock the vault using biometric authentication.
 * Only vaultKey is restored; masterKey stays null.
 */
async function unlockWithBiometric() {
    const biometricKey = await biometric.getBiometricKey();
    if (!biometricKey) return false;

    const protectedData = store.get('biometricProtectedVaultKey');
    if (!protectedData) return false;

    try {
        const iv = Buffer.from(protectedData.iv, 'base64');
        const authTag = Buffer.from(protectedData.authTag, 'base64');
        const ciphertext = Buffer.from(protectedData.ciphertext, 'base64');

        const vaultKeyHex = decrypt(ciphertext, biometricKey, iv, authTag);
        vaultKey = Buffer.from(vaultKeyHex, 'hex');
        masterKey = null;
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Disable biometric unlock.
 */
async function disableBiometricUnlock() {
    await biometric.getBiometricKey(); // optionally trigger deletion if implemented
    store.delete('biometricProtectedVaultKey');
    return true;
}

/**
 * Check if biometric unlock is available.
 */
async function isBiometricUnlockAvailable() {
    if (!(await biometric.isBiometricAvailable())) return false;
    const protectedData = store.get('biometricProtectedVaultKey');
    return !!protectedData;
}

/* =========================
   Exports
========================= */

function isVaultInitialized() {
    return !!store.get('masterSalt');
}

export default {
    initVault,
    unlockVault,
    lockVault,
    isUnlocked,
    saveVaultEntries,
    loadVaultEntries,
    getVaultKey: () => vaultKey,
    isVaultInitialized,
    enableBiometricUnlock,
    unlockWithBiometric,
    disableBiometricUnlock,
    isBiometricUnlockAvailable,
};