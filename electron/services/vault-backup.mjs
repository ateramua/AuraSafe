import { exportVault, exportVaultUnencrypted } from './vault-export.mjs';
import { importVault, importVaultUnencrypted, previewVault } from './vault-import.mjs';
import { validateDatabaseSchema } from '../db/vault-export-import.mjs';

/**
 * Main orchestrator for vault backup/restore operations
 */
export class VaultBackupManager {
  constructor() {
    this.operations = new Map();
  }

  /**
   * Export vault with encryption
   */
  async exportVault(password, options = {}) {
    const operationId = this.generateOperationId();
    this.operations.set(operationId, { type: 'export', status: 'running' });

    try {
      const result = await exportVault(password, options);
      this.operations.set(operationId, { type: 'export', status: 'completed', result });
      return { operationId, ...result };
    } catch (error) {
      this.operations.set(operationId, { type: 'export', status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Import vault from encrypted file
   */
  async importVault(password, options = {}) {
    const operationId = this.generateOperationId();
    this.operations.set(operationId, { type: 'import', status: 'running' });

    try {
      // Validate database before import
      await validateDatabaseSchema();

      const result = await importVault(password, options);
      this.operations.set(operationId, { type: 'import', status: 'completed', result });
      return { operationId, ...result };
    } catch (error) {
      this.operations.set(operationId, { type: 'import', status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Preview vault file
   */
  async previewVault(password) {
    const operationId = this.generateOperationId();
    this.operations.set(operationId, { type: 'preview', status: 'running' });

    try {
      const result = await previewVault(password);
      this.operations.set(operationId, { type: 'preview', status: 'completed', result });
      return { operationId, ...result };
    } catch (error) {
      this.operations.set(operationId, { type: 'preview', status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId) {
    return this.operations.get(operationId) || null;
  }

  /**
   * Clean up completed operations
   */
  cleanupOperations(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [id, op] of this.operations) {
      if (op.completedAt && (now - op.completedAt) > maxAge) {
        this.operations.delete(id);
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `vault-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const vaultBackupManager = new VaultBackupManager();

// Export convenience functions
export async function exportVaultBackup(password, options) {
  return vaultBackupManager.exportVault(password, options);
}

export async function importVaultBackup(password, options) {
  return vaultBackupManager.importVault(password, options);
}

export async function previewVaultBackup(password) {
  return vaultBackupManager.previewVault(password);
}