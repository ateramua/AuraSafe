import type { VaultCategoryId, VaultEntry, VaultEntryType } from '@aurasafe/types';

export const CATEGORY_LABELS: Record<VaultCategoryId, string> = {
  passwords: 'Passwords',
  addresses: 'Addresses',
  paymentCards: 'Payment Cards',
  bankAccounts: 'Bank Accounts',
  driverLicenses: 'Driver Licenses',
  help: 'Help',
  all: 'All Items',
};

export const CATEGORY_ENTRY_TYPES: Record<Exclude<VaultCategoryId, 'help' | 'all'>, VaultEntryType> = {
  passwords: 'credential',
  addresses: 'contact',
  paymentCards: 'creditCard',
  bankAccounts: 'bankAccount',
  driverLicenses: 'driverLicense',
};

export function getCredentialName(entry: VaultEntry): string {
  return (
    entry.name ||
    entry.title ||
    entry.username ||
    entry.email ||
    entry.url ||
    'Untitled'
  );
}

export function maskValue(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••••';
  return `${value.substring(0, 2)}••••${value.substring(value.length - 2)}`;
}

export function maskPassword(): string {
  return '••••••••';
}

export function entryLoginIdentifier(entry: VaultEntry): string {
  return entry.username || entry.email || entry.login || '';
}

export function entryHostLabel(entry: VaultEntry): string {
  return entry.displayHost as string || entry.url || entry.website || entry.domain || '';
}

export function normalizeEntryUrl(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function entryHasLaunchUrl(entry: VaultEntry): boolean {
  return Boolean(normalizeEntryUrl(entry.url || entry.website));
}

export function validateEntry(entry: VaultEntry): string[] {
  const errors: string[] = [];
  if (!entry.id) errors.push('Entry id is required');
  const label = getCredentialName(entry);
  if (!label || label === 'Untitled') {
    if (entry.type === 'credential') errors.push('Credential requires a name or username');
  }
  return errors;
}

export function filterEntriesByCategory(entries: VaultEntry[], category: VaultCategoryId): VaultEntry[] {
  if (category === 'all') return entries;
  if (category === 'help') return [];
  const type = CATEGORY_ENTRY_TYPES[category];
  return entries.filter((e) => (e.type || 'credential') === type);
}

export function searchEntries(entries: VaultEntry[], query: string): VaultEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) => {
    const text = [
      entry.name,
      entry.title,
      entry.username,
      entry.email,
      entry.login,
      entry.url,
      entry.website,
      entry.notes,
      entry.bankName,
      entry.cardHolder,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(q);
  });
}

export function createEntryId(): string {
  return `${Date.now()}`;
}

export function sanitizeOfflineEntry(entry: VaultEntry): VaultEntry {
  const { password, passphrase, secret, token, recoveryCode, otpSecret, notes, ...metadata } =
    entry as VaultEntry & Record<string, unknown>;
  return {
    ...metadata,
    offlineOnly: true,
    fillAvailable: false,
  };
}
