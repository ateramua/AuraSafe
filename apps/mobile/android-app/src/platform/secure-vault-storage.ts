import * as SecureStore from 'expo-secure-store';
import type { VaultStorageAdapter } from '@aurasafe/core';
import type { VaultPersistedState } from '@aurasafe/types';

const VAULT_STATE_KEY = 'aurasafe.vault.state';
const EMPTY_STATE: VaultPersistedState = {};

export class AndroidSecureVaultStorage implements VaultStorageAdapter {
  async load(): Promise<VaultPersistedState> {
    const raw = await SecureStore.getItemAsync(VAULT_STATE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    try {
      return JSON.parse(raw) as VaultPersistedState;
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  async save(state: VaultPersistedState): Promise<void> {
    await SecureStore.setItemAsync(VAULT_STATE_KEY, JSON.stringify(state));
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(VAULT_STATE_KEY);
  }
}
