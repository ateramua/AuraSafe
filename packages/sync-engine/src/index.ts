import { sanitizeOfflineEntry } from '@aurasafe/domain';
import type { SyncQueueItem, VaultEntry } from '@aurasafe/types';
import type { VaultRepository } from '@aurasafe/database';

export interface SyncTransport {
  push(entries: VaultEntry[]): Promise<{ cid?: string }>;
  pull(cid: string): Promise<VaultEntry[]>;
}

export interface SyncEngineOptions {
  repository: VaultRepository;
  transport?: SyncTransport;
  maxRetries?: number;
}

export class SyncEngine {
  private readonly maxRetries: number;

  constructor(private readonly options: SyncEngineOptions) {
    this.maxRetries = options.maxRetries ?? 5;
  }

  async enqueueSaveEntry(entry: VaultEntry): Promise<SyncQueueItem> {
    return this.options.repository.enqueueSync({
      action: 'saveVaultEntry',
      payload: { entry },
    });
  }

  async processQueue(): Promise<{ processed: number; failed: number }> {
    const queue = await this.options.repository.listSyncQueue();
    let processed = 0;
    let failed = 0;
    for (const item of queue.filter((q) => q.status === 'pending' || q.status === 'failed')) {
      try {
        await this.executeItem(item);
        item.status = 'completed';
        processed += 1;
      } catch (error) {
        item.retryCount += 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        item.status = item.retryCount >= this.maxRetries ? 'failed' : 'pending';
        failed += 1;
      }
      await this.options.repository.updateSyncItem(item);
    }
    return { processed, failed };
  }

  private async executeItem(item: SyncQueueItem): Promise<void> {
    if (!this.options.transport) {
      throw new Error('Sync transport not configured');
    }
    if (item.action === 'saveVaultEntry') {
      const entry = item.payload.entry as VaultEntry;
      await this.options.transport.push([entry]);
      return;
    }
    throw new Error(`Unknown sync action: ${item.action}`);
  }

  buildOfflineCache(entries: VaultEntry[]): VaultEntry[] {
    return entries.map(sanitizeOfflineEntry);
  }

  mergeEntries(local: VaultEntry[], remote: VaultEntry[]): VaultEntry[] {
    const map = new Map<string, VaultEntry>();
    for (const entry of local) map.set(entry.id, entry);
    for (const entry of remote) {
      const existing = map.get(entry.id);
      if (!existing || (entry.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(entry.id, entry);
      }
    }
    return [...map.values()];
  }
}
