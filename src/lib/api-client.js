// src/lib/api-client.js

// Helper: check if we're in Electron
const isElectron = typeof window !== 'undefined' && window.api;

// Mock data for development (when not in Electron)
let mockEntries = [
  {
    id: '1',
    name: 'Google',
    username: 'user@gmail.com',
    password: 'mock123',
    url: 'https://google.com',
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: '2',
    name: 'GitHub',
    username: 'dev@example.com',
    password: 'githubpass',
    url: 'https://github.com',
    notes: 'Work account',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

// ===== Vault CRUD =====
export async function addVaultEntry(entry) {
  if (isElectron && window.api.saveVaultEntry) {
    const newEntry = { ...entry, id: entry.id || Math.random().toString(36).substr(2, 9) };
    await window.api.saveVaultEntry(newEntry);
    return newEntry;
  }
  console.log('Adding entry (mock)', entry);
  const newEntry = { ...entry, id: Math.random().toString(36).substr(2, 9) };
  mockEntries.push(newEntry);
  return newEntry;
}

export async function updateVaultEntry(id, entry) {
  if (isElectron && window.api.saveVaultEntry) {
    await window.api.saveVaultEntry({ ...entry, id });
    return entry;
  }
  console.log('Updating entry (mock)', id, entry);
  const index = mockEntries.findIndex(e => e.id === id);
  if (index !== -1) {
    mockEntries[index] = { ...mockEntries[index], ...entry };
    return mockEntries[index];
  }
  return entry;
}

export async function deleteVaultEntry(id) {
  if (isElectron && window.api.deleteVaultEntry) {
    await window.api.deleteVaultEntry(id);
    return true;
  }
  console.log('Deleting entry (mock)', id);
  mockEntries = mockEntries.filter(e => e.id !== id);
  return true;
}

export async function loadVault() {
  if (isElectron && window.api.getVaultEntries) {
    return await window.api.getVaultEntries();
  }
  console.log('Loading mock vault');
  return mockEntries;
}

// Alias for compatibility with store.js
export const getVaultEntries = loadVault;

// ===== Vault state =====
export async function isInitialized() {
  if (isElectron && window.api.isInitialized) {
    return await window.api.isInitialized();
  }
  return false;
}

export async function isUnlocked() {
  if (isElectron && window.api.isUnlocked) {
    return await window.api.isUnlocked();
  }
  return false;
}

export async function unlockVault(password) {
  if (isElectron && window.api.unlockVault) {
    return await window.api.unlockVault(password);
  }
  console.log('Mock unlock vault');
  return { success: true };
}

export async function initVault(password) {
  if (isElectron && window.api.initVault) {
    return await window.api.initVault(password);
  }
  console.log('Mock init vault');
  return true;
}

export async function lockVault() {
  if (isElectron && window.api.lockVault) {
    return await window.api.lockVault();
  }
  console.log('Mock lock vault');
  return true;
}

// ===== Biometric =====
export async function isBiometricAvailable() {
  if (isElectron && window.api.biometric) {
    return await window.api.biometric.isAvailable();
  }
  return false;
}

export async function isBiometricEnabled() {
  if (isElectron && window.api.biometric) {
    return await window.api.biometric.isEnabled();
  }
  return false;
}

export async function enableBiometric() {
  if (isElectron && window.api.biometric) {
    return await window.api.biometric.enable();
  }
  return false;
}

export async function disableBiometric() {
  if (isElectron && window.api.biometric) {
    return await window.api.biometric.disable();
  }
  return false;
}

export async function unlockWithBiometric() {
  if (isElectron && window.api.biometric) {
    return await window.api.biometric.unlock();
  }
  return { success: false, error: 'Biometric not available' };
}

// ===== Sync =====
export async function syncPush() {
  if (isElectron && window.api.sync) {
    return await window.api.sync.push();
  }
  return { success: false, error: 'Sync not available' };
}

export async function syncPull() {
  if (isElectron && window.api.sync) {
    return await window.api.sync.pull();
  }
  return { success: false, error: 'Sync not available' };
}

export async function getSyncCID() {
  if (isElectron && window.api.sync) {
    return await window.api.sync.getCID();
  }
  return null;
}

// ===== Settings =====
export async function getAutoSync() {
  if (isElectron && window.api.settings) {
    return await window.api.settings.getAutoSync();
  }
  return false;
}

export async function setAutoSync(enabled) {
  if (isElectron && window.api.settings) {
    return await window.api.settings.setAutoSync(enabled);
  }
  return false;
}