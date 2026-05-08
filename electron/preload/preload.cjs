// ===================== PRELOAD SCRIPT =====================
const { contextBridge, ipcRenderer, shell } = require('electron');

// ===================== VAULT STATUS LISTENER (SINGLETON FOR APP LIFETIME) =====================
// IMPORTANT: This listener is registered ONCE and lives for the entire app lifetime
// DO NOT remove or re-register this listener
let vaultListenerRegistered = false;
let callbacks = new Set();

function onVaultStatusChange(cb) {
  if (!ipcRenderer) return;

  // Add callback to the set
  if (cb && typeof cb === 'function') {
    callbacks.add(cb);
    console.log('[Preload] Vault status callback registered. Total callbacks:', callbacks.size);
  }

  // Register the main IPC listener only ONCE for the entire app lifetime
  if (vaultListenerRegistered) return;

  vaultListenerRegistered = true;

  console.log('[Preload] Registering unified vault status listener (global) - SINGLETON');

  ipcRenderer.on('vault-status-change', (_, data) => {
    console.log('[Preload] Received vault-status-change:', data);

    // Dispatch custom event for DOM listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault-status', { detail: data }));
    }

    // Call all registered callbacks
    for (const fn of callbacks) {
      try {
        fn(data);
      } catch (e) {
        console.error('[Preload] Error in vault status callback:', e);
      }
    }
  });
}

// Initialize the global listener (registers IPC listener ONCE)
onVaultStatusChange();

// Note: removeVaultStatusListener is intentionally NOT exposed to prevent
// the React component lifecycle from breaking the singleton pattern.
// DO NOT add a remove method here.

// Helper function to set pending autofill via HTTP
const setPendingAutofill = async (payload) => {
  try {
    const response = await fetch('http://localhost:47392/set-autofill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('[Preload] setPendingAutofill error:', error);
    return { success: false, error: error.message };
  }
};

// Create the API object that matches what api-client.js expects
const api = {
  // ===================== VAULT CRUD =====================
  saveVaultEntry: async (entry) => {
    try {
      return await ipcRenderer.invoke('vault:saveEntry', entry);
    } catch (error) {
      console.error('[API] saveVaultEntry error:', error);
      throw error;
    }
  },

  deleteVaultEntry: async (id) => {
    try {
      return await ipcRenderer.invoke('vault:deleteEntry', id);
    } catch (error) {
      console.error('[API] deleteVaultEntry error:', error);
      throw error;
    }
  },

  getVaultEntries: async () => {
    try {
      return await ipcRenderer.invoke('vault:getEntries');
    } catch (error) {
      console.error('[API] getVaultEntries error:', error);
      throw error;
    }
  },

  // ===================== EXTERNAL BROWSER =====================
  openExternal: async (url) => {
    try {
      console.log('[API] openExternal called with URL:', url);
      const result = await ipcRenderer.invoke('open-external', url);
      return result;
    } catch (error) {
      console.error('[API] openExternal error:', error);
      return { success: false, error: error.message };
    }
  },

  // ===================== AUTOFILL =====================
  setPendingAutofill: async (payload) => {
    return await setPendingAutofill(payload);
  },

  // ===================== VAULT STATE =====================
  isInitialized: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:isInitialized');
      return result.initialized;
    } catch (error) {
      console.error('[API] isInitialized error:', error);
      return false;
    }
  },

  // Primary unlock method - uses the unified handler
  unlockVault: async (password) => {
    try {
      console.log('[API] unlockVault called');
      return await ipcRenderer.invoke('unlock-vault', password);
    } catch (error) {
      console.error('[API] unlockVault error:', error);
      throw error;
    }
  },

  // Primary isUnlocked check - uses the unified handler
  isUnlocked: async () => {
    try {
      console.log('[API] isUnlocked called');
      return await ipcRenderer.invoke('is-unlocked');
    } catch (error) {
      console.error('[API] isUnlocked error:', error);
      return false;
    }
  },

  // Primary lock method - uses the unified handler
  lockVault: async () => {
    try {
      console.log('[API] lockVault called');
      return await ipcRenderer.invoke('lock-vault');
    } catch (error) {
      console.error('[API] lockVault error:', error);
      return false;
    }
  },

  // Legacy unlock method (kept for backward compatibility)
  unlockVaultLegacy: async (password) => {
    try {
      return await ipcRenderer.invoke('vault:unlock', password);
    } catch (error) {
      console.error('[API] unlockVaultLegacy error:', error);
      throw error;
    }
  },

  // Legacy lock method
  lockVaultLegacy: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:lock');
      return result.success;
    } catch (error) {
      console.error('[API] lockVaultLegacy error:', error);
      throw error;
    }
  },

  // Legacy isUnlocked method
  isUnlockedLegacy: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:isUnlocked');
      return result.unlocked;
    } catch (error) {
      console.error('[API] isUnlockedLegacy error:', error);
      return false;
    }
  },

  initVault: async (password) => {
    try {
      const result = await ipcRenderer.invoke('vault:init', password);
      return result.success;
    } catch (error) {
      console.error('[API] initVault error:', error);
      throw error;
    }
  },

  // ===================== CHANGE PASSWORD =====================
  changePassword: async (currentPassword, newPassword) => {
    try {
      console.log('[API] changePassword called');
      const result = await ipcRenderer.invoke('vault:changePassword', currentPassword, newPassword);
      return result;
    } catch (error) {
      console.error('[API] changePassword error:', error);
      return { success: false, error: error.message };
    }
  },

  // ===================== BROWSER EXTENSION PAIRING =====================
  generatePairingCode: async () => {
    try {
      return await ipcRenderer.invoke('generate-pairing-code');
    } catch (error) {
      console.error('[API] generatePairingCode error:', error);
      return { secret: null };
    }
  },
  

  verifyPairingCode: async (secret) => {
    try {
      return await ipcRenderer.invoke('verify-pairing-code', secret);
    } catch (error) {
      console.error('[API] verifyPairingCode error:', error);
      return { valid: false };
    }
  },

  // ===================== PASSKEY METHODS =====================
  getPasskeys: async () => {
    try {
      return await ipcRenderer.invoke('passkey:getAll');
    } catch (error) {
      console.error('[API] getPasskeys error:', error);
      return { success: false, data: [] };
    }
  },

  savePasskey: async (passkeyData) => {
    try {
      return await ipcRenderer.invoke('passkey:save', passkeyData);
    } catch (error) {
      console.error('[API] savePasskey error:', error);
      return { success: false, error: error.message };
    }
  },

  deletePasskey: async (id) => {
    try {
      return await ipcRenderer.invoke('passkey:delete', id);
    } catch (error) {
      console.error('[API] deletePasskey error:', error);
      return { success: false, error: error.message };
    }
  },

  // ===================== BIOMETRIC =====================
  biometric: {
    isAvailable: async () => {
      try {
        const result = await ipcRenderer.invoke('biometric:isAvailable');
        return result.available;
      } catch (error) {
        console.error('[API] biometric.isAvailable error:', error);
        return false;
      }
    },

    isEnabled: async () => {
      try {
        return await ipcRenderer.invoke('biometric:isEnabled');
      } catch (error) {
        console.error('[API] biometric.isEnabled error:', error);
        return false;
      }
    },

    enable: async () => {
      try {
        return await ipcRenderer.invoke('biometric:enable');
      } catch (error) {
        console.error('[API] biometric.enable error:', error);
        return false;
      }
    },

    disable: async () => {
      try {
        return await ipcRenderer.invoke('biometric:disable');
      } catch (error) {
        console.error('[API] biometric.disable error:', error);
        return false;
      }
    },

    unlock: async () => {
      try {
        return await ipcRenderer.invoke('biometric:unlock');
      } catch (error) {
        console.error('[API] biometric.unlock error:', error);
        return { success: false, error: error.message };
      }
    }
  },

  // ===================== SYNC =====================
  sync: {
    push: async () => {
      try {
        return await ipcRenderer.invoke('sync:push');
      } catch (error) {
        console.warn('[API] Sync push not available:', error.message);
        return { success: false, error: 'Sync feature coming soon' };
      }
    },

    pull: async () => {
      try {
        return await ipcRenderer.invoke('sync:pull');
      } catch (error) {
        console.warn('[API] Sync pull not available:', error.message);
        return { success: false, error: 'Sync feature coming soon' };
      }
    },

    getCID: async () => {
      try {
        const result = await ipcRenderer.invoke('sync:getCID');
        return result?.cid || null;
      } catch (error) {
        console.warn('[API] Sync getCID not available:', error.message);
        return null;
      }
    }
  },

  // ===================== SETTINGS =====================
  settings: {
    getAutoSync: async () => {
      try {
        return await ipcRenderer.invoke('settings:getAutoSync');
      } catch (error) {
        console.error('[API] settings.getAutoSync error:', error);
        return false;
      }
    },

    setAutoSync: async (enabled) => {
      try {
        return await ipcRenderer.invoke('settings:setAutoSync', enabled);
      } catch (error) {
        console.error('[API] settings.setAutoSync error:', error);
        return false;
      }
    }
  },

  // ===================== VAULT STATUS LISTENERS =====================
  // Register a callback for vault status changes
  // IMPORTANT: This callback is ADDED to the global Set, NOT removed
  // DO NOT call removeVaultStatusListener - it will break the singleton pattern
  onVaultStatusChange: (callback) => {
    if (typeof callback === 'function') {
      // Add to the global callbacks Set
      callbacks.add(callback);
      console.log('[API] Vault status callback registered. Total callbacks:', callbacks.size);
    } else {
      console.error('[API] onVaultStatusChange: callback must be a function');
    }
  },

  // Legacy status listener (for backward compatibility with existing code)
  onVaultStatusChangeLegacy: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('vault:status-changed', (event, status) => {
        callback(status);
      });
    } else {
      console.error('[API] onVaultStatusChangeLegacy: callback must be a function');
    }
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Also expose electronAPI for compatibility with the launchWebsite function
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: async (url) => {
    console.log('[electronAPI] openExternal called with URL:', url);
    return await ipcRenderer.invoke('open-external', url);
  },
  setPendingAutofill: async (payload) => {
    return await setPendingAutofill(payload);
  }
});

// Also expose electron for any direct calls (backward compatibility)
contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, ...args) => {
    return await ipcRenderer.invoke(channel, ...args);
  }
});

console.log('[Preload] API exposed. Available methods:', Object.keys(api));
console.log('[Preload] electronAPI.openExternal exposed:', typeof contextBridge.exposeInMainWorld);
console.log('[Preload] electronAPI.setPendingAutofill exposed');
console.log('[Preload] Vault status listener is SINGLETON - will persist for app lifetime');