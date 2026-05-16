import { secureGet, secureRemove, secureSet } from '../storage/secureStore.js';

const VAULT_CACHE_KEY = 'offlineVaultMetadata.v1';
const SYNC_QUEUE_KEY = 'syncQueue.v1';
const MAX_QUEUE_ITEMS = 100;

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const {
    password,
    passphrase,
    secret,
    token,
    recoveryCode,
    otpSecret,
    notes,
    ...metadata
  } = entry;
  return {
    ...metadata,
    cachedAt: Date.now(),
    offlineOnly: true,
    fillAvailable: false,
  };
}

export async function cacheVaultMetadata(entries) {
  const sanitized = (entries || []).map(sanitizeEntry).filter(Boolean);
  const snapshot = {
    version: 1,
    cachedAt: Date.now(),
    entries: sanitized,
  };
  await secureSet(VAULT_CACHE_KEY, snapshot);
  return snapshot;
}

export async function getCachedVaultMetadata() {
  return (await secureGet(VAULT_CACHE_KEY)) || {
    version: 1,
    cachedAt: null,
    entries: [],
  };
}

export async function clearCachedVaultMetadata() {
  await secureRemove(VAULT_CACHE_KEY);
}

export async function enqueueSyncOperation(operation) {
  const current = (await secureGet(SYNC_QUEUE_KEY)) || [];
  const next = [
    ...current,
    {
      ...operation,
      id: operation.id || crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'pending',
    },
  ].slice(-MAX_QUEUE_ITEMS);
  await secureSet(SYNC_QUEUE_KEY, next);
  return next;
}

export async function getSyncQueue() {
  return (await secureGet(SYNC_QUEUE_KEY)) || [];
}

export async function clearSyncQueue() {
  await secureRemove(SYNC_QUEUE_KEY);
}

export async function getOfflineState() {
  const [cache, queue] = await Promise.all([
    getCachedVaultMetadata(),
    getSyncQueue(),
  ]);
  return {
    cacheAvailable: cache.entries.length > 0,
    cachedAt: cache.cachedAt,
    cachedEntryCount: cache.entries.length,
    pendingSyncCount: queue.filter((item) => item.status === 'pending').length,
  };
}
