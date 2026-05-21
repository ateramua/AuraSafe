import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { tokens } from '@aurasafe/design-system';

/**
 * First-run hub: restore vs new vault. Users often miss restore on create-vault alone.
 */
export default function OnboardingWelcomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Welcome to AuraSafe</Text>
      <Text style={styles.subtitle}>Choose how you want to get started on this device.</Text>

      <Pressable
        style={styles.restoreCard}
        onPress={() => router.push('/onboarding/create-vault?mode=restore')}
      >
        <Text style={styles.restoreTitle}>Restore from .aura backup</Text>
        <Text style={styles.restoreHint}>
          Export .aura on your Mac, copy it to this phone (Drive, email, USB, etc.), then pick the file
          here. You will set a new master password after the backup loads.
        </Text>
      </Pressable>

      <Pressable
        style={styles.createCard}
        onPress={() => router.push('/onboarding/create-vault?mode=new')}
      >
        <Text style={styles.createTitle}>Create a new vault</Text>
        <Text style={styles.createHint}>Start with an empty vault and a new master password.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, gap: 16, backgroundColor: tokens.color.bg },
  title: {
    color: tokens.color.text,
    fontSize: tokens.typography.size.hero,
    fontWeight: tokens.typography.weight.bold,
  },
  subtitle: { color: tokens.color.textMuted, marginBottom: 8 },
  restoreCard: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.lg,
    padding: 20,
    gap: 8,
  },
  restoreTitle: {
    color: tokens.color.accentContrast,
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
  },
  restoreHint: { color: tokens.color.accentContrast, opacity: 0.9, lineHeight: 20 },
  createCard: {
    backgroundColor: tokens.color.bgSurface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    padding: 20,
    gap: 8,
  },
  createTitle: { color: tokens.color.text, fontSize: tokens.typography.size.lg, fontWeight: tokens.typography.weight.bold },
  createHint: { color: tokens.color.textMuted, lineHeight: 20 },
});
