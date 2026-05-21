import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuraSafeProvider } from '../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuraSafeProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: tokens.color.bgSurface },
            headerTintColor: tokens.color.text,
            contentStyle: { backgroundColor: tokens.color.bg },
          }}
        />
      </AuraSafeProvider>
    </QueryClientProvider>
  );
}
