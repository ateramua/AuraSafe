import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createEntryId } from '@aurasafe/domain';
import type { VaultCategoryId, VaultEntry } from '@aurasafe/types';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { entries, auth, refreshEntries } = useAuraSafe();
  const router = useRouter();
  const existing = useMemo(() => entries.find((e) => e.id === id), [entries, id]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name || existing.title || '');
      setUsername(existing.username || existing.email || '');
      setPassword(existing.password || '');
      setUrl(existing.url || '');
      setNotes(existing.notes || '');
    }
  }, [existing]);

  const onSave = async () => {
    const entry: VaultEntry = {
      ...(existing || {}),
      id: existing?.id || createEntryId(),
      type: existing?.type || 'credential',
      name,
      title: name,
      username,
      password,
      url,
      notes,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
    };
    try {
      await auth.getVaultService().saveEntry(entry);
    } catch (err) {
      Alert.alert('Validation', err instanceof Error ? err.message : 'Could not save entry');
      return;
    }
    await refreshEntries();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 10 }}>
      <Text style={styles.title}>{existing ? 'Edit entry' : 'New credential'}</Text>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Username" value={username} onChangeText={setUsername} />
      <Field label="Password" value={password} onChangeText={setPassword} secure />
      <Field label="URL" value={url} onChangeText={setUrl} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Pressable style={styles.button} onPress={onSave}>
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secure,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 80 }]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={multiline}
        placeholderTextColor={tokens.color.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bg, padding: 16 },
  title: { color: tokens.color.text, fontSize: tokens.typography.size.xl, fontWeight: tokens.typography.weight.bold },
  label: { color: tokens.color.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 12,
    color: tokens.color.text,
    backgroundColor: tokens.color.bgSurface,
  },
  button: {
    marginTop: 16,
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
});
