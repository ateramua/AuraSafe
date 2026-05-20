import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuraSafe } from '../../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

export default function UnlockScreen() {
  const { auth, refreshEntries } = useAuraSafe();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    auth.biometricStatus().then((s) => setBiometricAvailable(s.available && s.enabled));
  }, [auth]);

  const onUnlock = async () => {
    setLoading(true);
    try {
      const ok = await auth.unlock(password);
      if (!ok) {
        Alert.alert('Unlock failed', 'Incorrect master password.');
        return;
      }
      await refreshEntries();
      router.replace('/(tabs)/vault');
    } finally {
      setLoading(false);
    }
  };

  const onBiometric = async () => {
    const ok = await auth.unlockWithBiometric();
    if (!ok) {
      Alert.alert('Biometric unlock', 'Biometric unlock failed or is not enabled.');
      return;
    }
    await refreshEntries();
    router.replace('/(tabs)/vault');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock AuraSafe</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Master password"
        placeholderTextColor={tokens.color.textMuted}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={onUnlock} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Unlocking…' : 'Unlock'}</Text>
      </Pressable>
      {biometricAvailable ? (
        <Pressable style={styles.secondary} onPress={onBiometric}>
          <Text style={styles.secondaryText}>Unlock with biometrics</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: tokens.color.bg, gap: 12 },
  title: { color: tokens.color.text, fontSize: tokens.typography.size.hero, fontWeight: tokens.typography.weight.bold },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    padding: 14,
    color: tokens.color.text,
    backgroundColor: tokens.color.bgSurface,
  },
  button: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: tokens.color.accentContrast, fontWeight: tokens.typography.weight.bold },
  secondary: { padding: 12, alignItems: 'center' },
  secondaryText: { color: tokens.color.accent },
});
