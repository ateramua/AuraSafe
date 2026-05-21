import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AuthCoordinator } from '@aurasafe/auth';
import { analyzeVaultSecurity } from '@aurasafe/ai-engine';
import { WorkspaceIndexingService } from '@aurasafe/service-workspace-indexing';
import { AiOrchestrationService } from '@aurasafe/service-ai-orchestration';
import type { VaultEntry } from '@aurasafe/types';
import { AndroidSecureVaultStorage } from '../platform/secure-vault-storage';
import { AndroidBiometricProvider } from '../platform/android-biometric';

interface AuraSafeContextValue {
  auth: AuthCoordinator;
  ai: AiOrchestrationService;
  workspace: WorkspaceIndexingService;
  refreshEntries: () => Promise<VaultEntry[]>;
  entries: VaultEntry[];
  loading: boolean;
  error: string | null;
}

const AuraSafeContext = createContext<AuraSafeContextValue | null>(null);

export function AuraSafeProvider({ children }: { children: React.ReactNode }) {
  const storage = useMemo(() => new AndroidSecureVaultStorage(), []);
  const biometric = useMemo(() => new AndroidBiometricProvider(), []);
  const auth = useMemo(() => new AuthCoordinator(storage, biometric), [storage, biometric]);
  const ai = useMemo(() => new AiOrchestrationService(), []);
  const workspace = useMemo(() => new WorkspaceIndexingService(), []);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await auth.getVaultService().getEntries();
      setEntries(list);
      ai.refresh(list);
      workspace.index(list);
      return list;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load entries';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [auth, ai, workspace]);

  const value = useMemo(
    () => ({
      auth,
      ai,
      workspace,
      refreshEntries,
      entries,
      loading,
      error,
      securityInsights: analyzeVaultSecurity(entries),
    }),
    [auth, ai, workspace, refreshEntries, entries, loading, error],
  );

  return <AuraSafeContext.Provider value={value as AuraSafeContextValue}>{children}</AuraSafeContext.Provider>;
}

export function useAuraSafe() {
  const ctx = useContext(AuraSafeContext);
  if (!ctx) throw new Error('useAuraSafe must be used within AuraSafeProvider');
  return ctx;
}
