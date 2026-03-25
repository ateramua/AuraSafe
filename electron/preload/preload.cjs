// electron/preload/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loaded');

try {
  contextBridge.exposeInMainWorld('api', {
    // General
    ping: () => ipcRenderer.invoke('ping'),

    // Vault operations
    isInitialized: () => ipcRenderer.invoke('vault:isInitialized'),
    isUnlocked: () => ipcRenderer.invoke('vault:isUnlocked'),
    unlockVault: (password) => ipcRenderer.invoke('vault:unlock', password),
    initVault: (password) => ipcRenderer.invoke('vault:init', password),
    lockVault: () => ipcRenderer.invoke('vault:lock'),
    getVaultEntries: () => ipcRenderer.invoke('vault:getEntries'),
    saveVaultEntry: (entry) => ipcRenderer.invoke('vault:saveEntry', entry),
    deleteVaultEntry: (id) => ipcRenderer.invoke('vault:deleteEntry', id),

    // Biometric operations
    biometric: {
      isAvailable: () => ipcRenderer.invoke('biometric:isAvailable'),
      isEnabled: () => ipcRenderer.invoke('biometric:isEnabled'),
      enable: () => ipcRenderer.invoke('biometric:enable'),
      disable: () => ipcRenderer.invoke('biometric:disable'),
      unlock: () => ipcRenderer.invoke('biometric:unlock'),
    },

    // Sync operations
    sync: {
      push: () => ipcRenderer.invoke('sync:push'),
      pull: () => ipcRenderer.invoke('sync:pull'),
      getCID: () => ipcRenderer.invoke('sync:getCID'),
    },

    // Settings (user preferences)
    settings: {
      getAutoSync: () => ipcRenderer.invoke('get-user-setting', 'autoSyncEnabled', 'true'),
      setAutoSync: (enabled) => ipcRenderer.invoke('save-user-setting', 'autoSyncEnabled', enabled ? 'true' : 'false'),
      // Add other settings as needed
    },
  });

  console.log('✅ API exposed successfully as window.api');
} catch (err) {
  console.error('❌ Failed to expose API:', err);
}