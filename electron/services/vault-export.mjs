import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { exportVaultData } from '../db/vault-export-import.mjs';
import { VaultEncryption } from '../crypto/vault-encryption.mjs';
import { VaultSchemaValidator } from '../validation/vault-schema.mjs';

/**
 * Export vault to encrypted file
 */
export async function exportVault(password, options = {}) {
  try {
    // Validate password
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Export data from database
    const data = await exportVaultData();

    // Validate data structure
    const validation = VaultSchemaValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Vault',
      defaultPath: `aurasafe-backup-${new Date().toISOString().split('T')[0]}.aura`,
      filters: [
        { name: 'AuraSafe Backup', extensions: ['aura'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    // Encrypt and save
    await VaultEncryption.encryptToFile(data, password, result.filePath);

    return {
      success: true,
      filePath: result.filePath,
      entriesCount: data.entries.length,
      categoriesCount: data.categories.length
    };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Export vault to JSON (unencrypted, for debugging)
 */
export async function exportVaultUnencrypted(options = {}) {
  try {
    const data = await exportVaultData();

    const validation = VaultSchemaValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    const result = await dialog.showSaveDialog({
      title: 'Export Vault (Unencrypted)',
      defaultPath: `aurasafe-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));

    return {
      success: true,
      filePath: result.filePath,
      entriesCount: data.entries.length
    };
  } catch (error) {
    console.error('Unencrypted export failed:', error);
    return { success: false, error: error.message };
  }
}