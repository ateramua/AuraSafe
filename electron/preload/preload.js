const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs to renderer safely
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (channel, data) => ipcRenderer.send(channel, data),
  receiveMessage: (channel, callback) => ipcRenderer.on(channel, (event, data) => callback(data))
});