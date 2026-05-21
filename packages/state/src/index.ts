import { create } from 'zustand';
import type { SecurityInsight, VaultCategoryId, VaultEntry } from '@aurasafe/types';

export interface VaultStoreState {
  initialized: boolean | null;
  unlocked: boolean;
  entries: VaultEntry[];
  activeCategory: VaultCategoryId;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  securityInsights: SecurityInsight[];
  setInitialized: (value: boolean) => void;
  setUnlocked: (value: boolean) => void;
  setEntries: (entries: VaultEntry[]) => void;
  setActiveCategory: (category: VaultCategoryId) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSecurityInsights: (insights: SecurityInsight[]) => void;
  reset: () => void;
}

export const useVaultStore = create<VaultStoreState>((set) => ({
  initialized: null,
  unlocked: false,
  entries: [],
  activeCategory: 'passwords',
  searchQuery: '',
  loading: false,
  error: null,
  securityInsights: [],
  setInitialized: (initialized) => set({ initialized }),
  setUnlocked: (unlocked) => set({ unlocked }),
  setEntries: (entries) => set({ entries }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSecurityInsights: (securityInsights) => set({ securityInsights }),
  reset: () =>
    set({
      initialized: null,
      unlocked: false,
      entries: [],
      activeCategory: 'passwords',
      searchQuery: '',
      loading: false,
      error: null,
      securityInsights: [],
    }),
}));
