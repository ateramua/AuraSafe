import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
import net from 'net';
import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';
import BackupManager from '../backup/backup-manager.mjs';

// Import your custom modules
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

// ========================
// 🔐 SINGLE INSTANCE LOCK (ENHANCED FIX)
// ========================
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  console.log('🚫 Blocked duplicate launch');
  app.exit(0);
  process.exit(0);
}

// Prevent macOS re-triggering open events
app.on('open-url', (event) => {
  event.preventDefault();
  console.log('🚫 Blocked open-url relaunch');
});

// Handle second instance (when user tries to launch another instance)
app.on('second-instance', () => {
  console.log('⚠️ Second instance detected — focusing existing window');
  
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    const win = wins[0];
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ FIXED: Correct preload resolution for both dev and production
const preloadPath = app.isPackaged
  ? path.join(process.resourcesPath, 'preload/preload.cjs')
  : path.join(__dirname, '../preload/preload.cjs');

console.log('📌 Preload path:', preloadPath);
console.log('📌 Preload exists:', fs.existsSync(preloadPath));
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let server;
let bridgeServer;
let bridgeApp;
let bridgePort = null;
let bridgeInfoPath = null;
let db;
let wsServer;
let pendingAutofillRequest = null;
let EXTENSION_SECRET;
let backupManager = null;
let tempBackupManager = null;
const BRIDGE_PORT_RANGE_START = 36000;
const BRIDGE_PORT_RANGE_END = 36020;
const BRIDGE_DISCOVERY_FILENAME = 'aurasafe-bridge.json';
const ALLOWED_EXTENSION_ORIGINS = [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^edge-extension:\/\//i];
const BRIDGE_SESSION_TOKENS = new Map();
const BRIDGE_RATE_LIMITS = new Map();
const BRIDGE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const BRIDGE_RATE_LIMIT_MAX_REQUESTS = 120;

// ========== Database helpers ==========
function getDatabasePath() {
  if (app.isPackaged || !isDev) {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'money-manager.db');
  }
  const projectRoot = path.resolve(__dirname, '../..');
  return path.join(projectRoot, 'src/db/data/app.db');
}

async function getDatabase() {
  if (db) {
    try {
      await db.get('SELECT 1');
      return db;
    } catch (e) {
      console.log('⚠️ Database connection stale, reconnecting...');
      db = null;
    }
  }
  const dbPath = getDatabasePath();
  console.log('📂 Database path:', dbPath);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON');
  await db.get('SELECT 1');
  console.log('✅ Database connection established');
  return db;
}

async function initDatabase() {
  console.log('📦 Initializing database...');
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const dbExists = fs.existsSync(dbPath);
  console.log('📂 Database exists:', dbExists);

  if ((app.isPackaged || !isDev) && !dbExists) {
    console.log('📦 First run – creating new database...');
    const db = await getDatabase();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        full_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS category_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        group_id TEXT,
        assigned REAL DEFAULT 0,
        activity REAL DEFAULT 0,
        available REAL DEFAULT 0,
        target_type TEXT,
        target_amount REAL,
        target_date DATE,
        priority INTEGER DEFAULT 2,
        last_month_assigned REAL DEFAULT 0,
        average_spending REAL DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance REAL DEFAULT 0,
        cleared_balance REAL DEFAULT 0,
        working_balance REAL DEFAULT 0,
        account_type_category TEXT DEFAULT 'budget',
        currency TEXT DEFAULT 'USD',
        institution TEXT,
        credit_limit REAL,
        interest_rate REAL,
        due_date DATE,
        minimum_payment REAL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        category_id TEXT,
        payee TEXT,
        memo TEXT,
        is_cleared INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS plaid_items (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        access_token TEXT NOT NULL,
        institution_id TEXT,
        institution_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        last_sync DATETIME,
        cursor TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS plaid_accounts (
        plaid_account_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        account_id TEXT,
        mask TEXT,
        name TEXT,
        official_name TEXT,
        type TEXT,
        subtype TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (item_id) REFERENCES plaid_items(id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
      CREATE TABLE IF NOT EXISTS plaid_category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plaid_category TEXT NOT NULL,
        category_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id),
        UNIQUE(user_id, plaid_category)
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        updated_at DATETIME,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    await db.run(`INSERT OR IGNORE INTO users (id, username, email, full_name) VALUES (2, 'demo', 'demo@example.com', 'Demo User')`);
    await db.run(`INSERT OR IGNORE INTO category_groups (id, user_id, name, sort_order) VALUES (1, 2, 'Fixed Expenses', 1), (2, 2, 'Variable Expenses', 2)`);
    await db.run(`INSERT OR IGNORE INTO categories (id, user_id, name, group_id, assigned) VALUES 
      ('cat1', 2, 'Groceries', 2, 0), ('cat2', 2, 'Rent', 1, 1500), ('cat3', 2, 'Utilities', 1, 200),
      ('cat4', 2, 'Dining Out', 2, 300), ('cat5', 2, 'Transportation', 2, 150)`);
    await db.run(`INSERT OR IGNORE INTO accounts (id, user_id, name, type, balance, institution) VALUES 
      ('test4', 2, 'Checking', 'checking', 3450.89, 'Chase'), ('1faa4471-bbd8-4fbb-9c06-716c9373eb75', 2, 'Savings', 'savings', 10000, 'Chase')`);
    await db.run(`INSERT OR IGNORE INTO transactions (account_id, user_id, date, description, amount, category_id, payee) VALUES 
      ('test4', 2, date('now', '-5 days'), 'Grocery Store', -145.67, 'cat1', 'Walmart'),
      ('test4', 2, date('now', '-10 days'), 'Electric Bill', -85.20, 'cat3', 'Power Company'),
      ('test4', 2, date('now', '-15 days'), 'Restaurant', -45.99, 'cat4', 'Olive Garden')`);
    console.log('✅ Created database with schema and sample data');
  } else {
    await getDatabase();
    console.log('✅ Database already exists');
  }
  return db;
}

// ========== Extension token management ==========
const tokenStore = new Store({ name: 'extension' });
EXTENSION_SECRET = tokenStore.get('token');
if (!EXTENSION_SECRET) {
  EXTENSION_SECRET = randomBytes(32).toString('hex');
  tokenStore.set('token', EXTENSION_SECRET);
  console.log('🔑 Generated bridge secret:', EXTENSION_SECRET);
} else {
  console.log('🔑 Using existing bridge secret:', EXTENSION_SECRET);
}

// ========== Local bridge helpers ==========
function getBridgeInfoFilePath() {
  if (!bridgeInfoPath) {
    if (process.platform === 'win32') {
      bridgeInfoPath = path.join(process.env.TEMP || os.tmpdir(), BRIDGE_DISCOVERY_FILENAME);
    } else {
      bridgeInfoPath = path.join('/tmp', BRIDGE_DISCOVERY_FILENAME);
    }
  }
  return bridgeInfoPath;
}

function rateLimit(req, res, next) {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = BRIDGE_RATE_LIMITS.get(remoteAddress) || { count: 0, windowStart: now };

  if (now - record.windowStart > BRIDGE_RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count += 1;
  BRIDGE_RATE_LIMITS.set(remoteAddress, record);

  if (record.count > BRIDGE_RATE_LIMIT_MAX_REQUESTS) {
    return sendBridgeError(res, 429, 'Rate limit exceeded');
  }

  next();
}

function isLoopbackAddress(address) {
  if (!address) return false;
  const normalized = address.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1';
}

function sanitizeLogBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  if ('password' in sanitized) sanitized.password = '[REDACTED]';
  if ('token' in sanitized) sanitized.token = '[REDACTED]';
  if (sanitized.entry && typeof sanitized.entry === 'object') {
    sanitized.entry = { ...sanitized.entry, password: sanitized.entry.password ? '[REDACTED]' : undefined };
  }
  return sanitized;
}

function sendBridgeError(res, status, message, details = null) {
  res.status(status).json({ status: 'error', message, details });
}

async function getAvailableLocalPort(start, end) {
  for (let port = start; port <= end; port++) {
    const available = await new Promise((resolve) => {
      const tester = net.createServer();
      tester.once('error', () => {
        resolve(false);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '127.0.0.1');
    });

    if (available) {
      return port;
    }
  }
  throw new Error(`No available local port found in range ${start}-${end}`);
}

function writeBridgeInfoFile() {
  try {
    const filePath = getBridgeInfoFilePath();
    const data = {
      port: bridgePort,
      token: EXTENSION_SECRET,
      createdAt: new Date().toISOString(),
      description: 'AuraSafe local extension bridge info',
      originAllowlist: ['chrome-extension://', 'moz-extension://', 'edge-extension://'],
      platform: process.platform,
      path: filePath,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log('📄 Bridge discovery file written:', filePath);
  } catch (error) {
    console.error('❌ Failed to write bridge discovery file:', error);
  }
}

function removeBridgeInfoFile() {
  try {
    const filePath = getBridgeInfoFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🧹 Removed stale bridge discovery file:', filePath);
    }
  } catch (error) {
    console.warn('⚠️ Could not remove bridge discovery file:', error.message);
  }
}

function validateExtensionOrigin(origin) {
  return !!origin && ALLOWED_EXTENSION_ORIGINS.some((pattern) => pattern.test(origin));
}

function createBridgeRequestLogger(req, res, next) {
  const remoteAddress = req.socket?.remoteAddress || 'unknown';
  const safeBody = sanitizeLogBody(req.body);
  console.log(`🔌 [Bridge] ${req.method} ${req.url} from ${remoteAddress}`, safeBody);
  next();
}

function getSessionTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers['x-aura-safe-token'] || null;
}

function validateBridgeSession(req, res, next) {
  const token = getSessionTokenFromHeader(req);
  if (!token) {
    return sendBridgeError(res, 401, 'Missing authentication token');
  }

  if (token === EXTENSION_SECRET) {
    return next();
  }

  const session = BRIDGE_SESSION_TOKENS.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return sendBridgeError(res, 401, 'Invalid or expired session token');
  }

  req.bridgeSession = session;
  next();
}

async function createBridgeServer() {
  try {
    bridgePort = await getAvailableLocalPort(BRIDGE_PORT_RANGE_START, BRIDGE_PORT_RANGE_END);
    bridgeApp = express();
    bridgeApp.use(express.json({ limit: '512kb' }));
    bridgeApp.use(createBridgeRequestLogger);
    bridgeApp.use(rateLimit);

    bridgeApp.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && !validateExtensionOrigin(origin)) {
        return sendBridgeError(res, 403, 'Origin not allowed');
      }
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', 'null');
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Aura-Safe-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    bridgeApp.use((req, res, next) => {
      const remoteAddress = req.socket.remoteAddress;
      if (!isLoopbackAddress(remoteAddress)) {
        return sendBridgeError(res, 403, 'Connection must come from loopback interface');
      }
      next();
    });

    bridgeApp.get('/bridge/public', (req, res) => {
      res.json({ status: 'ok', app: 'AuraSafe', version: app.getVersion(), supportsHandshake: true });
    });

    bridgeApp.get('/bridge/info', (req, res) => {
      const origin = req.headers.origin;
      if (origin && !validateExtensionOrigin(origin)) {
        return sendBridgeError(res, 403, 'Origin not allowed');
      }
      res.json({
        status: 'ok',
        app: 'AuraSafe',
        version: app.getVersion(),
        supportsHandshake: true,
        originAllowlist: ['chrome-extension://', 'moz-extension://', 'edge-extension://'],
      });
    });

    bridgeApp.get('/bridge/health', (req, res) => {
      res.json({ status: 'ok', app: 'AuraSafe', version: app.getVersion(), uptime: process.uptime() });
    });

    bridgeApp.post('/bridge/handshake', (req, res) => {
      const origin = req.headers.origin;
      if (origin && !validateExtensionOrigin(origin)) {
        return sendBridgeError(res, 403, 'Handshake origin not allowed');
      }

      const sessionToken = uuidv4();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      BRIDGE_SESSION_TOKENS.set(sessionToken, {
        id: sessionToken,
        createdAt: Date.now(),
        expiresAt,
        origin: origin || null,
      });

      console.log('🔐 Created bridge session token for origin', origin);
      res.json({ status: 'ok', sessionToken, expiresAt, version: app.getVersion() });
    });

    bridgeApp.post('/bridge/command', validateBridgeSession, async (req, res) => {
      try {
        const result = await handleBridgeCommand(req.body);
        res.json({ status: 'ok', result });
      } catch (error) {
        console.error('❌ Bridge command failed:', error);
        sendBridgeError(res, 500, 'Bridge command failed', error.message);
      }
    });

    bridgeApp.use((err, req, res, next) => {
      console.error('❌ Bridge internal error:', err);
      sendBridgeError(res, 500, 'Internal bridge error', err.message);
    });

    bridgeServer = bridgeApp.listen(bridgePort, '127.0.0.1', () => {
      console.log(`🔐 Local bridge server listening on http://127.0.0.1:${bridgePort}`);
      writeBridgeInfoFile();
    });
  } catch (err) {
    console.error('❌ Failed to create local bridge server:', err);
    bridgePort = null;
    bridgeServer = null;
  }
}

async function handleBridgeCommand(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Missing command payload');
  }

  const action = body.action;
  const currentUser = userService.getCurrentUser();
  const db = await getDatabase();

  switch (action) {
    case 'getUserSettings': {
      const rows = await db.all('SELECT key, value FROM user_settings WHERE user_id = ?', [currentUser.id]);
      return rows;
    }
    case 'saveUserSetting': {
      const { key, value } = body;
      if (!key) throw new Error('Missing key');
      await db.run(
        'INSERT OR REPLACE INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [currentUser.id, key, value]
      );
      return { key, value };
    }
    case 'getTransactions': {
      return await db.all('SELECT * FROM transactions WHERE user_id = ?', [currentUser.id]);
    }
    case 'saveTransaction': {
      const transaction = body.transaction;
      if (!transaction || !transaction.account_id || typeof transaction.amount !== 'number') {
        throw new Error('Invalid transaction payload');
      }
      if (transaction.id) {
        await db.run(
          `UPDATE transactions SET account_id = ?, date = ?, description = ?, amount = ?, category_id = ?, payee = ?, memo = ?, is_cleared = ? WHERE id = ?`,
          [
            transaction.account_id,
            transaction.date,
            transaction.description,
            transaction.amount,
            transaction.category_id,
            transaction.payee,
            transaction.memo,
            transaction.is_cleared ? 1 : 0,
            transaction.id,
          ]
        );
        return { updated: transaction.id };
      }
      const result = await db.run(
        `INSERT INTO transactions (account_id, user_id, date, description, amount, category_id, payee, memo, is_cleared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.account_id,
          currentUser.id,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.category_id,
          transaction.payee,
          transaction.memo,
          transaction.is_cleared ? 1 : 0,
        ]
      );
      return { insertedId: result.lastID };
    }
    case 'getCategories': {
      return await db.all('SELECT * FROM categories WHERE user_id = ?', [currentUser.id]);
    }
    case 'getAccounts': {
      return await db.all('SELECT * FROM accounts WHERE user_id = ?', [currentUser.id]);
    }
    case 'ping': {
      return { status: 'ok', version: app.getVersion(), uptime: process.uptime() };
    }
    case 'getVaultEntries': {
      if (!isUnlocked()) throw new Error('Vault locked');
      return loadVaultEntries();
    }
    case 'saveVaultEntry': {
      if (!isUnlocked()) throw new Error('Vault locked');
      const entry = body.entry;
      if (!entry || !entry.id) throw new Error('Invalid entry payload');
      const entries = loadVaultEntries();
      const index = entries.findIndex((e) => e.id === entry.id);
      if (index !== -1) entries[index] = { ...entries[index], ...entry };
      else entries.push(entry);
      saveVaultEntries(entries);
      if (await isAutoSyncEnabled()) {
        try {
          await pushToIPFS();
        } catch (err) {
          console.error('Auto-sync failed:', err);
        }
      }
      return { saved: entry.id };
    }
    case 'queueAutofill': {
      const { entry, url } = body;
      if (!isUnlocked()) throw new Error('Vault locked');
      if (!entry || !entry.id) throw new Error('Invalid autofill entry');
      pendingAutofillRequest = {
        entry,
        url: typeof url === 'string' ? url : entry.url || '',
        createdAt: Date.now(),
      };
      return { queued: true, entryId: entry.id };
    }
    case 'getPendingAutofill': {
      if (!pendingAutofillRequest) return null;
      const age = Date.now() - pendingAutofillRequest.createdAt;
      if (age > 2 * 60 * 1000) {
        pendingAutofillRequest = null;
        return null;
      }
      return pendingAutofillRequest;
    }
    case 'consumePendingAutofill': {
      const request = pendingAutofillRequest;
      pendingAutofillRequest = null;
      return request;
    }
    default:
      throw new Error(`Unsupported bridge action: ${action}`);
  }
}

// ========== User service (simplified) ==========
const userService = {
  getCurrentUser() {
    return { id: 2, username: 'demo' };
  },
};

// ========== Inject base tag helper ==========
function injectBaseTag(html) {
  if (/<base\s+href/i.test(html)) return html;
  const baseTag = '<base href="/">';
  const headRegex = /<head[^>]*>/i;
  if (headRegex.test(html)) {
    return html.replace(headRegex, (match) => match + baseTag);
  }
  const bodyRegex = /<body[^>]*>/i;
  if (bodyRegex.test(html)) {
    return html.replace(bodyRegex, (match) => baseTag + match);
  }
  return baseTag + html;
}

// ========== WebSocket server for browser extension ==========
function startWebSocketServer() {
  try {
    try {
      wsServer = new WebSocketServer({
        port: 8765,
        host: '127.0.0.1',
      });
      wsServer.on('error', (err) => {
        console.warn('WS server error (ignored):', err.message);
      });

      wsServer.on('listening', () => {
        console.log('🔌 WebSocket server running on 8765');
      });

      wsServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log('⚠️ WebSocket already running, skipping');
        } else {
          console.error('WebSocket error:', err);
        }
      });
    } catch (err) {
      console.error('❌ Failed to start WebSocket:', err);
    }
    console.log('🔌 WebSocket server listening on port 8765');

    wsServer.on('connection', (ws, req) => {
      const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
      if (token !== EXTENSION_SECRET) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          const { action, id, entry } = data;

          if (action === 'getEntries') {
            if (!isUnlocked()) {
              ws.send(JSON.stringify({ error: 'Vault locked' }));
              return;
            }
            const entries = loadVaultEntries();
            ws.send(JSON.stringify({ type: 'entries', entries }));
          } else if (action === 'getEntry') {
            if (!isUnlocked()) {
              ws.send(JSON.stringify({ error: 'Vault locked' }));
              return;
            }
            const entries = loadVaultEntries();
            const found = entries.find(e => e.id === id);
            ws.send(JSON.stringify({ type: 'entry', entry: found || null }));
          } else if (action === 'saveEntry') {
            if (!isUnlocked()) {
              ws.send(JSON.stringify({ error: 'Vault locked' }));
              return;
            }
            const entries = loadVaultEntries();
            const index = entries.findIndex(e => e.id === entry.id);
            if (index !== -1) entries[index] = { ...entries[index], ...entry };
            else entries.push(entry);
            saveVaultEntries(entries);
            ws.send(JSON.stringify({ type: 'saved', id: entry.id }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ error: err.message }));
        }
      });
    });
  } catch (err) {
    console.error('❌ Failed to start WebSocket server:', err);
  }
}

// ========== Create window ==========
function createWindow(url) {
  console.log('🪟 Creating BrowserWindow...');
  console.log('🌍 URL:', url);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    x: 100,
    y: 100,
    show: true,
    backgroundColor: '#111111',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: true,
    },
  });

  mainWindow.center();

  mainWindow.on('ready-to-show', () => {
    console.log('✅ ready-to-show');
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('show', () => {
    console.log('✅ window shown');
  });

  mainWindow.on('closed', () => {
    console.log('❌ window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-start-loading', () => {
    console.log('🔄 did-start-loading');
  });

  mainWindow.webContents.on('did-stop-loading', () => {
    console.log('✅ did-stop-loading');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ did-fail-load');
    console.error(errorCode, errorDescription);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ render-process-gone');
    console.error(details);
  });

  mainWindow.webContents.openDevTools({
    mode: 'detach',
  });

  mainWindow.loadURL(url)
    .then(() => {
      console.log('✅ loadURL success');
    })
    .catch((err) => {
      console.error('❌ loadURL failed');
      console.error(err);
    });
}

// ========== App ready ==========
app.whenReady().then(async () => {
  let outPath;

  if (app.isPackaged) {
    outPath = path.join(process.resourcesPath, 'out');
    if (!fs.existsSync(outPath)) {
      outPath = path.join(path.dirname(app.getPath('exe')), '../Resources/out');
    }
  } else {
    outPath = path.join(__dirname, '../../out');
  }

  console.log('📦 Environment:', app.isPackaged ? 'production' : 'development');
  console.log('📂 outPath:', outPath);
  console.log('📂 outPath exists:', fs.existsSync(outPath));

  const indexPath = path.join(outPath, 'index.html');
  const nextPath = path.join(outPath, '_next');

  console.log('📄 index.html exists:', fs.existsSync(indexPath));
  console.log('📁 _next exists:', fs.existsSync(nextPath));

  if (!fs.existsSync(indexPath)) {
    console.error('❌ CRITICAL: index.html not found at:', indexPath);
  }

  console.log('✅ App ready');
  console.log('📁 Preload path:', preloadPath);
  console.log('📁 Preload exists?', fs.existsSync(preloadPath));

  try {
    await initDatabase();
    await createBridgeServer();
  } catch (err) {
    console.error('❌ Startup failed:', err);
    app.quit();
    return;
  }

  // ========== IPC Handlers ==========
  ipcMain.handle('vault:isInitialized', async () => {
    const vaultStore = new Store({ name: 'vault' });
    return !!vaultStore.get('masterSalt');
  });

  ipcMain.handle('vault:isUnlocked', () => isUnlocked());

  ipcMain.handle('vault:unlock', async (event, password) => {
    const success = await unlockVault(password);
    if (success) return { success: true, entries: loadVaultEntries() };
    return { success: false };
  });
  // ========== SIMPLIFIED BACKUP HANDLERS ==========

  ipcMain.handle('backup:init-temp', async () => {
    console.log('[Backup] init-temp called');
    return { success: true };
  });

  ipcMain.handle('backup:import-file-pre-vault', async () => {
    console.log('[Backup] import-file-pre-vault called');
    const { dialog } = require('electron');
    const fs = require('fs');

    const result = await dialog.showOpenDialog({
      title: 'Import Vault Backup',
      filters: [
        { name: 'AuraSafe Backup', extensions: ['aura'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, cancelled: true };
    }

    const filePath = result.filePaths[0];

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const backupContainer = JSON.parse(fileContent);

      if (backupContainer.version !== '1.0') {
        throw new Error(`Incompatible backup version: ${backupContainer.version}`);
      }

      console.log('[Backup] Import successful, entries:', backupContainer.data?.entries?.length || 0);

      return {
        success: true,
        backupData: backupContainer,
        filePath: filePath
      };
    } catch (error) {
      console.error('[Backup] Import failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:icloud-restore-pre-vault', async () => {
    console.log('[Backup] icloud-restore-pre-vault called');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const iCloudBackupDir = path.join(
      os.homedir(),
      'Library',
      'Mobile Documents',
      'com~apple~CloudDocs',
      'AuraSafe Backups'
    );

    if (!fs.existsSync(iCloudBackupDir)) {
      return { success: false, error: 'No iCloud backups found. Please ensure iCloud Drive is enabled.' };
    }

    const backupFiles = fs.readdirSync(iCloudBackupDir)
      .filter(f => f.endsWith('.aura'))
      .map(f => ({
        path: path.join(iCloudBackupDir, f),
        name: f,
        modified: fs.statSync(path.join(iCloudBackupDir, f)).mtime
      }))
      .sort((a, b) => b.modified - a.modified);

    if (backupFiles.length === 0) {
      return { success: false, error: 'No backup files found in iCloud' };
    }

    const latestBackup = backupFiles[0];
    const fileContent = fs.readFileSync(latestBackup.path, 'utf-8');
    const backupContainer = JSON.parse(fileContent);

    return {
      success: true,
      backupData: backupContainer,
      backupDate: backupContainer.timestamp
    };
  });

  ipcMain.handle('backup:export', async (event, vaultData) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const crypto = require('crypto');

    const result = await dialog.showSaveDialog({
      title: 'Export Vault Backup',
      defaultPath: `AuraSafe_Backup_${Date.now()}.aura`,
      filters: [
        { name: 'AuraSafe Backup', extensions: ['aura'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, cancelled: true };
    }

    const filePath = result.filePath;

    try {
      const backupContainer = {
        version: '1.0',
        timestamp: Date.now(),
        data: vaultData,
        checksum: null
      };

      const backupString = JSON.stringify(backupContainer.data);
      backupContainer.checksum = crypto
        .createHash('sha256')
        .update(backupString)
        .digest('hex');

      fs.writeFileSync(filePath, JSON.stringify(backupContainer, null, 2));

      return { success: true, filePath };
    } catch (error) {
      console.error('[Backup] Export failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:find-local', async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const documentsPath = path.join(os.homedir(), 'Documents');
    const backupsDir = path.join(documentsPath, 'AuraSafe Backups');

    if (!fs.existsSync(backupsDir)) {
      return [];
    }

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.aura'))
      .map(f => ({
        name: f,
        path: path.join(backupsDir, f),
        modified: fs.statSync(path.join(backupsDir, f)).mtime
      }))
      .sort((a, b) => b.modified - a.modified);

    return files;
  });

  // Placeholder for other backup methods
  ipcMain.handle('backup:import', async () => {
    return { success: false, error: 'Use import-file-pre-vault for pre-vault import' };
  });

  ipcMain.handle('backup:icloud:available', async () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const iCloudPath = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
    return fs.existsSync(iCloudPath);
  });

  ipcMain.handle('backup:icloud:backup', async (event, vaultData) => {
    return { success: false, error: 'iCloud backup not configured yet' };
  });

  ipcMain.handle('backup:icloud:restore', async () => {
    return { success: false, error: 'iCloud restore not configured yet' };
  });
  ipcMain.handle('vault:init', async (event, masterPassword) => {
    try {
      await initVault(masterPassword);
      return true;
    } catch (err) {
      console.error('init vault error:', err);
      return false;
    }
  });

  ipcMain.handle('vault:lock', () => {
    lockVault();
    return true;
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

  ipcMain.handle('autofill', async (event, data) => {
    if (!isUnlocked()) throw new Error('Vault locked');
    const response = await handleBridgeCommand({ action: 'queueAutofill', entry: data.entry, url: data.url });
    return response;
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

  ipcMain.handle('get-user-setting', async (event, key, defaultValue) => {
    const currentUser = userService.getCurrentUser();
    if (!currentUser) return { success: true, data: defaultValue };
    const db = await getDatabase();
    const row = await db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = ?`, [currentUser.id, key]);
    return { success: true, data: row ? row.value : defaultValue };
  });

  ipcMain.handle('save-user-setting', async (event, key, value) => {
    const currentUser = userService.getCurrentUser();
    if (!currentUser) return { success: false, error: 'Not logged in' };
    const db = await getDatabase();
    await db.run(`INSERT OR REPLACE INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))`, [currentUser.id, key, value]);
    return { success: true };
  });

  ipcMain.handle('ping', () => 'pong from main process');

  // ========== Serve the app ==========
  if (isDev) {
    createWindow('http://localhost:3000');
  } else {
    const appServer = express();

    appServer.use((req, res, next) => {
      console.log(`📡 ${req.method} ${req.url}`);
      next();
    });

    if (fs.existsSync(outPath)) {
      appServer.use(express.static(outPath));
      console.log('✅ Static files being served from:', outPath);
    } else {
      console.error('❌ Cannot serve static files - outPath missing:', outPath);
    }

    appServer.get('*', (req, res) => {
      const indexPath = path.join(outPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.error('❌ index.html not found at:', indexPath);
        return res.status(404).send(`index.html not found at ${indexPath}`);
      }
      console.log('📄 Serving index.html for:', req.path);
      let html = fs.readFileSync(indexPath, 'utf-8');
      if (!/<base\s+href/i.test(html)) {
        html = html.replace('<head>', '<head><base href="/">');
      }
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });

    server = appServer.listen(0, () => {
      const port = server.address().port;
      const url = `http://localhost:${port}`;
      console.log(`📡 HTTP server running at ${url}`);
      console.log(`📁 Serving from: ${outPath}`);
      createWindow(url);
    });

    startWebSocketServer();
  }
});

// ========== App events ==========
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('Recreate window not implemented – restart the app');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
  if (wsServer) wsServer.close();
  if (bridgeServer) {
    bridgeServer.close(() => {
      removeBridgeInfoFile();
    });
  } else {
    removeBridgeInfoFile();
  }
  if (db && typeof db.close === 'function') db.close();
});