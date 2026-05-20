import { Tabs } from 'expo-router';
import { tokens } from '@aurasafe/design-system';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.bgSurface },
        headerTintColor: tokens.color.text,
        tabBarStyle: { backgroundColor: tokens.color.bgSurface, borderTopColor: tokens.color.border },
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.textMuted,
      }}
    >
      <Tabs.Screen name="vault" options={{ title: 'Vault' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
