import * as SecureStore from 'expo-secure-store';
import type { VaultPayload } from '@aurasafe/types';

const PENDING_RESTORE_KEY = 'aurasafe.pendingRestore.v1';
const PENDING_RESTORE_META_KEY = 'aurasafe.pendingRestoreMeta.v1';

export interface PendingRestoreMeta {
  entriesCount: number;
  fileName: string;
  importedAt: number;
  encrypted: boolean;
}

export async function savePendingRestore(payload: VaultPayload, meta: Omit<PendingRestoreMeta, 'importedAt'>) {
  await SecureStore.setItemAsync(PENDING_RESTORE_KEY, JSON.stringify(payload));
  await SecureStore.setItemAsync(
    PENDING_RESTORE_META_KEY,
    JSON.stringify({ ...meta, importedAt: Date.now() }),
  );
}

export async function getPendingRestore(): Promise<VaultPayload | null> {
  const raw = await SecureStore.getItemAsync(PENDING_RESTORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultPayload;
  } catch {
    return null;
  }
}

export async function getPendingRestoreMeta(): Promise<PendingRestoreMeta | null> {
  const raw = await SecureStore.getItemAsync(PENDING_RESTORE_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRestoreMeta;
  } catch {
    return null;
  }
}

export async function clearPendingRestore() {
  await SecureStore.deleteItemAsync(PENDING_RESTORE_KEY);
  await SecureStore.deleteItemAsync(PENDING_RESTORE_META_KEY);
}
