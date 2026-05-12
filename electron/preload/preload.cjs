const { contextBridge, ipcRenderer, shell } = require('electron');

console.log('🔌 Preload script loaded');

try {
  const api = {
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

    // Settings
    settings: {
      getAutoSync: () => ipcRenderer.invoke('get-user-setting', 'autoSyncEnabled', 'true'),
      setAutoSync: (enabled) => ipcRenderer.invoke('save-user-setting', 'autoSyncEnabled', enabled ? 'true' : 'false'),
    },

    // Open external URL
    openExternal: async (url) => {
      console.log('[API] openExternal called with URL:', url);
      const result = await shell.openExternal(url);
      return { success: true, result };
    },

    // Autofill queueing
    autofill: async (data) => {
      console.log('[API] autofill called for URL:', data?.url);
      return ipcRenderer.invoke('autofill', data);
    },

    // 🔥 Pre-vault backup methods (available before initialization)
    backupPreVault: {
      initTemp: () => ipcRenderer.invoke('backup:init-temp'),
      importFile: () => ipcRenderer.invoke('backup:import-file-pre-vault'),
      iCloudRestore: () => ipcRenderer.invoke('backup:icloud-restore-pre-vault'),
    },

    // Post-vault backup methods
    backup: {
      export: (vaultData) => ipcRenderer.invoke('backup:export', vaultData),
      import: () => ipcRenderer.invoke('backup:import'),
      iCloudAvailable: () => ipcRenderer.invoke('backup:icloud:available'),
      iCloudBackup: (vaultData) => ipcRenderer.invoke('backup:icloud:backup', vaultData),
      iCloudRestore: () => ipcRenderer.invoke('backup:icloud:restore'),
      findLocal: () => ipcRenderer.invoke('backup:find-local'),
    },

    // Vault export/import operations
    vaultBackup: {
      export: (password, options) => ipcRenderer.invoke('vault-backup:export', password, options),
      import: (password, options) => ipcRenderer.invoke('vault-backup:import', password, options),
      preview: (password) => ipcRenderer.invoke('vault-backup:preview', password),
      getStatus: (operationId) => ipcRenderer.invoke('vault-backup:status', operationId),
    },
  };

  contextBridge.exposeInMainWorld('api', api);

  console.log('✅ API exposed successfully as window.api');
  console.log('📋 backupPreVault methods:', Object.keys(api.backupPreVault || {}));
  console.log('📋 backup methods:', Object.keys(api.backup || {}));
} catch (err) {
  console.error('❌ Failed to expose API:', err);
}
