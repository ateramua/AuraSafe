import { createEntryId, validateEntry } from '@aurasafe/domain';
import type { EncryptedBlob, VaultEntry, VaultMetadata, VaultPayload, VaultPersistedState } from '@aurasafe/types';
import {
  decrypt,
  deriveKey,
  encrypt,
  fromBase64,
  generateSalt,
  generateVaultKey,
  toBase64,
  vaultKeyFromHex,
  vaultKeyToHex,
} from './crypto.js';

export interface VaultStorageAdapter {
  load(): Promise<VaultPersistedState>;
  save(state: VaultPersistedState): Promise<void>;
}

export class VaultService {
  private masterKey: Uint8Array | null = null;
  private vaultKey: Uint8Array | null = null;

  constructor(private readonly storage: VaultStorageAdapter) {}

  async isInitialized(): Promise<boolean> {
    const state = await this.storage.load();
    return Boolean(state.masterSalt);
  }

  isUnlocked(): boolean {
    return this.vaultKey !== null;
  }

  async initVault(masterPassword: string): Promise<void> {
    const salt = generateSalt();
    const derivedMasterKey = await deriveKey(masterPassword, salt);
    const vaultKeyRaw = generateVaultKey();
    const encryptedVaultKey = encrypt(vaultKeyToHex(vaultKeyRaw), derivedMasterKey);
    const payload: VaultPayload = {
      entries: [],
      _meta: { lastModified: Date.now(), version: '1.0' },
    };
    const vaultData = encrypt(JSON.stringify(payload), vaultKeyRaw);
    await this.storage.save({
      masterSalt: toBase64(salt),
      encryptedVaultKey,
      vaultData,
      metadata: payload._meta,
    });
    this.masterKey = derivedMasterKey;
    this.vaultKey = vaultKeyRaw;
  }

  async unlockVault(masterPassword: string): Promise<boolean> {
    const state = await this.storage.load();
    if (!state.masterSalt || !state.encryptedVaultKey) return false;
    const salt = fromBase64(state.masterSalt);
    const derivedMasterKey = await deriveKey(masterPassword, salt);
    try {
      const vaultKeyHex = decrypt(state.encryptedVaultKey, derivedMasterKey);
      this.masterKey = derivedMasterKey;
      this.vaultKey = vaultKeyFromHex(vaultKeyHex);
      return true;
    } catch {
      return false;
    }
  }

  lockVault(): void {
    this.masterKey = null;
    this.vaultKey = null;
  }

  private requireUnlocked(): Uint8Array {
    if (!this.vaultKey) throw new Error('Vault is locked');
    return this.vaultKey;
  }

  private async readPayload(): Promise<VaultPayload> {
    const key = this.requireUnlocked();
    const state = await this.storage.load();
    if (!state.vaultData) return { entries: [], _meta: { lastModified: 0, version: '1.0' } };
    const json = decrypt(state.vaultData, key);
    return JSON.parse(json) as VaultPayload;
  }

  private async writePayload(payload: VaultPayload): Promise<void> {
    const key = this.requireUnlocked();
    const state = await this.storage.load();
    payload._meta = { lastModified: Date.now(), version: '1.0' };
    const vaultData = encrypt(JSON.stringify(payload), key);
    await this.storage.save({
      ...state,
      vaultData,
      metadata: payload._meta,
    });
  }

  async getEntries(): Promise<VaultEntry[]> {
    const payload = await this.readPayload();
    return payload.entries || [];
  }

  async saveEntry(entry: VaultEntry): Promise<VaultEntry> {
    const errors = validateEntry(entry);
    if (errors.length) throw new Error(errors.join('; '));
    const payload = await this.readPayload();
    const now = Date.now();
    const normalized: VaultEntry = {
      ...entry,
      id: entry.id || createEntryId(),
      updatedAt: now,
      createdAt: entry.createdAt || now,
    };
    const index = payload.entries.findIndex((e) => e.id === normalized.id);
    if (index >= 0) payload.entries[index] = normalized;
    else payload.entries.push(normalized);
    await this.writePayload(payload);
    return normalized;
  }

  async deleteEntry(id: string): Promise<void> {
    const payload = await this.readPayload();
    payload.entries = payload.entries.filter((e) => e.id !== id);
    await this.writePayload(payload);
  }

  async importPayload(data: VaultPayload): Promise<void> {
    if (!this.vaultKey) throw new Error('Vault is locked');
    await this.writePayload({
      entries: data.entries || [],
      _meta: data._meta || { lastModified: Date.now(), version: '1.0' },
    });
  }

  async getMetadata(): Promise<VaultMetadata> {
    const state = await this.storage.load();
    return state.metadata || { lastModified: 0, version: '1.0' };
  }
}
