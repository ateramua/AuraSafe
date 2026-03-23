import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Store from 'electron-store';

import {
  initVault,
  unlockVault,
  lockVault,
  isUnlocked,
  loadVaultEntries,
  saveVaultEntries,
  enableBiometricUnlock,
  unlockWithBiometric,
  disableBiometricUnlock,
  isBiometricUnlockAvailable,
  isAutoSyncEnabled,
} from '../crypto/key-manager.mjs';

import { isBiometricAvailable } from '../crypto/biometric-manager.mjs';
import { pushToIPFS, pullFromIPFS, getCurrentCID } from '../sync/sync-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, '../preload/preload.cjs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// ========== Helper to get MIME type ==========
function getMimeType(ext) {
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.map': 'application/json',
  };
  return types[ext] || 'application/octet-stream';
}

// ========== Create Electron window ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://index.html');
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ========== App ready ==========
app.whenReady().then(() => {
  const outPath = app.isPackaged
    ? path.join(process.resourcesPath, 'out')
    : path.join(__dirname, '../../out');

  console.log('Preload path:', preloadPath);
  console.log('Out path:', outPath);
  console.log('Out folder exists:', fs.existsSync(outPath));

  // Register custom protocol to serve static files
  protocol.handle('app', async (request) => {
    try {
      let filePath = request.url.slice('app://'.length);
      if (filePath.startsWith('/')) filePath = filePath.slice(1);

      // Default to index.html for empty route
      if (!filePath || filePath === '/') filePath = 'index.html';

      let fullPath = path.join(outPath, filePath);

      // SPA fallback for routes without extension
      if (!path.extname(filePath)) {
        const asDir = path.join(outPath, filePath, 'index.html');
        const asFile = path.join(outPath, filePath + '.html');
        if (fs.existsSync(asDir)) fullPath = asDir;
        else if (fs.existsSync(asFile)) fullPath = asFile;
        else fullPath = path.join(outPath, 'index.html');
      }

      // Security: ensure path is inside outPath
      if (!fullPath.startsWith(outPath)) {
        return new Response('Forbidden', { status: 403 });
      }

      await fs.promises.access(fullPath, fs.constants.R_OK);
      const data = await fs.promises.readFile(fullPath);
      const mime = getMimeType(path.extname(fullPath));
      return new Response(data, { headers: { 'Content-Type': mime } });
    } catch (err) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ========== IPC Handlers ==========
ipcMain.handle('vault:init', async (event, masterPassword) => {
  await initVault(masterPassword);
  return true;
});

ipcMain.handle('vault:unlock', async (event, masterPassword) => {
  const success = await unlockVault(masterPassword);
  if (success) return { success: true, entries: loadVaultEntries() };
  return { success: false };
});

ipcMain.handle('vault:lock', () => {
  lockVault();
  return true;
});

ipcMain.handle('vault:isUnlocked', () => isUnlocked());

ipcMain.handle('vault:isInitialized', async () => {
  const vaultStore = new Store({ name: 'vault' });
  return !!vaultStore.get('masterSalt');
});

ipcMain.handle('vault:getEntries', () => {
  if (!isUnlocked()) throw new Error('Vault locked');
  return loadVaultEntries();
});

ipcMain.handle('vault:saveEntry', async (event, entry) => {
  if (!isUnlocked()) throw new Error('Vault locked');
  const entries = loadVaultEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  if (index !== -1) entries[index] = { ...entries[index], ...entry };
  else entries.push(entry);
  saveVaultEntries(entries);
  if (await isAutoSyncEnabled()) {
    try { await pushToIPFS(); } catch (err) { console.error('Auto-sync failed:', err); }
  }
  return entries;
});

ipcMain.handle('vault:deleteEntry', async (event, id) => {
  if (!isUnlocked()) throw new Error('Vault locked');
  const entries = loadVaultEntries();
  const newEntries = entries.filter(e => e.id !== id);
  saveVaultEntries(newEntries);
  if (await isAutoSyncEnabled()) {
    try { await pushToIPFS(); } catch (err) { console.error('Auto-sync failed:', err); }
  }
  return newEntries;
});

ipcMain.handle('sync:push', async () => {
  try { return { success: true, cid: await pushToIPFS() }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('sync:pull', async () => {
  try { await pullFromIPFS(); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('sync:getCID', () => getCurrentCID());

ipcMain.handle('biometric:isAvailable', async () => isBiometricAvailable());
ipcMain.handle('biometric:isEnabled', async () => await isBiometricUnlockAvailable());
ipcMain.handle('biometric:enable', async () => await enableBiometricUnlock());
ipcMain.handle('biometric:disable', async () => await disableBiometricUnlock());
ipcMain.handle('biometric:unlock', async () => {
  const success = await unlockWithBiometric();
  if (success) return { success: true, entries: loadVaultEntries() };
  return { success: false, error: 'Authentication failed' };
});

ipcMain.handle('ping', () => 'pong from main process');