import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { theme } from '../../src/shared/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { AccountScreen } from '../../src/features/account/AccountScreen';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
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
    headerShown: false,
    tabBarPosition: desktop ? 'left' : 'bottom',
    tabBarStyle: desktop ? s.sidebar : s.tabBar,
    tabBarItemStyle: desktop ? s.sidebarItem : s.tabItem,
    tabBarLabelStyle: desktop ? s.sidebarLabel : s.tabLabel,
    tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarIcon: ({ focused }) => <Text style={[s.navMark, focused && s.navMarkActive]}>{focused ? '●' : '○'}</Text>,
    sceneStyle: { backgroundColor: theme.colors.bg },
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

const s = StyleSheet.create({
  loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:theme.colors.bg},
  sidebar:{width:218,backgroundColor:theme.colors.bg,borderRightWidth:1,borderRightColor:theme.colors.borderSubtle,paddingTop:42,paddingHorizontal:14},
  sidebarItem:{height:48,borderRadius:theme.radius.sm,marginVertical:2},sidebarLabel:{fontSize:14,fontWeight:'500',textAlign:'left'},
  tabBar:{height:66,backgroundColor:theme.colors.surface,borderTopColor:theme.colors.borderSubtle,paddingTop:5,paddingBottom:7},tabItem:{minHeight:54},tabLabel:{fontSize:10,fontWeight:'500'},
  navMark:{fontSize:9,color:theme.colors.textDim},navMarkActive:{color:theme.colors.accent},
});
