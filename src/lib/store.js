// src/lib/store.js
import { openDB } from 'idb';
import {
  getVaultEntries,
  saveVaultEntry,
  deleteVaultEntry,
} from './api-client';

let db = null;
let cache = null;

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
  return await db.getAll('entries');
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

// ===== LOAD =====
export async function loadVault() {
  if (cache) return cache;

  const local = await loadFromIndexedDB();
  if (local?.length) {
    cache = local;
    return cache;
  }

  const remote = await getVaultEntries();
  cache = remote || [];

  await saveToIndexedDB(cache);
  return cache;
}

// ===== ADD =====
export async function addEntry(entry) {
  const saved = await saveVaultEntry(entry);

  cache = cache ? [...cache, saved] : [saved];
  await saveToIndexedDB(cache);

  return saved;
}

// ===== UPDATE =====
export async function updateEntry(id, entry) {
  const saved = await saveVaultEntry({ ...entry, id });

  cache = (cache || []).map(e => (e.id === id ? saved : e));
  await saveToIndexedDB(cache);

  return saved;
}

// ===== DELETE =====
export async function deleteEntry(id) {
  await deleteVaultEntry(id);

  cache = (cache || []).filter(e => e.id !== id);
  await saveToIndexedDB(cache);
}

// ===== PUBLIC API =====
export async function getEntries() {
  return loadVault();
}

export async function saveEntries(entries) {
  cache = entries;
  await saveToIndexedDB(entries);
}