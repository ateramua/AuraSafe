// ===================== CORE IMPORTS =====================
import { app, BrowserWindow, ipcMain } from 'electron';
import { broadcastVaultStatus } from './server.js';


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
import crypto from 'crypto';

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

// ===================== 🆕 CHROME EXTENSION SYNC =====================
// Import store.js functions for Chrome extension sync
let setExtensionSyncEnabled, manualSyncToExtension, getExtensionSyncStatus;

async function loadExtensionSync() {
  try {
    // Dynamic import for store.js
    const storeModule = await import('./lib/store.js');
    setExtensionSyncEnabled = storeModule.setExtensionSyncEnabled;
    manualSyncToExtension = storeModule.manualSyncToExtension;
    getExtensionSyncStatus = storeModule.getExtensionSyncStatus;
    console.log('[Extension Sync] Loaded successfully');
  } catch (error) {
    console.error('[Extension Sync] Failed to load store.js:', error);
  }
}

// ===================== GLOBAL STATE =====================
let mainWindow;
let server;
let db;
let wsServer;
let vaultUnlocked = false;
let masterKey = null;
let extensionSyncInitialized = false; // 🆕 Track sync initialization

// ===================== PAIRING SECRETS STORE =====================
const pairingSecrets = new Map();

// ===================== WEBSOCKET SERVER (DISABLED - USING HTTP INSTEAD) =====================
// WebSocket server code has been removed in favor of HTTP API endpoints

// ===================== 🆕 INITIALIZE EXTENSION SYNC =====================
async function initializeExtensionSync() {
  if (extensionSyncInitialized) {
    console.log('[Extension Sync] Already initialized');
    return true;
  }

  try {
    // Load the extension sync module
    await loadExtensionSync();

    if (setExtensionSyncEnabled && manualSyncToExtension) {
      // Enable extension sync
      await setExtensionSyncEnabled(true);
      console.log('[Extension Sync] Enabled');

      // Perform initial sync to Chrome extension
      const syncResult = await manualSyncToExtension();
      console.log('[Extension Sync] Initial sync result:', syncResult);

      // Check sync status
      if (getExtensionSyncStatus) {
        const status = await getExtensionSyncStatus();
        console.log('[Extension Sync] Status:', status);
      }

      extensionSyncInitialized = true;
      return true;
    } else {
      console.warn('[Extension Sync] Functions not available');
      return false;
    }
  } catch (error) {
    console.error('[Extension Sync] Initialization failed:', error);
    return false;
  }
}

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

// After getDatabase function is defined, register it with server.js
import { setDatabaseGetter } from './server.js';

// Then after the getDatabase function definition, add:
setDatabaseGetter(getDatabase);

// ===================== 🆕 SYNC TO EXTENSION ON VAULT CHANGES =====================
async function syncToExtensionOnChange() {
  try {
    if (extensionSyncInitialized && manualSyncToExtension) {
      await manualSyncToExtension();
      console.log('[Extension Sync] Synced after vault change');
    }
  } catch (error) {
    console.error('[Extension Sync] Failed to sync on change:', error);
  }
}

// ===================== BROADCAST VAULT STATE TO ALL WINDOWS =====================
function broadcastVaultStateToAllWindows() {
  console.log('[Main] Broadcasting vault status to all windows:', vaultUnlocked);
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('vault-status-change', { unlocked: vaultUnlocked });
    }
  });
}

// Legacy broadcast for main window only
function broadcastVaultState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vault:status-changed', {
      unlocked: vaultUnlocked
    });
  }
  broadcastVaultStateToAllWindows();
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

// ===================== SERVER WITH API ENDPOINTS (PRODUCTION) =====================
function startStaticServer(outPath) {
  const expressApp = express();
  
  // 🔥 ADD JSON PARSING AND CORS
  expressApp.use(express.json());
  
  // Enable CORS for extension
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
  
  // ===================== API ENDPOINTS FOR EXTENSION =====================
  
  // API endpoint for credentials
  expressApp.get('/api/credentials', async (req, res) => {
    try {
      const database = await getDatabase();
      const entries = await database.all('SELECT * FROM vault_entries ORDER BY created_at DESC');
      res.json(entries || []);
    } catch (err) {
      console.error('[API] Error fetching credentials:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // API endpoint for status
  expressApp.get('/api/status', async (req, res) => {
    res.json({ unlocked: vaultUnlocked, timestamp: Date.now() });
  });
  
  // API endpoint for pairing (if needed)
  expressApp.post('/api/pair', async (req, res) => {
    const { code } = req.body;
    console.log('[API] Pairing request received with code:', code);
    // Verify pairing code logic here
    res.json({ success: true, message: 'Pairing successful' });
  });
  
  // ===================== STATIC FILE SERVING =====================
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

  // 🔥 USE A FIXED PORT - NOT RANDOM
  const FIXED_PORT = 3456;
  server = expressApp.listen(FIXED_PORT, () => {
    console.log(`[Server] HTTP server running on http://localhost:${FIXED_PORT}`);
    console.log(`[Server] API endpoints available at http://localhost:${FIXED_PORT}/api/`);
    createWindow(`http://localhost:${FIXED_PORT}`);
  });
}

// ===================== APP INITIALIZATION =====================
app.whenReady().then(async () => {
  try {
    await getDatabase();
    await loadSyncEngine();

    // 🆕 Initialize Chrome Extension Sync
    await initializeExtensionSync();

    const outPath = path.join(__dirname, '../../out');

    if (app.isPackaged) {
      startStaticServer(outPath);
    } else {
      // In development, we need to know the port from Next.js
      // The user should run Next.js on port 3000 separately
      createWindow('http://localhost:3000');
      console.log('[Main] Development mode - expecting Next.js on port 3000');
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
        totpSecret TEXT,
        passkeyId TEXT,
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

// File system handlers
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

// ===================== VAULT CRUD OPERATIONS =====================

ipcMain.handle('vault:saveEntry', async (event, entry) => {
  const unlocked = vaultUnlocked || isUnlocked();

  if (!unlocked) {
    throw new Error('Vault is locked');
  }

  try {
    const db = await getDatabase();
    const now = Date.now();

    const safeEntry = {
      id: entry?.id,
      title: entry?.title || entry?.name || 'Untitled',
      username: entry?.username || '',
      password: entry?.password || '',
      url: entry?.url || '',
      notes: entry?.notes || '',
      category: entry?.category || 'credential',
      totpSecret: entry?.totpSecret || '',
      passkeyId: entry?.passkeyId || '',
    };

    if (safeEntry.id) {
      await db.run(
        `UPDATE vault_entries SET 
          title = ?, username = ?, password = ?, url = ?, notes = ?, 
          category = ?, totpSecret = ?, passkeyId = ?, updated_at = ?
         WHERE id = ?`,
        [
          safeEntry.title, safeEntry.username, safeEntry.password,
          safeEntry.url, safeEntry.notes, safeEntry.category,
          safeEntry.totpSecret, safeEntry.passkeyId, now, safeEntry.id
        ]
      );
      // 🆕 Sync to extension after update
      await syncToExtensionOnChange();
      return { ...safeEntry, updatedAt: now };
    }

    const id = crypto.randomBytes(16).toString('hex');
    await db.run(
      `INSERT INTO vault_entries (
        id, title, username, password, url, notes, category, totpSecret, passkeyId, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, safeEntry.title, safeEntry.username, safeEntry.password,
        safeEntry.url, safeEntry.notes, safeEntry.category,
        safeEntry.totpSecret, safeEntry.passkeyId, now, now
      ]
    );

    // 🆕 Sync to extension after insert
    await syncToExtensionOnChange();

    return { ...safeEntry, id, createdAt: now, updatedAt: now };
  } catch (error) {
    console.error('[vault:saveEntry] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:deleteEntry', async (event, id) => {
  const unlocked = vaultUnlocked || isUnlocked();
  if (!unlocked) throw new Error('Vault is locked');

  try {
    const db = await getDatabase();
    await db.run(`DELETE FROM vault_entries WHERE id = ?`, [id]);
    // 🆕 Sync to extension after delete
    await syncToExtensionOnChange();
    return { success: true };
  } catch (error) {
    console.error('[vault:deleteEntry] Error:', error);
    throw error;
  }
});

ipcMain.handle('vault:getEntries', async () => {
  const unlocked = vaultUnlocked || isUnlocked();
  if (!unlocked) throw new Error('Vault is locked');

  try {
    const db = await getDatabase();
    const rows = await db.all(`SELECT * FROM vault_entries ORDER BY created_at DESC`);
    return rows || [];
  } catch (error) {
    console.error('[vault:getEntries] Error:', error);
    throw error;
  }
});

// ===================== UNIFIED VAULT STATE HANDLERS =====================

// Primary unlock handler (called from preload)
ipcMain.handle('unlock-vault', async (event, password) => {
  try {
    const result = await unlockVault(password);
    const success = result.success;

    if (success) {
      vaultUnlocked = true;
      masterKey = result.key;

      // 🔥 ADD THIS - Broadcast to extension
      broadcastVaultStatus(true);

      // Notify ALL renderer windows
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('vault-status-change', { unlocked: true });
        }
      });
      broadcastVaultState();

      // 🆕 Sync to extension after unlock
      await syncToExtensionOnChange();

      console.log('[Main] Vault unlocked via unlock-vault');
    }

    return { success };
  } catch (error) {
    console.error('[unlock-vault] Error:', error);
    return { success: false, error: error.message };
  }
});

// Check if vault is unlocked
ipcMain.handle('is-unlocked', () => {
  return vaultUnlocked;
});

// Lock vault
ipcMain.handle('lock-vault', async () => {
  try {
    await lockVault();
    vaultUnlocked = false;
    masterKey = null;

    // 🔥 ADD THIS - Broadcast to extension
    broadcastVaultStatus(false);

    // Notify ALL renderer windows
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('vault-status-change', { unlocked: false });
      }
    });
    broadcastVaultState();

    console.log('[Main] Vault locked via lock-vault');
    return true;
  } catch (error) {
    console.error('[lock-vault] Error:', error);
    return false;
  }
});

// Legacy vault:unlock handler (kept for backward compatibility)
ipcMain.handle('vault:unlock', async (event, masterPassword) => {
  try {
    const result = await unlockVault(masterPassword);
    if (result.success) {
      vaultUnlocked = true;
      masterKey = result.key;
      
      // 🔥 ADD THIS - Broadcast to extension
      broadcastVaultStatus(true);
      
      broadcastVaultState();
      broadcastVaultStateToAllWindows();
      // 🆕 Sync to extension after unlock
      await syncToExtensionOnChange();
    }
    return result;
  } catch (error) {
    console.error('[vault:unlock] Error:', error);
    throw error;
  }
});

// Legacy vault:lock handler
ipcMain.handle('vault:lock', async () => {
  try {
    await lockVault();
    vaultUnlocked = false;
    masterKey = null;
    
    // 🔥 ADD THIS - Broadcast to extension
    broadcastVaultStatus(false);
    
    broadcastVaultState();
    broadcastVaultStateToAllWindows();
    return { success: true };
  } catch (error) {
    console.error('[vault:lock] Error:', error);
    throw error;
  }
});

// Legacy vault:isUnlocked handler
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

// Bulk save entries
ipcMain.handle('vault:saveEntries', async (event, entries) => {
  const unlocked = vaultUnlocked || isUnlocked();
  if (!unlocked) throw new Error('Vault is locked');

  try {
    await saveVaultEntries(entries);
    // 🆕 Sync to extension after bulk save
    await syncToExtensionOnChange();
    return { success: true };
  } catch (error) {
    console.error('[vault:saveEntries] Error:', error);
    throw error;
  }
});

// 🆕 Manual sync trigger for extension
ipcMain.handle('extension:sync', async () => {
  try {
    if (manualSyncToExtension) {
      const result = await manualSyncToExtension();
      return { success: result, message: result ? 'Sync successful' : 'Sync failed' };
    }
    return { success: false, message: 'Extension sync not available' };
  } catch (error) {
    console.error('[extension:sync] Error:', error);
    return { success: false, error: error.message };
  }
});

// 🆕 Get extension sync status
ipcMain.handle('extension:status', async () => {
  try {
    if (getExtensionSyncStatus) {
      const status = await getExtensionSyncStatus();
      return status;
    }
    return { enabled: false, hasChromeAPI: false };
  } catch (error) {
    console.error('[extension:status] Error:', error);
    return { enabled: false, error: error.message };
  }
});

// Biometric handlers
ipcMain.handle('biometric:isAvailable', async () => {
  try {
    const available = await isBiometricAvailable();
    return { available };
  } catch (error) {
    console.error('[biometric:isAvailable] Error:', error);
    return { available: false };
  }
});

ipcMain.handle('biometric:isEnabled', async () => {
  try {
    return settings.get('biometricEnabled', false);
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

// Passkey handlers
ipcMain.handle('passkey:getAll', async () => {
  try {
    const db = await getDatabase();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS passkeys (
        id TEXT PRIMARY KEY,
        name TEXT,
        credentialId TEXT UNIQUE,
        publicKey TEXT,
        signCount INTEGER,
        transports TEXT,
        created_at INTEGER
      )
    `);
    const passkeys = await db.all('SELECT * FROM passkeys ORDER BY created_at DESC');
    return { success: true, data: passkeys };
  } catch (error) {
    console.error('[passkey:getAll] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('passkey:save', async (event, passkeyData) => {
  try {
    const db = await getDatabase();
    await db.run(
      `INSERT OR REPLACE INTO passkeys (id, name, credentialId, publicKey, signCount, transports, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      passkeyData.id, passkeyData.name, passkeyData.credentialId,
      passkeyData.publicKey, passkeyData.signCount,
      JSON.stringify(passkeyData.transports), passkeyData.created_at
    );
    return { success: true };
  } catch (error) {
    console.error('[passkey:save] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('passkey:delete', async (event, id) => {
  try {
    const db = await getDatabase();
    await db.run('DELETE FROM passkeys WHERE id = ?', id);
    return { success: true };
  } catch (error) {
    console.error('[passkey:delete] Error:', error);
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

// Change password handler
ipcMain.handle('vault:changePassword', async (event, currentPassword, newPassword) => {
  try {
    console.log('[vault:changePassword] Starting password change...');

    const unlockResult = await unlockVault(currentPassword);
    if (!unlockResult.success) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const entries = await loadVaultEntries();
    const initResult = await initVault(newPassword);
    if (!initResult.success) {
      return { success: false, error: 'Failed to initialize new vault encryption' };
    }

    for (const entry of entries) {
      await saveVaultEntries([entry]);
    }

    // 🆕 Sync to extension after password change
    await syncToExtensionOnChange();

    return { success: true };
  } catch (error) {
    console.error('[vault:changePassword] Error:', error);
    return { success: false, error: error.message };
  }
});

// ===================== PAIRING CODE HANDLERS =====================

ipcMain.handle('generate-pairing-code', async () => {
  const secret = crypto.randomBytes(32).toString('hex');
  pairingSecrets.set(secret, { createdAt: Date.now() });

  // Auto-expire after 5 minutes
  setTimeout(() => {
    if (pairingSecrets.has(secret)) {
      pairingSecrets.delete(secret);
    }
  }, 5 * 60 * 1000);

  console.log('[Pairing] Generated new pairing code:', secret.substring(0, 16) + '...');
  return { secret };
});

ipcMain.handle('verify-pairing-code', async (event, secret) => {
  const isValid = pairingSecrets.has(secret);
  if (isValid) {
    pairingSecrets.delete(secret);
    console.log('[Pairing] Code verified and consumed');
  } else {
    console.log('[Pairing] Invalid or expired code attempted');
  }
  return { valid: isValid };
});

// ===================== LIFECYCLE =====================
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const url = app.isPackaged ? 'http://localhost' : 'http://localhost:3000';
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
    if (db) {
      await db.close();
      db = null;
    }
  } catch (error) {
    console.error('[Cleanup Error]', error);
  }
});