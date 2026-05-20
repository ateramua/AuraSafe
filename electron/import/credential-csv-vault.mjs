import fs from 'fs/promises';
import {
  buildEntriesFromCredentialRecords,
  parseCredentialCsv,
} from './credential-csv.mjs';
import {
  isUnlocked,
  loadVaultEntries,
  saveVaultEntries,
} from '../crypto/key-manager.mjs';

export async function importCredentialCsvFile(filePath, options = {}) {
  if (!isUnlocked()) {
    throw new Error('Vault must be unlocked to import credentials');
  }

  const content = await fs.readFile(filePath, 'utf8');
  const { records, columns } = parseCredentialCsv(content);
  const existingEntries = loadVaultEntries();

  const result = buildEntriesFromCredentialRecords(records, columns, {
    skipDuplicates: options.skipDuplicates !== false,
    existingEntries,
  });

  if (result.importedEntries.length === 0) {
    return {
      success: false,
      error: 'No importable rows found. Each row needs a username and password.',
      ...result,
    };
  }

  saveVaultEntries([...existingEntries, ...result.importedEntries]);

  return {
    success: true,
    imported: result.importedEntries.length,
    skipped: result.skipped,
    skippedSecureNotes: result.skippedSecureNotes,
    skippedIncomplete: result.skippedIncomplete,
    skippedDuplicates: result.skippedDuplicates,
    totalRows: result.totalRows,
  };
}
