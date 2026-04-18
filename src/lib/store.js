// src/lib/store.js
// AuraSafe Local Storage Manager - IndexedDB caching layer
// Version: 1.0.0

// ===================== IMPORTS =====================

import { openDB } from 'idb';
import {
  getVaultEntries,
  saveVaultEntry,
  deleteVaultEntry,
} from './api-client';

// ===================== CONFIGURATION =====================

const DB_CONFIG = {
  NAME: 'aurasafe',
  VERSION: 2,
  STORES: {
    ENTRIES: 'entries',
    METADATA: 'metadata',
    SYNC_STATE: 'syncState',
  },
};

const CACHE_CONFIG = {
  TTL: 300000, // 5 minutes cache TTL
  MAX_ENTRIES: 1000,
};

// ===================== STATE MANAGEMENT =====================

let db = null;
let cache = null;
let cacheTimestamp = null;
let syncInProgress = false;
let pendingWrites = new Map();

// ===================== DATABASE INITIALIZATION =====================

/**
 * Initialize IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
  if (db) return db;

  try {
    db = await openDB(DB_CONFIG.NAME, DB_CONFIG.VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[Store] Upgrading database from version ${oldVersion} to ${newVersion}`);
        
        // Create entries store
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.ENTRIES)) {
          const entriesStore = db.createObjectStore(DB_CONFIG.STORES.ENTRIES, { 
            keyPath: 'id' 
          });
          entriesStore.createIndex('type', 'type', { unique: false });
          entriesStore.createIndex('title', 'title', { unique: false });
          entriesStore.createIndex('updated_at', 'updated_at', { unique: false });
          entriesStore.createIndex('created_at', 'created_at', { unique: false });
          console.log('[Store] Created entries store with indexes');
        }
        
        // Create metadata store (for version info, last sync, etc.)
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.METADATA)) {
          db.createObjectStore(DB_CONFIG.STORES.METADATA, { keyPath: 'key' });
          console.log('[Store] Created metadata store');
        }
        
        // Create sync state store
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SYNC_STATE)) {
          db.createObjectStore(DB_CONFIG.STORES.SYNC_STATE, { keyPath: 'id' });
          console.log('[Store] Created sync state store');
        }
        
        // Handle upgrades from older versions
        if (oldVersion < 2) {
          // Add any migration logic here
          console.log('[Store] Migrating data to version 2');
        }
      },
    });
    
    // Initialize metadata if needed
    await initMetadata();
    
    console.log('[Store] Database initialized successfully');
    return db;
  } catch (error) {
    console.error('[Store] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Initialize metadata store with default values
 */
async function initMetadata() {
  const dbInstance = await getDB();
  const tx = dbInstance.transaction(DB_CONFIG.STORES.METADATA, 'readwrite');
  const store = tx.objectStore(DB_CONFIG.STORES.METADATA);
  
  const existing = await store.get('version');
  if (!existing) {
    await store.put({ key: 'version', value: DB_CONFIG.VERSION });
    await store.put({ key: 'lastSync', value: null });
    await store.put({ key: 'entryCount', value: 0 });
    await store.put({ key: 'cacheVersion', value: Date.now() });
  }
  
  await tx.done;
}

/**
 * Update metadata value
 * @param {string} key - Metadata key
 * @param {any} value - Metadata value
 */
async function updateMetadata(key, value) {
  try {
    const dbInstance = await getDB();
    const tx = dbInstance.transaction(DB_CONFIG.STORES.METADATA, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.STORES.METADATA);
    await store.put({ key, value });
    await tx.done;
  } catch (error) {
    console.error(`[Store] Failed to update metadata ${key}:`, error);
  }
}

/**
 * Get metadata value
 * @param {string} key - Metadata key
 * @returns {Promise<any>}
 */
async function getMetadata(key) {
  try {
    const dbInstance = await getDB();
    const tx = dbInstance.transaction(DB_CONFIG.STORES.METADATA, 'readonly');
    const store = tx.objectStore(DB_CONFIG.STORES.METADATA);
    const result = await store.get(key);
    await tx.done;
    return result?.value;
  } catch (error) {
    console.error(`[Store] Failed to get metadata ${key}:`, error);
    return null;
  }
}

// ===================== CACHE MANAGEMENT =====================

/**
 * Check if cache is valid
 * @returns {boolean}
 */
function isCacheValid() {
  if (!cache || !cacheTimestamp) return false;
  return (Date.now() - cacheTimestamp) < CACHE_CONFIG.TTL;
}

/**
 * Invalidate cache
 */
function invalidateCache() {
  cache = null;
  cacheTimestamp = null;
  console.log('[Store] Cache invalidated');
}

/**
 * Update cache with new entries
 * @param {Array} entries - Entries to cache
 */
async function updateCache(entries) {
  cache = entries;
  cacheTimestamp = Date.now();
  await updateMetadata('entryCount', entries?.length || 0);
  await updateMetadata('cacheVersion', cacheTimestamp);
}

// ===================== INDEXEDDB OPERATIONS =====================

/**
 * Load all entries from IndexedDB
 * @returns {Promise<Array>}
 */
async function loadFromIndexedDB() {
  try {
    const dbInstance = await getDB();
    const entries = await dbInstance.getAll(DB_CONFIG.STORES.ENTRIES);
    console.log(`[Store] Loaded ${entries.length} entries from IndexedDB`);
    return entries;
  } catch (error) {
    console.error('[Store] Failed to load from IndexedDB:', error);
    return [];
  }
}

/**
 * Save entries to IndexedDB
 * @param {Array} entries - Entries to save
 */
async function saveToIndexedDB(entries) {
  if (!entries || entries.length === 0) return;
  
  try {
    const dbInstance = await getDB();
    const tx = dbInstance.transaction(DB_CONFIG.STORES.ENTRIES, 'readwrite');
    const store = tx.objectStore(DB_CONFIG.STORES.ENTRIES);
    
    // Clear existing entries
    await store.clear();
    
    // Add new entries
    for (const entry of entries) {
      await store.put(entry);
    }
    
    await tx.done;
    console.log(`[Store] Saved ${entries.length} entries to IndexedDB`);
  } catch (error) {
    console.error('[Store] Failed to save to IndexedDB:', error);
    throw error;
  }
}

/**
 * Get a single entry from IndexedDB by ID
 * @param {string} id - Entry ID
 * @returns {Promise<Object|null>}
 */
async function getEntryFromIndexedDB(id) {
  try {
    const dbInstance = await getDB();
    const entry = await dbInstance.get(DB_CONFIG.STORES.ENTRIES, id);
    return entry || null;
  } catch (error) {
    console.error(`[Store] Failed to get entry ${id} from IndexedDB:`, error);
    return null;
  }
}

/**
 * Query entries by type from IndexedDB
 * @param {string} type - Entry type (credential, contact, etc.)
 * @returns {Promise<Array>}
 */
async function queryEntriesByType(type) {
  try {
    const dbInstance = await getDB();
    const index = dbInstance.transaction(DB_CONFIG.STORES.ENTRIES).store.index('type');
    const entries = await index.getAll(type);
    return entries;
  } catch (error) {
    console.error(`[Store] Failed to query entries by type ${type}:`, error);
    return [];
  }
}

/**
 * Search entries by title
 * @param {string} query - Search query
 * @returns {Promise<Array>}
 */
async function searchEntries(query) {
  try {
    const allEntries = await loadFromIndexedDB();
    const lowerQuery = query.toLowerCase();
    return allEntries.filter(entry => 
      entry.title?.toLowerCase().includes(lowerQuery) ||
      entry.username?.toLowerCase().includes(lowerQuery) ||
      entry.url?.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    console.error('[Store] Failed to search entries:', error);
    return [];
  }
}

// ===================== SYNC MANAGEMENT =====================

/**
 * Sync vault with remote source
 * @returns {Promise<Object>}
 */
async function syncVault() {
  if (syncInProgress) {
    console.log('[Store] Sync already in progress, skipping');
    return { success: false, reason: 'Sync in progress' };
  }
  
  syncInProgress = true;
  
  try {
    console.log('[Store] Starting vault sync...');
    
    // Get remote entries
    const remoteEntries = await getVaultEntries();
    
    if (!remoteEntries || remoteEntries.length === 0) {
      console.log('[Store] No remote entries found');
      return { success: true, synced: 0 };
    }
    
    // Save to IndexedDB and cache
    await saveToIndexedDB(remoteEntries);
    await updateCache(remoteEntries);
    await updateMetadata('lastSync', Date.now());
    
    console.log(`[Store] Sync completed: ${remoteEntries.length} entries synced`);
    return { success: true, synced: remoteEntries.length };
  } catch (error) {
    console.error('[Store] Sync failed:', error);
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

// ===================== PUBLIC API =====================

/**
 * Load vault entries with caching
 * @param {boolean} forceRefresh - Force refresh from remote
 * @returns {Promise<Array>}
 */
export async function loadVault(forceRefresh = false) {
  try {
    // Return cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      console.log('[Store] Returning cached entries');
      return cache;
    }
    
    // Try IndexedDB first
    const local = await loadFromIndexedDB();
    if (local && local.length > 0 && !forceRefresh) {
      console.log('[Store] Returning entries from IndexedDB');
      await updateCache(local);
      return local;
    }
    
    // Fallback to remote
    console.log('[Store] Loading from remote source');
    const remote = await getVaultEntries();
    const entries = remote || [];
    
    // Update cache and IndexedDB
    await updateCache(entries);
    await saveToIndexedDB(entries);
    
    return entries;
  } catch (error) {
    console.error('[Store] Failed to load vault:', error);
    return cache || [];
  }
}

/**
 * Add a new entry
 * @param {Object} entry - Entry to add
 * @returns {Promise<Object>}
 */
export async function addEntry(entry) {
  try {
    if (!entry) throw new Error('No entry provided');
    
    const saved = await saveVaultEntry(entry);
    
    // Update cache
    const currentCache = cache || [];
    await updateCache([...currentCache, saved]);
    
    // Update IndexedDB
    await saveToIndexedDB([...currentCache, saved]);
    
    console.log(`[Store] Added entry: ${saved.id}`);
    return saved;
  } catch (error) {
    console.error('[Store] Failed to add entry:', error);
    throw error;
  }
}

/**
 * Update an existing entry
 * @param {string} id - Entry ID
 * @param {Object} entry - Updated entry data
 * @returns {Promise<Object>}
 */
export async function updateEntry(id, entry) {
  try {
    if (!id) throw new Error('No entry ID provided');
    
    const saved = await saveVaultEntry({ ...entry, id });
    
    // Update cache
    const currentCache = cache || [];
    await updateCache(currentCache.map(e => (e.id === id ? saved : e)));
    
    // Update IndexedDB
    await saveToIndexedDB(currentCache.map(e => (e.id === id ? saved : e)));
    
    console.log(`[Store] Updated entry: ${id}`);
    return saved;
  } catch (error) {
    console.error('[Store] Failed to update entry:', error);
    throw error;
  }
}

/**
 * Delete an entry
 * @param {string} id - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  try {
    if (!id) throw new Error('No entry ID provided');
    
    await deleteVaultEntry(id);
    
    // Update cache
    const currentCache = cache || [];
    await updateCache(currentCache.filter(e => e.id !== id));
    
    // Update IndexedDB
    await saveToIndexedDB(currentCache.filter(e => e.id !== id));
    
    console.log(`[Store] Deleted entry: ${id}`);
  } catch (error) {
    console.error('[Store] Failed to delete entry:', error);
    throw error;
  }
}

/**
 * Get all entries (alias for loadVault)
 * @returns {Promise<Array>}
 */
export async function getEntries() {
  return loadVault();
}

/**
 * Save multiple entries at once
 * @param {Array} entries - Entries to save
 * @returns {Promise<void>}
 */
export async function saveEntries(entries) {
  try {
    if (!Array.isArray(entries)) {
      throw new Error('Entries must be an array');
    }
    
    await updateCache(entries);
    await saveToIndexedDB(entries);
    console.log(`[Store] Saved ${entries.length} entries`);
  } catch (error) {
    console.error('[Store] Failed to save entries:', error);
    throw error;
  }
}

/**
 * Clear all local data
 * @returns {Promise<void>}
 */
export async function clearLocalData() {
  try {
    const dbInstance = await getDB();
    
    // Clear all stores
    const tx = dbInstance.transaction(
      [DB_CONFIG.STORES.ENTRIES, DB_CONFIG.STORES.METADATA, DB_CONFIG.STORES.SYNC_STATE],
      'readwrite'
    );
    
    await tx.objectStore(DB_CONFIG.STORES.ENTRIES).clear();
    await tx.objectStore(DB_CONFIG.STORES.METADATA).clear();
    await tx.objectStore(DB_CONFIG.STORES.SYNC_STATE).clear();
    await tx.done;
    
    // Reset cache
    invalidateCache();
    
    // Re-initialize metadata
    await initMetadata();
    
    console.log('[Store] Cleared all local data');
  } catch (error) {
    console.error('[Store] Failed to clear local data:', error);
    throw error;
  }
}

/**
 * Get vault statistics
 * @returns {Promise<Object>}
 */
export async function getVaultStats() {
  try {
    const entries = await loadVault();
    const lastSync = await getMetadata('lastSync');
    const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : null;
    
    // Count by type
    const typeCounts = {};
    for (const entry of entries) {
      const type = entry.type || 'credential';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    return {
      totalEntries: entries.length,
      typeCounts,
      lastSync,
      cacheAge,
      cacheValid: isCacheValid(),
      dbVersion: DB_CONFIG.VERSION,
    };
  } catch (error) {
    console.error('[Store] Failed to get vault stats:', error);
    return { totalEntries: 0, typeCounts: {} };
  }
}

/**
 * Force sync vault with remote
 * @returns {Promise<Object>}
 */
export async function forceSync() {
  invalidateCache();
  return syncVault();
}

// ===================== EXPORTS =====================

export default {
  loadVault,
  addEntry,
  updateEntry,
  deleteEntry,
  getEntries,
  saveEntries,
  clearLocalData,
  getVaultStats,
  forceSync,
  queryEntriesByType,
  searchEntries,
  getEntryFromIndexedDB,
};