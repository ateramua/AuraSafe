import { createEntryId, validateEntry } from '@aurasafe/domain';
import type { VaultEntry } from '@aurasafe/types';

export type EditorCommand =
  | { type: 'CREATE_ENTRY'; entry: Partial<VaultEntry> }
  | { type: 'UPDATE_FIELD'; id: string; field: string; value: unknown }
  | { type: 'DELETE_ENTRY'; id: string }
  | { type: 'DUPLICATE_ENTRY'; id: string };

export interface EditorState {
  draft: VaultEntry | null;
  dirty: boolean;
  history: VaultEntry[];
}

export class EditorEngine {
  constructor(private state: EditorState = { draft: null, dirty: false, history: [] }) {}

  getState(): EditorState {
    return { ...this.state, draft: this.state.draft ? { ...this.state.draft } : null, history: [...this.state.history] };
  }

  startCreate(type: VaultEntry['type'] = 'credential'): VaultEntry {
    const draft: VaultEntry = { id: createEntryId(), type, createdAt: Date.now(), updatedAt: Date.now() };
    this.state.draft = draft;
    this.state.dirty = true;
    return draft;
  }

  startEdit(entry: VaultEntry): VaultEntry {
    this.state.draft = { ...entry };
    this.state.dirty = false;
    return this.state.draft;
  }

  apply(command: EditorCommand): VaultEntry | null {
    if (!this.state.draft && command.type !== 'CREATE_ENTRY') return null;
    switch (command.type) {
      case 'CREATE_ENTRY': {
        this.state.draft = {
          id: createEntryId(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...command.entry,
        };
        break;
      }
      case 'UPDATE_FIELD': {
        if (!this.state.draft || this.state.draft.id !== command.id) return null;
        this.state.draft = { ...this.state.draft, [command.field]: command.value, updatedAt: Date.now() };
        break;
      }
      case 'DELETE_ENTRY':
        return null;
      case 'DUPLICATE_ENTRY': {
        const source = this.state.history.find((e) => e.id === command.id);
        if (!source) return null;
        this.state.draft = { ...source, id: createEntryId(), updatedAt: Date.now(), createdAt: Date.now() };
        break;
      }
      default:
        break;
    }
    this.state.dirty = true;
    return this.state.draft;
  }

  commit(): { entry: VaultEntry | null; errors: string[] } {
    if (!this.state.draft) return { entry: null, errors: ['No draft entry'] };
    const errors = validateEntry(this.state.draft);
    if (errors.length) return { entry: null, errors };
    const entry = { ...this.state.draft, updatedAt: Date.now() };
    this.state.history.push(entry);
    this.state.dirty = false;
    return { entry, errors: [] };
  }

  diff(before: VaultEntry, after: VaultEntry): Array<{ field: string; from: unknown; to: unknown }> {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (before[key] !== after[key]) changes.push({ field: key, from: before[key], to: after[key] });
    }
    return changes;
  }
}
