import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CATEGORY_LABELS,
  entryHostLabel,
  entryLoginIdentifier,
  getCredentialName,
  maskPassword,
  maskValue,
} from '@aurasafe/domain';
import type { VaultCategoryId, VaultEntry } from '@aurasafe/types';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

const CATEGORIES: VaultCategoryId[] = [
  'passwords',
  'addresses',
  'paymentCards',
  'bankAccounts',
  'driverLicenses',
];

export default function VaultScreen() {
  const { entries, workspace, refreshEntries, loading, error } = useAuraSafe();
  const router = useRouter();
  const [category, setCategory] = useState<VaultCategoryId>('passwords');
  const [query, setQuery] = useState('');

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    workspace.setCategory(category);
  }, [category, workspace]);

  useEffect(() => {
    workspace.setSearchQuery(query);
  }, [query, workspace]);

  const filtered = useMemo(() => workspace.filter(entries), [workspace, entries, category, query]);

  const renderItem = useCallback(
    ({ item }: { item: VaultEntry }) => (
      <Pressable style={styles.card} onPress={() => router.push({ pathname: '/entry/[id]', params: { id: item.id } })}>
        <Text style={styles.cardTitle}>{getCredentialName(item)}</Text>
        {entryLoginIdentifier(item) ? (
          <Text style={styles.meta}>Username: {maskValue(entryLoginIdentifier(item))}</Text>
        ) : null}
        {item.password ? <Text style={styles.meta}>Password: {maskPassword()}</Text> : null}
        {entryHostLabel(item) ? <Text style={styles.url}>{entryHostLabel(item)}</Text> : null}
      </Pressable>
    ),
    [router],
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search vault…"
        placeholderTextColor={tokens.color.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.chips}>
        {CATEGORIES.map((id) => (
          <Pressable
            key={id}
            style={[styles.chip, category === id && styles.chipActive]}
            onPress={() => setCategory(id)}
          >
            <Text style={[styles.chipText, category === id && styles.chipTextActive]}>
              {CATEGORY_LABELS[id]}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={refreshEntries}
        ListEmptyComponent={<Text style={styles.empty}>No entries in this category.</Text>}
        contentContainerStyle={{ paddingBottom: 80, gap: 8 }}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/entry/new')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bg, padding: 16 },
  search: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 12,
    color: tokens.color.text,
    backgroundColor: tokens.color.bgSurface,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: tokens.color.accent, borderColor: tokens.color.accent },
  chipText: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm },
  chipTextActive: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
    gap: 4,
  },
  cardTitle: { color: tokens.color.text, fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.lg },
  meta: { color: tokens.color.textMuted, fontFamily: tokens.typography.fontFamilyMono, fontSize: tokens.typography.size.sm },
  url: { color: tokens.color.accent, fontSize: tokens.typography.size.sm },
  empty: { color: tokens.color.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: tokens.color.danger, marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: tokens.color.accentContrast, fontSize: 28, fontWeight: tokens.typography.weight.bold },
});
