import { CATEGORY_ENTRY_TYPES, filterEntriesByCategory, getCredentialName } from '@aurasafe/domain';
import type { VaultCategoryId, VaultEntry, WorkspaceIndexEntry } from '@aurasafe/types';

export interface WorkspaceState {
  activeCategory: VaultCategoryId;
  searchQuery: string;
  lastIndexedAt: number;
}

export class WorkspaceEngine {
  private index: WorkspaceIndexEntry[] = [];

  constructor(private state: WorkspaceState = { activeCategory: 'passwords', searchQuery: '', lastIndexedAt: 0 }) {}

  getState(): WorkspaceState {
    return { ...this.state };
  }

  setCategory(category: VaultCategoryId): void {
    this.state.activeCategory = category;
  }

  setSearchQuery(query: string): void {
    this.state.searchQuery = query;
  }

  rebuildIndex(entries: VaultEntry[]): WorkspaceIndexEntry[] {
    this.index = entries.map((entry) => ({
      entryId: entry.id,
      category: this.resolveCategory(entry),
      updatedAt: entry.updatedAt || Date.now(),
      tokens: tokenize(getCredentialName(entry), entry.notes, entry.url, entry.username),
    }));
    this.state.lastIndexedAt = Date.now();
    return this.index;
  }

  getIndex(): WorkspaceIndexEntry[] {
    return [...this.index];
  }

  getFilteredEntries(entries: VaultEntry[]): VaultEntry[] {
    const byCategory = filterEntriesByCategory(entries, this.state.activeCategory);
    const q = this.state.searchQuery.trim().toLowerCase();
    if (!q) return byCategory;
    const ids = new Set(
      this.index
        .filter((row) => row.tokens.some((t) => t.includes(q)))
        .map((row) => row.entryId),
    );
    return byCategory.filter(
      (e) => ids.has(e.id) || getCredentialName(e).toLowerCase().includes(q),
    );
  }

  private resolveCategory(entry: VaultEntry): VaultCategoryId {
    const type = entry.type || 'credential';
    for (const [category, entryType] of Object.entries(CATEGORY_ENTRY_TYPES)) {
      if (entryType === type) return category as VaultCategoryId;
    }
    return 'all';
  }
}

function tokenize(...parts: (string | undefined)[]): string[] {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/)
    .filter((t) => t.length > 1);
}
