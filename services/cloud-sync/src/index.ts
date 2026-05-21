import { SyncEngine, type SyncTransport } from '@aurasafe/sync-engine';
import type { VaultRepository } from '@aurasafe/database';
import type { VaultEntry } from '@aurasafe/types';

export interface CloudSyncConfig {
  endpoint?: string;
  apiKey?: string;
}

export class CloudSyncService {
  private engine: SyncEngine;

  constructor(repository: VaultRepository, transport?: SyncTransport) {
    this.engine = new SyncEngine({ repository, transport });
  }

  async pushVaultSnapshot(entries: VaultEntry[]) {
    if (!this.engine) throw new Error('Sync engine unavailable');
    for (const entry of entries) {
      await this.engine.enqueueSaveEntry(entry);
    }
    return this.engine.processQueue();
  }

  mergeWithRemote(local: VaultEntry[], remote: VaultEntry[]) {
    return this.engine.mergeEntries(local, remote);
  }
}
