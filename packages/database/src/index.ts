import type { SyncQueueItem, VaultMetadata, VaultPersistedState } from '@aurasafe/types';

export const VAULT_STATE_KEY = 'aurasafe.vault.state';
export const SYNC_QUEUE_KEY = 'aurasafe.sync.queue';
export const SETTINGS_KEY = 'aurasafe.settings';

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
];

export interface VaultRepository {
  loadVaultState(): Promise<VaultPersistedState>;
  saveVaultState(state: VaultPersistedState): Promise<void>;
  getMetadata(): Promise<VaultMetadata | null>;
  enqueueSync(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>): Promise<SyncQueueItem>;
  listSyncQueue(): Promise<SyncQueueItem[]>;
  updateSyncItem(item: SyncQueueItem): Promise<void>;
  clearSyncQueue(): Promise<void>;
}

export function parseSyncQueueRow(row: Record<string, unknown>): SyncQueueItem {
  return {
    id: String(row.id),
    action: String(row.action),
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
    createdAt: Number(row.created_at),
    status: row.status as SyncQueueItem['status'],
    retryCount: Number(row.retry_count ?? 0),
    lastError: row.last_error ? String(row.last_error) : undefined,
  };
}
