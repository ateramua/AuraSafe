import { analyzeVaultSecurity, buildPromptContext, semanticSearch } from '@aurasafe/ai-engine';
import { WorkspaceEngine } from '@aurasafe/workspace-engine';
import type { VaultEntry } from '@aurasafe/types';

export class AiOrchestrationService {
  private workspace = new WorkspaceEngine();

  refresh(entries: VaultEntry[]) {
    this.workspace.rebuildIndex(entries);
  }

  getSecurityInsights(entries: VaultEntry[]) {
    return analyzeVaultSecurity(entries);
  }

  search(entries: VaultEntry[], query: string) {
    return semanticSearch(entries, query, this.workspace.getIndex());
  }

  buildContext(entries: VaultEntry[], focusEntryId?: string) {
    return buildPromptContext(entries, focusEntryId);
  }
}
