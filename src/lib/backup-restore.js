import { hasDesktopVaultApi } from './api-client';

const DESKTOP_MSG =
  'Desktop API not available. Run npm run dev from the AuraSafe repo root and use the Electron window (not a browser tab).';

export const PENDING_RESTORE_KEY = 'pendingRestore';
export const PENDING_RESTORE_META_KEY = 'pendingRestoreMeta';

function fileNameFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return 'backup file';
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || 'backup file';
}

function savePendingRestore(result) {
  const vaultData = result.backupData?.data || result.backupData;
  const entriesCount = vaultData?.entries?.length || result.entriesCount || 0;

  sessionStorage.setItem(PENDING_RESTORE_KEY, JSON.stringify(result.backupData));
  sessionStorage.setItem(
    PENDING_RESTORE_META_KEY,
    JSON.stringify({
      entriesCount,
      fileName: fileNameFromPath(result.filePath),
      importedAt: Date.now(),
      encrypted: Boolean(result.encrypted),
      source: result.source || 'file',
    })
  );

  return { entriesCount, fileName: fileNameFromPath(result.filePath) };
}

export function getPendingRestoreMeta() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_RESTORE_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingRestoreMeta() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_RESTORE_META_KEY);
}

export function formatRestoreSuccessMessage(meta) {
  if (!meta) return 'Backup loaded successfully.';
  const label = meta.source === 'icloud' ? 'iCloud backup' : `"${meta.fileName}"`;
  const encryptedNote = meta.encrypted ? ' (decrypted successfully)' : '';
  return `Successfully loaded ${meta.entriesCount} password ${
    meta.entriesCount === 1 ? 'entry' : 'entries'
  } from ${label}${encryptedNote}. Set your master password on the Vault screen to finish restore.`;
}

/**
 * Pick a .aura backup and load it for pre-vault restore (sessionStorage + redirect to /vault).
 */
export async function pickPreVaultBackup({ password, filePath } = {}) {
  if (!hasDesktopVaultApi() || !window.api?.backupPreVault) {
    throw new Error(DESKTOP_MSG);
  }

  await window.api.backupPreVault.initTemp();

  let encrypted = false;
  let result = await window.api.backupPreVault.importFile({ password, filePath });

  if (result.needsPassword) {
    encrypted = true;
    const backupPassword = window.prompt(
      'This backup is encrypted. Enter the backup password:'
    );
    if (!backupPassword) {
      return { success: false, cancelled: true };
    }
    result = await window.api.backupPreVault.importFile({
      password: backupPassword,
      filePath: result.filePath,
    });
  }

  if (result.cancelled) {
    return { success: false, cancelled: true };
  }

  if (!result.success) {
    throw new Error(result.error || 'Failed to load backup file');
  }

  const vaultData = result.backupData?.data || result.backupData;
  if (!vaultData?.entries?.length) {
    throw new Error('Backup file has no entries to restore');
  }

  const saved = savePendingRestore({
    ...result,
    encrypted,
    source: 'file',
  });

  return {
    success: true,
    entriesCount: saved.entriesCount,
    fileName: saved.fileName,
    message: formatRestoreSuccessMessage(getPendingRestoreMeta()),
  };
}

export async function pickPreVaultICloudBackup({ password } = {}) {
  if (!hasDesktopVaultApi() || !window.api?.backupPreVault) {
    throw new Error(DESKTOP_MSG);
  }

  await window.api.backupPreVault.initTemp();

  let encrypted = false;
  let result = await window.api.backupPreVault.iCloudRestore({ password });

  if (result.needsPassword) {
    encrypted = true;
    const backupPassword = window.prompt(
      'This iCloud backup is encrypted. Enter the backup password:'
    );
    if (!backupPassword) {
      return { success: false, cancelled: true };
    }
    result = await window.api.backupPreVault.iCloudRestore({
      password: backupPassword,
    });
  }

  if (!result.success) {
    throw new Error(result.error || 'No iCloud backup found');
  }

  const vaultData = result.backupData?.data || result.backupData;
  if (!vaultData?.entries?.length) {
    throw new Error('iCloud backup has no entries to restore');
  }

  const saved = savePendingRestore({ ...result, encrypted, source: 'icloud' });

  return {
    success: true,
    entriesCount: saved.entriesCount,
    fileName: saved.fileName,
    message: formatRestoreSuccessMessage(getPendingRestoreMeta()),
  };
}
