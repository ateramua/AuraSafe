import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import {
  clearPendingRestore,
  getPendingRestore,
  getPendingRestoreMeta,
  type PendingRestoreMeta,
} from '../../src/lib/pending-restore';
import { pickAndParseBackupFile } from '../../src/lib/restore-backup';
import { tokens } from '@aurasafe/design-system';

export default function CreateVaultScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { auth, refreshEntries } = useAuraSafe();
  const router = useRouter();
  const restoreFirst = mode === 'restore';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoreMeta, setRestoreMeta] = useState<PendingRestoreMeta | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [awaitingBackupPassword, setAwaitingBackupPassword] = useState(false);
  const [pendingFileName, setPendingFileName] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const autoPickStarted = useRef(false);

  const refreshRestoreMeta = useCallback(async () => {
    setRestoreMeta(await getPendingRestoreMeta());
  }, []);

  useEffect(() => {
    void refreshRestoreMeta();
  }, [refreshRestoreMeta]);

  const onRestoreFromFile = useCallback(async (useBackupPassword?: string) => {
    setRestoreLoading(true);
    try {
      const result = await pickAndParseBackupFile(useBackupPassword);
      if ('cancelled' in result) return;

      if ('needsPassword' in result) {
        setAwaitingBackupPassword(true);
        setPendingFileName(result.fileName);
        return;
      }

      setAwaitingBackupPassword(false);
      setBackupPassword('');
      setPendingFileName('');
      await refreshRestoreMeta();
      Alert.alert(
        'Backup loaded',
        `${result.entriesCount} entries from ${result.fileName} will import after you create your vault.`,
      );
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : 'Could not read backup file');
    } finally {
      setRestoreLoading(false);
    }
  }, [refreshRestoreMeta]);

  useEffect(() => {
    if (!restoreFirst || autoPickStarted.current || restoreMeta || awaitingBackupPassword) return;
    autoPickStarted.current = true;
    void onRestoreFromFile();
  }, [restoreFirst, restoreMeta, awaitingBackupPassword, onRestoreFromFile]);

  const onConfirmBackupPassword = async () => {
    if (!backupPassword) {
      Alert.alert('Password required', 'Enter the password used when this backup was encrypted.');
      return;
    }
    await onRestoreFromFile(backupPassword);
  };

  const onClearPendingRestore = async () => {
    await clearPendingRestore();
    setAwaitingBackupPassword(false);
    setBackupPassword('');
    setPendingFileName('');
    await refreshRestoreMeta();
  };

  const onCreate = async () => {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Master password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await auth.createVault(password);
      const pending = await getPendingRestore();
      if (pending) {
        await auth.getVaultService().importPayload(pending);
        await clearPendingRestore();
      }
      await refreshEntries();
      router.replace('/(tabs)/vault');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{restoreMeta ? 'Finish setup' : 'Create your vault'}</Text>
      <Text style={styles.subtitle}>
        {restoreMeta
          ? 'Backup is loaded. Set a new master password to encrypt the vault on this device.'
          : 'Set a master password. This encrypts all entries on-device.'}
      </Text>

      <View style={styles.restoreSection}>
        <Text style={styles.sectionLabel}>Restore from desktop</Text>
        <Text style={styles.transferHelp}>
          The file must be on this phone first (the picker cannot open your Mac). On desktop: export
          the .aura file, then copy it via Google Drive, email, USB to Downloads, or any cloud app
          signed in on the phone. Tap the button below and choose that file.
        </Text>

        {restoreMeta ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Backup ready</Text>
            <Text style={styles.bannerText}>
              {restoreMeta.entriesCount} entries from {restoreMeta.fileName} will import when you tap
              Create vault.
            </Text>
            <Pressable onPress={onClearPendingRestore}>
              <Text style={styles.bannerLink}>Clear backup</Text>
            </Pressable>
          </View>
        ) : null}

        {awaitingBackupPassword ? (
          <View style={styles.encryptedBox}>
            <Text style={styles.encryptedTitle}>Encrypted backup</Text>
            <Text style={styles.encryptedHint}>
              {pendingFileName} is password-protected. Enter the backup password (not your new master
              password).
            </Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Backup password"
              placeholderTextColor={tokens.color.textMuted}
              value={backupPassword}
              onChangeText={setBackupPassword}
            />
            <Pressable style={styles.restoreButton} onPress={onConfirmBackupPassword} disabled={restoreLoading}>
              <Text style={styles.restoreButtonText}>
                {restoreLoading ? 'Decrypting…' : 'Decrypt backup'}
              </Text>
            </Pressable>
            <Pressable onPress={onClearPendingRestore}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.restoreButton} onPress={() => onRestoreFromFile()} disabled={restoreLoading}>
            <Text style={styles.restoreButtonText}>
              {restoreLoading ? 'Opening file picker…' : 'Choose .aura backup file'}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>New master password</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Master password"
        placeholderTextColor={tokens.color.textMuted}
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={tokens.color.textMuted}
        value={confirm}
        onChangeText={setConfirm}
      />
      <Pressable style={styles.button} onPress={onCreate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create vault'}</Text>
      </Pressable>

      <Pressable style={styles.backLink} onPress={() => router.replace('/onboarding')}>
        <Text style={styles.link}>Back to get started</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.color.bg },
  container: { padding: 24, gap: 12, paddingBottom: 40 },
  title: { color: tokens.color.text, fontSize: tokens.typography.size.hero, fontWeight: tokens.typography.weight.bold },
  subtitle: { color: tokens.color.textMuted, marginBottom: 4 },
  restoreSection: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.accent,
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    color: tokens.color.accent,
    fontWeight: tokens.typography.weight.bold,
    fontSize: tokens.typography.size.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transferHelp: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm, lineHeight: 20 },
  banner: { gap: 6 },
  bannerTitle: { color: tokens.color.text, fontWeight: tokens.typography.weight.bold },
  bannerText: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm },
  bannerLink: { color: tokens.color.accent, marginTop: 4 },
  encryptedBox: { gap: 8 },
  encryptedTitle: { color: tokens.color.text, fontWeight: tokens.typography.weight.bold },
  encryptedHint: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm },
  restoreButton: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  restoreButtonText: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: tokens.color.border },
  dividerText: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 14,
    color: tokens.color.text,
    backgroundColor: tokens.color.bgSurface,
  },
  button: {
    marginTop: 4,
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
  backLink: { marginTop: 8, alignItems: 'center' },
  link: { color: tokens.color.textMuted, textAlign: 'center' },
});
