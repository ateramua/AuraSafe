import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuraSafe } from '../src/context/AuraSafeProvider';
import { tokens } from '@aurasafe/design-system';

export default function IndexScreen() {
  const { auth } = useAuraSafe();
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const init = await auth.isInitialized();
      if (!mounted) return;
      setInitialized(init);
      setUnlocked(auth.isUnlocked());
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [auth]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.color.bg }}>
        <ActivityIndicator color={tokens.color.accent} size="large" />
      </View>
    );
  }

  if (!initialized) return <Redirect href="/onboarding" />;
  if (!unlocked) return <Redirect href="/onboarding/unlock" />;
  return <Redirect href="/(tabs)/vault" />;
}
