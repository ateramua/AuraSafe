// src/lib/api-client.js

// Existing vault functions...
export async function getVaultEntries() {
    if (window.api && window.api.getVaultEntries) {
        return await window.api.getVaultEntries();
    }
    // Fallback mock for browser
    return [
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
}

export async function addVaultEntry(entry) {
    if (window.api && window.api.saveVaultEntry) {
        const newEntry = { ...entry, id: entry.id || Math.random().toString(36).substr(2, 9) };
        await window.api.saveVaultEntry(newEntry);
        return newEntry;
    }
    console.log('Adding entry (mock)', entry);
    return { ...entry, id: Math.random().toString(36).substr(2, 9) };
}

export async function updateVaultEntry(id, entry) {
    if (window.api && window.api.saveVaultEntry) {
        await window.api.saveVaultEntry({ ...entry, id });
        return entry;
    }
    console.log('Updating entry (mock)', id, entry);
    return entry;
}

export async function deleteVaultEntry(id) {
    if (window.api && window.api.deleteVaultEntry) {
        await window.api.deleteVaultEntry(id);
        return true;
    }
    console.log('Deleting entry (mock)', id);
    return true;
}

export async function isInitialized() {
    if (window.api && window.api.isInitialized) {
        return await window.api.isInitialized();
    }
    return false;
}

export async function isUnlocked() {
    if (window.api && window.api.isUnlocked) {
        return await window.api.isUnlocked();
    }
    return false;
}

export async function unlockWithBiometric() {
  if (window.api && window.api.biometric) {
    return await window.api.biometric.unlock();
  }
  return { success: false, error: 'Biometric not available' };
}

export async function unlockVault(password) {
    if (window.api && window.api.unlockVault) {
        return await window.api.unlockVault(password);
    }
    return { success: false };
}

export async function initVault(password) {
    if (window.api && window.api.initVault) {
        return await window.api.initVault(password);
    }
    console.log('Mock init vault');
    return true;
}

export async function lockVault() {
    if (window.api && window.api.lockVault) {
        return await window.api.lockVault();
    }
    console.log('Mock lock vault');
    return true;
}

export async function syncPush() {
  if (window.api && window.api.sync) {
    return await window.api.sync.push();
  }
  return { success: false, error: 'Sync not available' };
}

export async function syncPull() {
  if (window.api && window.api.sync) {
    return await window.api.sync.pull();
  }
  return { success: false, error: 'Sync not available' };
}

export async function getSyncCID() {
  if (window.api && window.api.sync) {
    return await window.api.sync.getCID();
  }
  return null;
}

// --- Biometric functions ---
export async function isBiometricAvailable() {
  if (window.api && window.api.biometric) {
    return await window.api.biometric.isAvailable();
  }
  return false;
}

export async function isBiometricEnabled() {
  if (window.api && window.api.biometric) {
    return await window.api.biometric.isEnabled();
  }
  return false;
}

export async function enableBiometric() {
  if (window.api && window.api.biometric) {
    return await window.api.biometric.enable();
  }
  return false;
}

export async function disableBiometric() {
  if (window.api && window.api.biometric) {
    return await window.api.biometric.disable();
  }
  return false;
}

// --- Auto-sync functions ---
export async function getAutoSync() {
  if (window.api && window.api.settings) {
    return await window.api.settings.getAutoSync();
  }
  return false;
}

export async function setAutoSync(enabled) {
  if (window.api && window.api.settings) {
    return await window.api.settings.setAutoSync(enabled);
  }
  return false;
}