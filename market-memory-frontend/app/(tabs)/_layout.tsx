import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { theme } from '../../src/shared/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { AccountScreen } from '../../src/features/account/AccountScreen';

export default function TabsLayout() {
  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'signed-in' | 'recovery'>('loading');

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      const recovery = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
      if (active) setAuthState(recovery ? 'recovery' : data.session ? 'signed-in' : 'signed-out');
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) setAuthState(event === 'PASSWORD_RECOVERY' ? 'recovery' : session ? 'signed-in' : 'signed-out');
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (authState === 'loading') return <View style={s.loading}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (authState === 'signed-out' || authState === 'recovery') return <AccountScreen recovery={authState === 'recovery'} />;

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: theme.colors.bg },
    headerTintColor: theme.colors.text,
    tabBarStyle: { backgroundColor: theme.colors.panel, borderTopColor: theme.colors.border },
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textMuted,
  }}>
    <Tabs.Screen name="home" options={{ title: 'Today' }} />
    <Tabs.Screen name="market" options={{ title: 'Capture' }} />
    <Tabs.Screen name="journal" options={{ title: 'Review' }} />
    <Tabs.Screen name="reflect" options={{ title: 'Reflect' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
    <Tabs.Screen name="memory" options={{ title: 'Observations & snapshots', href: null }} />
    <Tabs.Screen name="alerts" options={{ title: 'Price alerts', href: null }} />
  </Tabs>;
}

const s = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg } });
