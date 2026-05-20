export type VaultEntryType =
  | 'credential'
  | 'contact'
  | 'creditCard'
  | 'bankAccount'
  | 'driverLicense'
  | 'unknown';

export interface VaultEntry {
  id: string;
  type?: VaultEntryType;
  name?: string;
  title?: string;
  username?: string;
  email?: string;
  login?: string;
  password?: string;
  url?: string;
  website?: string;
  domain?: string;
  notes?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  cardNumber?: string;
  cardHolder?: string;
  expiry?: string;
  cvv?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  licenseNumber?: string;
  licenseClass?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface VaultMetadata {
  lastModified: number;
  version: string;
}

export interface VaultPayload {
  entries: VaultEntry[];
  _meta: VaultMetadata;
}

export interface EncryptedBlob {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface VaultPersistedState {
  masterSalt?: string;
  encryptedVaultKey?: EncryptedBlob;
  vaultData?: EncryptedBlob;
  metadata?: VaultMetadata;
}

export type VaultCategoryId =
  | 'passwords'
  | 'addresses'
  | 'paymentCards'
  | 'bankAccounts'
  | 'driverLicenses'
  | 'help'
  | 'all';

export interface SyncQueueItem {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface WorkspaceIndexEntry {
  entryId: string;
  tokens: string[];
  category: VaultCategoryId;
  updatedAt: number;
}

export interface SecurityInsight {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entryId?: string;
}

export interface BridgeSession {
  sessionToken: string;
  expiresAt: number;
  port: number;
}
