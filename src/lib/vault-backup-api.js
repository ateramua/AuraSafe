/**
 * Vault backup API wrapper for React components
 */
export class VaultBackupAPI {
  /**
   * Export vault to encrypted file
   */
  static async exportVault(password, options = {}) {
    if (!window.api?.vaultBackup?.export) {
      throw new Error('Vault backup API not available');
    }

    const result = await window.api.vaultBackup.export(password, options);

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }

    return result;
  }

  /**
   * Import vault from encrypted file
   */
  static async importVault(password, options = {}) {
    if (!window.api?.vaultBackup?.import) {
      throw new Error('Vault backup API not available');
    }

    const result = await window.api.vaultBackup.import(password, options);

    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }

    return result;
  }

  /**
   * Preview vault file contents
   */
  static async previewVault(password) {
    if (!window.api?.vaultBackup?.preview) {
      throw new Error('Vault backup API not available');
    }

    const result = await window.api.vaultBackup.preview(password);

    if (!result.success) {
      throw new Error(result.error || 'Preview failed');
    }

    return result;
  }

  /**
   * Get operation status
   */
  static async getOperationStatus(operationId) {
    if (!window.api?.vaultBackup?.getStatus) {
      throw new Error('Vault backup API not available');
    }

    return await window.api.vaultBackup.getStatus(operationId);
  }
}

/**
 * React hook for vault backup operations
 */
export function useVaultBackup() {
  return {
    exportVault: VaultBackupAPI.exportVault,
    importVault: VaultBackupAPI.importVault,
    previewVault: VaultBackupAPI.previewVault,
    getOperationStatus: VaultBackupAPI.getOperationStatus,
  };
}