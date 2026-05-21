import { Stack } from 'expo-router';
import { tokens } from '@aurasafe/design-system';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.bgSurface },
        headerTintColor: tokens.color.text,
        contentStyle: { backgroundColor: tokens.color.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Get started' }} />
      <Stack.Screen name="create-vault" options={{ title: 'Vault setup' }} />
      <Stack.Screen name="unlock" options={{ title: 'Unlock' }} />
    </Stack>
  );
}
