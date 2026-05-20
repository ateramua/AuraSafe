import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseBackupFileContent } from '@aurasafe/backup';
import { savePendingRestore } from './pending-restore';

export type PickBackupResult =
  | { cancelled: true }
  | { needsPassword: true; fileName: string }
  | { success: true; entriesCount: number; fileName: string; encrypted: boolean };

function readPickedFileText(asset: DocumentPicker.DocumentPickerAsset): string {
  if (!asset.uri) {
    throw new Error('Selected file has no URI');
  }
  const file = new File(asset.uri);
  if (!file.exists) {
    throw new Error('Could not access the selected backup file');
  }
  return file.textSync();
}

export async function pickAndParseBackupFile(backupPassword?: string): Promise<PickBackupResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    return { cancelled: true };
  }

  const asset = picked.assets[0];
  const fileName = asset.name || 'backup.aura';
  const content = readPickedFileText(asset);

  const parsed = parseBackupFileContent(content, { password: backupPassword });

  if (parsed.needsPassword) {
    return { needsPassword: true, fileName };
  }

  const entriesCount = parsed.vaultData.entries?.length || 0;
  if (!entriesCount) {
    throw new Error('Backup file has no entries to restore');
  }

  const encrypted = Boolean(backupPassword);
  await savePendingRestore(parsed.vaultData, {
    entriesCount,
    fileName,
    encrypted,
  });

  return {
    success: true,
    entriesCount,
    fileName,
    encrypted,
  };
}
