import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

type Thought = { id: number; title: string; symbol: string; created_at: string };
type Watch = { id: number; symbol: string; name: string | null };

export function HomeScreen() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [watchlist, setWatchlist] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([apiRequest<Thought[]>('/api/journal'), apiRequest<Watch[]>('/api/watchlist')])
      .then(([entries, watched]) => { if (active) { setThoughts(entries); setWatchlist(watched); } })
      .catch(e => { if (active) { setThoughts([]); setWatchlist([]); setError(e instanceof Error ? e.message : 'Unable to load your notebook.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]));
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>YOUR MARKET NOTEBOOK</Text>
    <Text style={s.title}>Keep your thinking in view.</Text>
    <Text style={s.body}>Remember what you thought, what you saw, and what you learned.</Text>
    <Link href="/(tabs)/journal" asChild><Pressable style={s.button}><Text style={s.buttonText}>Open journal</Text></Pressable></Link>
    {loading ? <ActivityIndicator color={theme.colors.primary} /> : error ? <View style={s.card}>
      <Text accessibilityRole="alert" style={s.body}>{error}</Text>
      <Pressable onPress={() => setRefresh(n => n + 1)} style={s.action}><Text style={s.link}>Retry</Text></Pressable>
      <Link href="/(tabs)/account" style={s.link}>Go to account</Link>
    </View> : <>
      <Text style={s.heading}>Recent thoughts</Text>
      {!thoughts.length ? <Text style={s.body}>Your notebook starts with one thought. Find an asset and record what you expect.</Text> : thoughts.slice(0, 5).map(thought =>
        <Link key={thought.id} href="/(tabs)/journal" asChild><Pressable style={s.card}>
          <Text style={s.eyebrow}>{thought.symbol}</Text><Text style={s.heading}>{thought.title}</Text>
          <Text style={s.body}>{new Date(thought.created_at).toLocaleDateString()} · Revisit in journal</Text>
        </Pressable></Link>)}
      <Text style={s.heading}>Your watchlist</Text>
      {!watchlist.length ? <Text style={s.body}>Save assets in Discover to keep them close.</Text> : watchlist.slice(0, 8).map(item =>
        <View key={item.id} style={s.card}><Text style={s.eyebrow}>{item.symbol}</Text><Text style={s.body}>{item.name || item.symbol}</Text></View>)}
      <Link href="/(tabs)/market" style={s.link}>Explore assets →</Link>
    </>}
    <View style={s.footer}><Link href="/(tabs)/memory" style={s.link}>Observations & snapshots</Link><Link href="/(tabs)/alerts" style={s.link}>Price alerts</Link></View>
  </ScrollView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.bg }, content: { padding: 16, width: '100%', maxWidth: 960, alignSelf: 'center', gap: 12 },
  eyebrow: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' }, title: { color: theme.colors.text, fontSize: 28, fontWeight: '700' },
  body: { color: theme.colors.textMuted, fontSize: 16, lineHeight: 24 }, heading: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  card: { padding: 16, borderRadius: 12, backgroundColor: theme.colors.panel, borderColor: theme.colors.border, borderWidth: 1, gap: 6 },
  button: { padding: 16, minHeight: 44, backgroundColor: theme.colors.primaryStrong, borderRadius: 12, alignSelf: 'flex-start' }, buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: theme.colors.primary, fontSize: 16, paddingVertical: 12 }, action: { minHeight: 44 }, footer: { marginTop: 20, gap: 8 },
});
