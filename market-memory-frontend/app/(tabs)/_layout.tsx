import { Tabs } from 'expo-router';

const options = {
  headerStyle: { backgroundColor: '#0f172a' },
  headerTintColor: '#f8fafc',
  tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
  tabBarActiveTintColor: '#60a5fa',
  tabBarInactiveTintColor: '#64748b',
};

export default function TabsLayout() {
  return <Tabs screenOptions={options}>
    <Tabs.Screen name="market" options={{ title: 'Market' }} />
    <Tabs.Screen name="memory" options={{ title: 'Memory' }} />
    <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
    <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
  </Tabs>;
}
