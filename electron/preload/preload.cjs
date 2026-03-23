const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 Preload script loaded');

try {
  contextBridge.exposeInMainWorld('api', {
    test: () => 'test',
    isInitialized: () => ipcRenderer.invoke('vault:isInitialized'),
    isUnlocked: () => ipcRenderer.invoke('vault:isUnlocked'),
    unlockVault: (password) => ipcRenderer.invoke('vault:unlock', password),
    initVault: (password) => ipcRenderer.invoke('vault:init', password),
    lockVault: () => ipcRenderer.invoke('vault:lock'),
    getVaultEntries: () => ipcRenderer.invoke('vault:getEntries'),
    saveVaultEntry: (entry) => ipcRenderer.invoke('vault:saveEntry', entry),
    deleteVaultEntry: (id) => ipcRenderer.invoke('vault:deleteEntry', id),
    biometric: {
      isAvailable: () => ipcRenderer.invoke('biometric:isAvailable'),
      isEnabled: () => ipcRenderer.invoke('biometric:isEnabled'),
      enable: () => ipcRenderer.invoke('biometric:enable'),
      disable: () => ipcRenderer.invoke('biometric:disable'),
      unlock: () => ipcRenderer.invoke('biometric:unlock'),
    },
    sync: {
      push: () => ipcRenderer.invoke('sync:push'),
      pull: () => ipcRenderer.invoke('sync:pull'),
      getCID: () => ipcRenderer.invoke('sync:getCID'),
    },
    settings: {
      getAutoSync: () => ipcRenderer.invoke('settings:getAutoSync'),
      setAutoSync: (enabled) => ipcRenderer.invoke('settings:setAutoSync', enabled),
    },
    ping: () => ipcRenderer.invoke('ping'),
  });
  console.log('✅ API exposed successfully');
} catch (err) {
  console.error('❌ Failed to expose API:', err);
}