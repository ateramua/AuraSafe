import { dialog } from 'electron';
import { previewCredentialCsvFile } from '../import/credential-csv.mjs';
import { importCredentialCsvFile } from '../import/credential-csv-vault.mjs';

const CSV_FILTERS = [
  { name: 'CSV Files', extensions: ['csv'] },
  { name: 'All Files', extensions: ['*'] },
];

/**
 * @param {import('electron').BrowserWindow | null} parent
 */
export async function pickAndPreviewCredentialsCsv(parent) {
  const result = await dialog.showOpenDialog(parent, {
    title: 'Preview credentials CSV',
    filters: CSV_FILTERS,
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  const preview = await previewCredentialCsvFile(filePath);

  return {
    success: true,
    filePath,
    preview,
  };
}

/**
 * @param {import('electron').BrowserWindow | null} parent
 * @param {{ filePath?: string, skipDuplicates?: boolean }} [options]
 */
export async function pickAndImportCredentialsCsv(parent, options = {}) {
  let filePath = options.filePath;

  if (!filePath) {
    const result = await dialog.showOpenDialog(parent, {
      title: 'Import credentials from CSV',
      filters: CSV_FILTERS,
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    filePath = result.filePaths[0];
  }

  const importResult = await importCredentialCsvFile(filePath, {
    skipDuplicates: options.skipDuplicates,
  });

  return {
    ...importResult,
    filePath,
  };
}
