import crypto from 'crypto';
import keytar from 'keytar';

const SERVICE = 'com.spiritual.passwordmanager.biometric';
const ACCOUNT = 'master-key';

export async function isBiometricAvailable() {
  return process.platform === 'darwin';
}

export async function enableBiometricUnlock() {
  const key = crypto.randomBytes(32);
  const keyHex = key.toString('hex');
  await keytar.setPassword(SERVICE, ACCOUNT, keyHex);
  return key;
}

export async function unlockWithBiometric() {
  const keyHex = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

export async function disableBiometricUnlock() {
  await keytar.deletePassword(SERVICE, ACCOUNT);
  return true;
}

export async function isBiometricEnabled() {
  const key = await keytar.getPassword(SERVICE, ACCOUNT);
  return !!key;
}