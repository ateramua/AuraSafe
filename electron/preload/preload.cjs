// ===================== PRELOAD SCRIPT =====================
const { contextBridge, ipcRenderer } = require('electron');

// Create the API object that matches what api-client.js expects
const api = {
  // Vault CRUD
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
  
  // Vault state
  isInitialized: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:isInitialized');
      return result.initialized;
    } catch (error) {
      console.error('[API] isInitialized error:', error);
      return false;
    }
  },
  
  isUnlocked: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:isUnlocked');
      return result.unlocked;
    } catch (error) {
      console.error('[API] isUnlocked error:', error);
      return false;
    }
  },
  
  unlockVault: async (password) => {
    try {
      return await ipcRenderer.invoke('vault:unlock', password);
    } catch (error) {
      console.error('[API] unlockVault error:', error);
      throw error;
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
  
  lockVault: async () => {
    try {
      const result = await ipcRenderer.invoke('vault:lock');
      return result.success;
    } catch (error) {
      console.error('[API] lockVault error:', error);
      throw error;
    }
  },
  
  // Biometric
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
  
  // Sync with graceful error handling (feature coming soon)
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
  
  // Settings
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
  
  // Vault status change listener
  onVaultStatusChange: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.on('vault:status-changed', (event, status) => {
        callback(status);
      });
    } else {
      console.error('[API] onVaultStatusChange: callback must be a function');
    }
  },
  
  // Remove vault status listener
  removeVaultStatusListener: (callback) => {
    if (typeof callback === 'function') {
      ipcRenderer.removeListener('vault:status-changed', callback);
    }
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);

// Also expose electron for any direct calls (backward compatibility)
contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, ...args) => {
    return await ipcRenderer.invoke(channel, ...args);
  }
});

console.log('[Preload] API exposed. Available methods:', Object.keys(api));