// src/lib/api-client.js

const isElectron =
  typeof window !== 'undefined' && !!window.api;

// ===================== VAULT CRUD =====================

export async function getVaultEntries() {
  if (!isElectron) return [];
  if (!window.api?.getVaultEntries) {
    throw new Error('getVaultEntries is missing from preload API');
  }

  return await window.api.getVaultEntries();
}

export async function saveVaultEntry(entry) {
  if (!isElectron) return entry;
  if (!window.api?.saveVaultEntry) {
    throw new Error('saveVaultEntry is missing from preload API');
  }

  return await window.api.saveVaultEntry(entry);
}

export async function deleteVaultEntry(id) {
  if (!isElectron) return true;
  if (!window.api?.deleteVaultEntry) {
    throw new Error('deleteVaultEntry is missing from preload API');
  }

  return await window.api.deleteVaultEntry(id);
}

// ===================== COMPAT HELPERS =====================

export async function addVaultEntry(entry) {
  return saveVaultEntry(entry);
}

export async function updateVaultEntry(id, entry) {
  return saveVaultEntry({ ...entry, id });
}