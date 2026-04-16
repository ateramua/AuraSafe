// src/lib/store.js
import { openDB } from 'idb';
import { 
  getVaultEntries, 
  addVaultEntry, 
  updateVaultEntry, 
  deleteVaultEntry 
} from './api-client';

let db = null;
let cache = null; // in-memory cache for quick access

async function getDB() {
  if (db) return db;
  db = await openDB('password-manager', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' });
      }
    },
  });
  return db;
}

async function loadFromIndexedDB() {
  const db = await getDB();
  const entries = await db.getAll('entries');
  return entries;
}

async function saveToIndexedDB(entries) {
  const db = await getDB();
  const tx = db.transaction('entries', 'readwrite');
  const store = tx.objectStore('entries');
  await store.clear();
  for (const entry of entries) {
    await store.put(entry);
  }
  await tx.done;
}

export async function loadVault() {
  if (cache !== null) return cache;

  // First try IndexedDB
  const cached = await loadFromIndexedDB();
  if (cached.length > 0) {
    cache = cached;
    return cache;
  }

  // Otherwise load from remote (or mock) and cache
  const data = await getVaultEntries();
  cache = data;
  await saveToIndexedDB(data);
  return data;
}

export async function addEntry(entry) {
  const newEntry = await addVaultEntry(entry);
  cache = cache ? [...cache, newEntry] : [newEntry];
  await saveToIndexedDB(cache);
  return newEntry;
}

export async function updateEntry(id, updatedEntry) {
  await updateVaultEntry(id, updatedEntry);
  cache = cache.map(e => (e.id === id ? { ...e, ...updatedEntry } : e));
  await saveToIndexedDB(cache);
  return updatedEntry;
}

export async function deleteEntry(id) {
  await deleteVaultEntry(id);
  cache = cache.filter(e => e.id !== id);
  await saveToIndexedDB(cache);
}

// Additional exports that might be needed by other components
export async function getEntries() {
  return await loadVault();
}

export async function saveEntries(entries) {
  cache = entries;
  await saveToIndexedDB(entries);
}