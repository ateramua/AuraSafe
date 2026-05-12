import { dialog } from 'electron';
import fs from 'fs/promises';
import { importVaultData } from '../db/vault-export-import.mjs';
import { VaultEncryption, validateEncryptedFile } from '../crypto/vault-encryption.mjs';
import { VaultSchemaValidator, sanitizeVaultData } from '../validation/vault-schema.mjs';

/**
 * Import vault from encrypted file
 */
export async function importVault(password, options = {}) {
  try {
    // Validate password
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Show open dialog
    const result = await dialog.showOpenDialog({
      title: 'Import Vault',
      filters: [
        { name: 'AuraSafe Backup', extensions: ['aura'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];

    // Read and parse file
    const fileContent = await fs.readFile(filePath, 'utf8');
    const encryptedData = JSON.parse(fileContent);

    // Validate encrypted file format
    validateEncryptedFile(encryptedData);

    // Decrypt data
    const data = VaultEncryption.decrypt(encryptedData, password);

    // Validate schema
    const validation = VaultSchemaValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid vault data: ${validation.errors.join(', ')}`);
    }

    // Sanitize data
    const sanitizedData = sanitizeVaultData(data);

    // Import to database
    const importResult = await importVaultData(sanitizedData, options);

    return {
      success: true,
      filePath,
      imported: importResult.imported,
      mode: options.mode || 'merge'
    };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import vault from unencrypted JSON file
 */
export async function importVaultUnencrypted(options = {}) {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Vault (Unencrypted)',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];

    // Read and parse file
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Validate schema
    const validation = VaultSchemaValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid vault data: ${validation.errors.join(', ')}`);
    }

    // Sanitize data
    const sanitizedData = sanitizeVaultData(data);

    // Import to database
    const importResult = await importVaultData(sanitizedData, options);

    return {
      success: true,
      filePath,
      imported: importResult.imported,
      mode: options.mode || 'merge'
    };
  } catch (error) {
    console.error('Unencrypted import failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Preview vault file without importing
 */
export async function previewVault(password) {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Preview Vault File',
      filters: [
        { name: 'AuraSafe Backup', extensions: ['aura'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const fileContent = await fs.readFile(filePath, 'utf8');
    const fileData = JSON.parse(fileContent);

    let data;
    if (filePath.endsWith('.aura')) {
      // Encrypted file
      validateEncryptedFile(fileData);
      data = VaultEncryption.decrypt(fileData, password);
    } else {
      // Unencrypted JSON
      data = fileData;
    }

    const validation = VaultSchemaValidator.validate(data);
    if (!validation.valid) {
      throw new Error(`Invalid vault data: ${validation.errors.join(', ')}`);
    }

    return {
      success: true,
      filePath,
      preview: {
        version: data.version,
        exportDate: data.exportDate,
        entriesCount: data.entries?.length || 0,
        categoriesCount: data.categories?.length || 0,
        metadata: data.metadata
      }
    };
  } catch (error) {
    console.error('Preview failed:', error);
    return { success: false, error: error.message };
  }
}