import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { analyzeVaultSecurity } from '@aurasafe/ai-engine';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

export default function SettingsScreen() {
  const { auth, entries, refreshEntries } = useAuraSafe();
  const router = useRouter();
  const [biometric, setBiometric] = useState({ available: false, enabled: false });
  const insights = analyzeVaultSecurity(entries);

  useEffect(() => {
    auth.biometricStatus().then(setBiometric);
  }, [auth]);

  const toggleBiometric = async (value: boolean) => {
    if (value) await auth.enableBiometric();
    else await auth.disableBiometric();
    setBiometric(await auth.biometricStatus());
  };

  const onLock = () => {
    auth.lock();
    router.replace('/onboarding/unlock');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Security insights</Text>
        {insights.length === 0 ? (
          <Text style={styles.muted}>No issues detected.</Text>
        ) : (
          insights.map((item) => (
            <View key={item.id} style={styles.insight}>
              <Text style={styles.insightTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.description}</Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Biometric unlock</Text>
          <Switch
            value={biometric.enabled}
            onValueChange={toggleBiometric}
            disabled={!biometric.available}
          />
        </View>
        {!biometric.available ? (
          <Text style={styles.muted}>Biometrics not available on this device.</Text>
        ) : null}
      </View>
      <Pressable style={styles.button} onPress={() => refreshEntries()}>
        <Text style={styles.buttonText}>Refresh vault</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.danger]} onPress={onLock}>
        <Text style={styles.buttonText}>Lock vault</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.bg, padding: 16 },
  card: {
    backgroundColor: tokens.color.bgSurface,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: tokens.color.text, fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.lg },
  muted: { color: tokens.color.textMuted, fontSize: tokens.typography.size.sm },
  insight: { gap: 4, marginTop: 8 },
  insightTitle: { color: tokens.color.warning, fontWeight: tokens.typography.weight.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  danger: { backgroundColor: tokens.color.danger },
  buttonText: { color: tokens.color.text, fontWeight: tokens.typography.weight.bold },
});
