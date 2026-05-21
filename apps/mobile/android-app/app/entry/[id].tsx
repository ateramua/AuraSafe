import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { entryLoginIdentifier, getCredentialName, maskPassword, maskValue } from '@aurasafe/domain';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, auth, refreshEntries } = useAuraSafe();
  const router = useRouter();
  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);

  if (!entry) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Entry not found</Text>
      </View>
    );
  }

  const copy = async (label: string, value?: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const onDelete = async () => {
    Alert.alert('Delete entry', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await auth.getVaultService().deleteEntry(entry.id);
          await refreshEntries();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 12 }}>
      <Text style={styles.title}>{getCredentialName(entry)}</Text>
      {entryLoginIdentifier(entry) ? (
        <Pressable onPress={() => copy('Username', entryLoginIdentifier(entry))}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{maskValue(entryLoginIdentifier(entry))}</Text>
        </Pressable>
      ) : null}
      {entry.password ? (
        <Pressable onPress={() => copy('Password', entry.password)}>
          <Text style={styles.label}>Password</Text>
          <Text style={styles.value}>{maskPassword()}</Text>
        </Pressable>
      ) : null}
      {entry.notes ? (
        <>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.muted}>{entry.notes}</Text>
        </>
      ) : null}
      <Pressable style={styles.button} onPress={() => router.push({ pathname: '/entry/edit', params: { id: entry.id } })}>
        <Text style={styles.buttonText}>Edit</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.danger]} onPress={onDelete}>
        <Text style={styles.buttonText}>Delete</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bg, padding: 16 },
  title: { color: tokens.color.text, fontSize: tokens.typography.size.hero, fontWeight: tokens.typography.weight.bold },
  label: { color: tokens.color.textMuted, marginTop: 8 },
  value: { color: tokens.color.text, fontFamily: tokens.typography.fontFamilyMono },
  muted: { color: tokens.color.textMuted },
  button: {
    marginTop: 12,
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  danger: { backgroundColor: tokens.color.danger },
  buttonText: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
});
