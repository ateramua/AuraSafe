// src/lib/api-client.js

/** Electron preload API, or null if unavailable (never cache — preload timing varies). */
function getDesktopApi() {
  if (typeof window === 'undefined') return null;
  const api = window.api;
  return api && typeof api === 'object' ? api : null;
}

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
    updatedAt: Date.now(),
  },
  {
    id: '2',
    name: 'GitHub',
    username: 'dev@example.com',
    password: 'githubpass',
    url: 'https://github.com',
    notes: 'Work account',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ===== Vault CRUD =====
export async function addVaultEntry(entry) {
  const api = getDesktopApi();
  if (typeof api?.saveVaultEntry === 'function') {
    const newEntry = { ...entry, id: entry.id || Math.random().toString(36).substr(2, 9) };
    await api.saveVaultEntry(newEntry);
    return newEntry;
  }
  console.log('Adding entry (mock)', entry);
  const newEntry = { ...entry, id: Math.random().toString(36).substr(2, 9) };
  mockEntries.push(newEntry);
  return newEntry;
}

export async function updateVaultEntry(id, entry) {
  const api = getDesktopApi();
  if (typeof api?.saveVaultEntry === 'function') {
    await api.saveVaultEntry({ ...entry, id });
    return entry;
  }
  console.log('Updating entry (mock)', id, entry);
  const index = mockEntries.findIndex((e) => e.id === id);
  if (index !== -1) {
    mockEntries[index] = { ...mockEntries[index], ...entry };
    return mockEntries[index];
  }
  return entry;
}

export async function deleteVaultEntry(id) {
  const api = getDesktopApi();
  if (typeof api?.deleteVaultEntry === 'function') {
    await api.deleteVaultEntry(id);
    return true;
  }
  console.log('Deleting entry (mock)', id);
  mockEntries = mockEntries.filter((e) => e.id !== id);
  return true;
}

export async function saveVaultEntry(entry) {
  const api = getDesktopApi();
  if (typeof api?.saveVaultEntry === 'function') {
    return await api.saveVaultEntry(entry);
  }
  if (entry.id && mockEntries.some((e) => e.id === entry.id)) {
    return updateVaultEntry(entry.id, entry);
  }
  return addVaultEntry(entry);
}

export async function loadVault() {
  const api = getDesktopApi();
  if (typeof api?.getVaultEntries === 'function') {
    return await api.getVaultEntries();
  }
  console.log('Loading mock vault');
  return mockEntries;
}

// Alias for compatibility with store.js
export const getVaultEntries = loadVault;

// ===== Vault state =====
export async function isInitialized() {
  const api = getDesktopApi();
  if (typeof api?.isInitialized === 'function') {
    return await api.isInitialized();
  }
  return false;
}

export async function isUnlocked() {
  const api = getDesktopApi();
  if (typeof api?.isUnlocked === 'function') {
    return await api.isUnlocked();
  }
  return false;
}

export async function unlockVault(password) {
  const api = getDesktopApi();
  if (typeof api?.unlockVault === 'function') {
    return await api.unlockVault(password);
  }
  if (typeof window !== 'undefined') {
    throw new Error(DESKTOP_API_MSG);
  }
  return { success: true };
}

const DESKTOP_API_MSG =
  'Desktop API not available. Run npm run dev from the AuraSafe repo root and create your vault in the Electron window (not a browser tab at localhost:3000).';

export async function initVault(password) {
  const api = getDesktopApi();
  if (typeof api?.initVault === 'function') {
    return await api.initVault(password);
  }
  if (typeof window !== 'undefined') {
    throw new Error(DESKTOP_API_MSG);
  }
  return true;
}

export async function lockVault() {
  const api = getDesktopApi();
  if (typeof api?.lockVault === 'function') {
    return await api.lockVault();
  }
  console.log('Mock lock vault');
  return true;
}

// ===== Biometric =====
export async function isBiometricAvailable() {
  const api = getDesktopApi();
  if (api?.biometric && typeof api.biometric.isAvailable === 'function') {
    return await api.biometric.isAvailable();
  }
  return false;
}

export async function isBiometricEnabled() {
  const api = getDesktopApi();
  if (api?.biometric && typeof api.biometric.isEnabled === 'function') {
    return await api.biometric.isEnabled();
  }
  return false;
}

export async function enableBiometric() {
  const api = getDesktopApi();
  if (api?.biometric && typeof api.biometric.enable === 'function') {
    return await api.biometric.enable();
  }
  return false;
}

export async function disableBiometric() {
  const api = getDesktopApi();
  if (api?.biometric && typeof api.biometric.disable === 'function') {
    return await api.biometric.disable();
  }
  return false;
}

export async function unlockWithBiometric() {
  const api = getDesktopApi();
  if (api?.biometric && typeof api.biometric.unlock === 'function') {
    return await api.biometric.unlock();
  }
  return { success: false, error: 'Biometric not available' };
}

// ===== Sync =====
export async function syncPush() {
  const api = getDesktopApi();
  if (api?.sync && typeof api.sync.push === 'function') {
    return await api.sync.push();
  }
  return { success: false, error: 'Sync not available' };
}

export async function syncPull() {
  const api = getDesktopApi();
  if (api?.sync && typeof api.sync.pull === 'function') {
    return await api.sync.pull();
  }
  return { success: false, error: 'Sync not available' };
}

export async function getSyncCID() {
  const api = getDesktopApi();
  if (api?.sync && typeof api.sync.getCID === 'function') {
    return await api.sync.getCID();
  }
  return null;
}

// ===== Settings =====
export async function getAutoSync() {
  const api = getDesktopApi();
  if (api?.settings && typeof api.settings.getAutoSync === 'function') {
    return await api.settings.getAutoSync();
  }
  return false;
}

export async function setAutoSync(enabled) {
  const api = getDesktopApi();
  if (api?.settings && typeof api.settings.setAutoSync === 'function') {
    return await api.settings.setAutoSync(enabled);
  }
  return false;
}

/** True when the Electron preload exposed a full vault API. */
export function hasDesktopVaultApi() {
  const api = getDesktopApi();
  return (
    typeof api?.initVault === 'function' && typeof api?.unlockVault === 'function'
  );
}

/**
 * Vault bridge for renderer components: prefers Electron preload API,
 * falls back to in-memory mock when window.api is unavailable (e.g. browser-only dev).
 */
export function getVaultBridge() {
  const api = getDesktopApi();
  if (typeof api?.initVault === 'function' && typeof api?.unlockVault === 'function') {
    return api;
  }

  return {
    isInitialized,
    isUnlocked,
    initVault,
    unlockVault,
    lockVault,
    getVaultEntries: loadVault,
    saveVaultEntry,
    deleteVaultEntry,
    biometric: {
      isAvailable: isBiometricAvailable,
      isEnabled: isBiometricEnabled,
      enable: enableBiometric,
      disable: disableBiometric,
      unlock: unlockWithBiometric,
    },
    sync: {
      push: syncPush,
      pull: syncPull,
      getCID: getSyncCID,
    },
  };
}
