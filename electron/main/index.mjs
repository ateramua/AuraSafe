// ===================== CORE IMPORTS =====================
import { app, BrowserWindow, ipcMain } from 'electron';

// ===================== CRITICAL POLYFILL (MUST BE FIRST) =====================
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File { };
}

// Prevent Electron extension-related crashes
app.commandLine.appendSwitch('disable-features', 'ElectronExtensionsEnabled');

// ===================== NODE / THIRD-PARTY =====================
import path from 'path';
import fs from 'fs';
import express from 'express';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

const require = createRequire(import.meta.url);

// ===================== SAFE STORE =====================
const Store = require('electron-store');
const settings = new Store();

// ===================== NATIVE MODULES =====================
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

sqlite3.verbose();

// ===================== PATH RESOLUTION =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preloadPath = path.join(__dirname, '../preload/preload.cjs');

// ===================== CUSTOM MODULES =====================
import {
  initVault,
  unlockVault,
  lockVault,
  isUnlocked,
  loadVaultEntries,
  saveVaultEntries
} from '../crypto/key-manager.mjs';

import { isBiometricAvailable } from '../crypto/biometric-manager.mjs';

// ===================== SYNC ENGINE (SAFE LAZY LOAD) =====================
let pushToIPFS, pullFromIPFS, getCurrentCID;

async function loadSyncEngine() {
  try {
    const mod = await import('../sync/sync-engine.mjs');
    pushToIPFS = mod.pushToIPFS;
    pullFromIPFS = mod.pullFromIPFS;
    getCurrentCID = mod.getCurrentCID;
  } catch (error) {
    console.error('[SyncEngine] Failed to load:', error);
  }
}

// ===================== GLOBAL STATE =====================
let mainWindow;
let server;
let db;
let wsServer;
let vaultUnlocked = false;
let masterKey = null;

// ===================== DATABASE =====================
function getDatabasePath() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'aurasafe.db')
    : path.join(__dirname, '../../src/db/data/app.db');
}

async function getDatabase() {
  if (db) return db;

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON');
  return db;
}

// ===================== BROADCAST VAULT STATE =====================
function broadcastVaultState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vault:status-changed', {
      unlocked: vaultUnlocked
    });
  }
}

// ===================== WINDOW =====================
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===================== SERVER (PRODUCTION) =====================
function startStaticServer(outPath) {
  const expressApp = express();
  expressApp.use(express.static(outPath));

  expressApp.get('*', (req, res) => {
    const indexPath = path.join(outPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.error('[Server] Missing index.html in:', outPath);
      return res.status(404).send('App build not found');
    }
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(indexPath);
  });

  server = expressApp.listen(0, () => {
    const port = server.address().port;
    createWindow(`http://localhost:${port}`);
  });
}

// ===================== APP INITIALIZATION =====================
app.whenReady().then(async () => {
  try {
    await getDatabase();
    await loadSyncEngine();

    const outPath = path.join(__dirname, '../../out');

    if (app.isPackaged) {
      startStaticServer(outPath);
    } else {
      createWindow('http://localhost:3000');
    }

  } catch (error) {
    console.error('[App Init Failed]', error);
    app.quit();
  }
});

// ===================== IPC HANDLERS =====================
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('vault:isInitialized', async () => {
  try {
    const db = await getDatabase();
    const result = await db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='vault_entries'");
    return { initialized: result.count > 0 };
  } catch (error) {
    console.error('[vault:isInitialized] Error:', error);
    return { initialized: false, error: error.message };
  }
});

ipcMain.handle('vault:init', async (event, masterPassword) => {
  try {
    const db = await getDatabase();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        username TEXT,
        password TEXT,
        url TEXT,
        notes TEXT,
        category TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    return { success: true };
  } catch (error) {
    console.error('[vault:init] Error:', error);
    throw error;
  }
});

// Window controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// File system handlers (with security restrictions)
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const userDataPath = app.getPath('userData');
    const resolvedPath = path.resolve(filePath);
    
    if (!resolvedPath.startsWith(userDataPath)) {
      throw new Error('Access denied: Cannot read outside userData directory');
    }
    
    return await fs.promises.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    console.error('[fs:readFile] Error:', error);
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    const userDataPath = app.getPath('userData');
    const resolvedPath = path.resolve(filePath);
    
    if (!resolvedPath.startsWith(userDataPath)) {
      throw new Error('Access denied: Cannot write outside userData directory');
    }
    
    await fs.promises.writeFile(resolvedPath, data, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('[fs:writeFile] Error:', error);
    throw error;
  }
});

// Sync handlers
ipcMain.handle('sync:push', async () => {
  try {
    if (pushToIPFS) {
      const result = await pushToIPFS();
      return result;
    }
    throw new Error('Sync engine not loaded');
  } catch (error) {
    console.error('[sync:push] Error:', error);
    throw error;
  }
});

ipcMain.handle('sync:pull', async () => {
  try {
    if (pullFromIPFS) {
      const result = await pullFromIPFS();
      return result;
    }
    throw new Error('Sync engine not loaded');
  } catch (error) {
    console.error('[sync:pull] Error:', error);
    throw error;
  }
});

ipcMain.handle('sync:getCID', async () => {
  try {
    if (getCurrentCID) {
      const cid = await getCurrentCID();
      return { cid };
    }
    throw new Error('Sync engine not loaded');
  } catch (error) {
    console.error('[sync:getCID] Error:', error);
    throw error;
  }
});

// Vault CRUD operations with unlock checks
ipcMain.handle('vault:saveEntry', async (event, entry) => {
  if (!vaultUnlocked && !isUnlocked()) {
    throw new Error('Vault is locked');
  }
  
  try {
    const db = await getDatabase();
    const now = Date.now();
    
    if (entry.id) {
      await db.run(
        `UPDATE vault_entries SET 
          title = ?, username = ?, password = ?, url = ?, notes = ?, category = ?, updated_at = ?
         WHERE id = ?`,
        entry.title, entry.username, entry.password, entry.url, 
        entry.notes, entry.category, now, entry.id
      );
      return { ...entry, updatedAt: now };
    } else {
      const id = randomBytes(16).toString('hex');
      await db.run(
        `INSERT INTO vault_entries (id, title, username, password, url, notes, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, entry.title, entry.username, entry.password, entry.url, 
        entry.notes, entry.category, now, now
      );
      return { ...entry, id, createdAt: now, updatedAt: now };
    }
  } catch (error) {
    console.error('[vault:saveEntry] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:deleteEntry', async (event, id) => {
  if (!vaultUnlocked && !isUnlocked()) {
    throw new Error('Vault is locked');
  }
  
  try {
    const db = await getDatabase();
    await db.run('DELETE FROM vault_entries WHERE id = ?', id);
    return { success: true };
  } catch (error) {
    console.error('[vault:deleteEntry] Error:', error);
    throw error;
  }
});

// Biometric handlers
ipcMain.handle('biometric:isEnabled', async () => {
  try {
    const enabled = settings.get('biometricEnabled', false);
    return enabled;
  } catch (error) {
    console.error('[biometric:isEnabled] Error:', error);
    return false;
  }
});

ipcMain.handle('biometric:enable', async () => {
  try {
    const available = await isBiometricAvailable();
    if (available) {
      settings.set('biometricEnabled', true);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[biometric:enable] Error:', error);
    return false;
  }
});

ipcMain.handle('biometric:disable', async () => {
  try {
    settings.set('biometricEnabled', false);
    return true;
  } catch (error) {
    console.error('[biometric:disable] Error:', error);
    return false;
  }
});

ipcMain.handle('biometric:unlock', async () => {
  try {
    return { success: true };
  } catch (error) {
    console.error('[biometric:unlock] Error:', error);
    return { success: false, error: error.message };
  }
});

// Settings handlers
ipcMain.handle('settings:getAutoSync', async () => {
  try {
    return settings.get('autoSync', false);
  } catch (error) {
    console.error('[settings:getAutoSync] Error:', error);
    return false;
  }
});

ipcMain.handle('settings:setAutoSync', async (event, enabled) => {
  try {
    settings.set('autoSync', enabled);
    return true;
  } catch (error) {
    console.error('[settings:setAutoSync] Error:', error);
    return false;
  }
});

// Vault state handlers with unlock tracking
ipcMain.handle('vault:unlock', async (event, masterPassword) => {
  try {
    const result = await unlockVault(masterPassword);
    if (result.success) {
      vaultUnlocked = true;
      masterKey = result.key;
      broadcastVaultState();
    }
    return result;
  } catch (error) {
    console.error('[vault:unlock] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:lock', async () => {
  try {
    await lockVault();
    vaultUnlocked = false;
    masterKey = null;
    broadcastVaultState();
    return { success: true };
  } catch (error) {
    console.error('[vault:lock] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:isUnlocked', async () => {
  try {
    const unlocked = isUnlocked();
    vaultUnlocked = unlocked;
    return { unlocked };
  } catch (error) {
    console.error('[vault:isUnlocked] Error:', error);
    return { unlocked: false };
  }
});

ipcMain.handle('vault:getEntries', async () => {
  if (!vaultUnlocked && !isUnlocked()) {
    throw new Error('Vault is locked');
  }
  
  try {
    const entries = await loadVaultEntries();
    return entries;
  } catch (error) {
    console.error('[vault:getEntries] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:saveEntries', async (event, entries) => {
  if (!vaultUnlocked && !isUnlocked()) {
    throw new Error('Vault is locked');
  }
  
  try {
    await saveVaultEntries(entries);
    return { success: true };
  } catch (error) {
    console.error('[vault:saveEntries] Error:', error);
    throw error;
  }
});

ipcMain.handle('biometric:isAvailable', async () => {
  try {
    const available = await isBiometricAvailable();
    return { available };
  } catch (error) {
    console.error('[biometric:isAvailable] Error:', error);
    return { available: false };
  }
});

// ===================== LIFECYCLE =====================
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const url = app.isPackaged
      ? 'http://localhost'
      : 'http://localhost:3000';
    createWindow(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===================== CLEANUP =====================
app.on('before-quit', async () => {
  try {
    server?.close?.();
    wsServer?.close?.();
    if (db) {
      await db.close();
      db = null;
    }
  } catch (error) {
    console.error('[Cleanup Error]', error);
  }
});