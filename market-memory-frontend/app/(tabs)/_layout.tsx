import { Tabs } from 'expo-router';
import { theme } from '../../src/shared/theme/tokens';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: theme.colors.bg },
    headerTintColor: theme.colors.text,
    tabBarStyle: { backgroundColor: theme.colors.panel, borderTopColor: theme.colors.border },
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textMuted,
  }}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="market" options={{ title: 'Discover' }} />
    <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
    <Tabs.Screen name="memory" options={{ title: 'Observations & snapshots', href: null }} />
    <Tabs.Screen name="alerts" options={{ title: 'Price alerts', href: null }} />
  </Tabs>;
}
