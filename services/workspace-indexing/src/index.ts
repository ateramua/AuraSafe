import { WorkspaceEngine } from '@aurasafe/workspace-engine';
import type { VaultCategoryId, VaultEntry } from '@aurasafe/types';

export class WorkspaceIndexingService {
  private engine = new WorkspaceEngine();

  index(entries: VaultEntry[]) {
    return this.engine.rebuildIndex(entries);
  }

  filter(entries: VaultEntry[]) {
    return this.engine.getFilteredEntries(entries);
  }

  setCategory(category: VaultCategoryId) {
    this.engine.setCategory(category);
  }

  setSearchQuery(query: string) {
    this.engine.setSearchQuery(query);
  }
}
