import { getCredentialName, searchEntries } from '@aurasafe/domain';
import type { SecurityInsight, VaultEntry, WorkspaceIndexEntry } from '@aurasafe/types';

export interface PasswordStrengthResult {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  feedback: string[];
}

export function scorePassword(password: string): PasswordStrengthResult {
  let score = 0;
  const feedback: string[] = [];
  if (!password) return { score: 0, label: 'weak', feedback: ['Password is empty'] };
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else feedback.push('Mix uppercase and lowercase letters');
  if (/\d/.test(password)) score += 1;
  else feedback.push('Add numbers');
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Add symbols');
  const labels: PasswordStrengthResult['label'][] = ['weak', 'fair', 'good', 'strong', 'excellent'];
  const label = labels[Math.min(score, labels.length - 1)] ?? 'weak';
  return { score, label, feedback };
}

export function analyzeVaultSecurity(entries: VaultEntry[]): SecurityInsight[] {
  const insights: SecurityInsight[] = [];
  const credentials = entries.filter((e) => (e.type || 'credential') === 'credential');
  const weak = credentials.filter((e) => e.password && scorePassword(e.password).score <= 1);
  if (weak.length) {
    insights.push({
      id: 'weak-passwords',
      severity: 'high',
      title: 'Weak passwords detected',
      description: `${weak.length} credential(s) use weak passwords.`,
    });
  }
  const missing = credentials.filter((e) => !e.password);
  if (missing.length) {
    insights.push({
      id: 'missing-passwords',
      severity: 'medium',
      title: 'Missing passwords',
      description: `${missing.length} credential(s) have no password set.`,
    });
  }
  const reused = findReusedPasswords(credentials);
  if (reused.length) {
    insights.push({
      id: 'reused-passwords',
      severity: 'critical',
      title: 'Reused passwords',
      description: `${reused.length} password value(s) are reused across entries.`,
    });
  }
  return insights;
}

function findReusedPasswords(entries: VaultEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.password) continue;
    counts.set(entry.password, (counts.get(entry.password) || 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c > 1).map(([p]) => p);
}

export function semanticSearch(entries: VaultEntry[], query: string, index: WorkspaceIndexEntry[]): VaultEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const tokenMatches = new Set(
    index
      .filter((row) => row.tokens.some((t) => t.includes(q)))
      .map((row) => row.entryId),
  );
  const direct = searchEntries(entries, query).map((e) => e.id);
  return entries.filter((e) => tokenMatches.has(e.id) || direct.includes(e.id));
}

export function buildPromptContext(entries: VaultEntry[], focusEntryId?: string): string {
  const focus = focusEntryId ? entries.find((e) => e.id === focusEntryId) : null;
  const summary = entries.slice(0, 20).map((e) => `- ${getCredentialName(e)} (${e.type || 'credential'})`).join('\n');
  return focus
    ? `Focus entry: ${getCredentialName(focus)}\nVault summary:\n${summary}`
    : `Vault summary:\n${summary}`;
}
