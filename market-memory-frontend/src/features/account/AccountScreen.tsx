import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

type Summary = {
  user: { id: string; email?: string | null };
  stats: { observations: number; snapshots: number; journal_entries: number; watchlist_items: number; active_alerts: number };
  market_data: { stocks: string; crypto: string; price_capture: string };
};

export function AccountScreen() {
  const [error,setError]=useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const active = Boolean(data.session);
    setSignedIn(active);
    if (!active) { setSummary(null); return; }
    setError('');
    try { setSummary(await apiRequest<Summary>('/api/account/summary')); } catch { setSummary(null);setError('Unable to load your account. Please retry.'); }
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    Alert.alert(error ? 'Sign up failed' : 'Account created', error?.message ?? 'Check your email if confirmation is enabled.');
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  if (!signedIn) {
    return <ScrollView style={s.page} contentContainerStyle={s.center}><View style={s.authCard}><Text style={s.eyebrow}>PRIVATE MARKET MEMORY</Text><Text style={s.hero}>Your research should remember you.</Text><Text style={s.sub}>Sign in to sync decisions, observations, price history and alerts across sessions.</Text><TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={theme.colors.textDim}/><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={theme.colors.textDim}/><TouchableOpacity style={s.primary} disabled={busy} onPress={signIn}><Text style={s.primaryText}>{busy?'Working…':'Sign in'}</Text></TouchableOpacity><TouchableOpacity style={s.secondary} disabled={busy} onPress={signUp}><Text style={s.secondaryText}>Create account</Text></TouchableOpacity></View></ScrollView>;
  }

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={s.header}><View><Text style={s.eyebrow}>ACCOUNT</Text><Text style={s.title}>Your account</Text><Text style={s.sub}>{summary?.user.email ?? 'Signed in'} · Market Memory v2</Text></View><TouchableOpacity onPress={signOut} style={s.signOut}><Text style={s.signOutText}>Sign out</Text></TouchableOpacity></View>

    {error?<TouchableOpacity onPress={refresh} style={s.card}><Text accessibilityRole="alert" style={s.body}>{error}</Text><Text style={s.secondaryText}>Retry</Text></TouchableOpacity>:!summary?<ActivityIndicator color={theme.colors.primary}/>:<>
      <View style={s.grid}>
        <Metric label="Journal" value={summary.stats.journal_entries}/><Metric label="Observations" value={summary.stats.observations}/><Metric label="Snapshots" value={summary.stats.snapshots}/><Metric label="Watchlist" value={summary.stats.watchlist_items}/><Metric label="Active alerts" value={summary.stats.active_alerts}/>
      </View>
      <View style={s.card}><Text style={s.cardTitle}>Market data</Text><Info label="Stocks / ETFs" value={summary.market_data.stocks}/><Info label="Crypto" value={summary.market_data.crypto}/><Info label="Price memory" value={summary.market_data.price_capture}/></View>
      <View style={s.card}><Text style={s.cardTitle}>Understanding recorded prices</Text><Text style={s.body}>Prices may be delayed. Your thought is saved even when a quote is unavailable. History shows the samples captured during use; gaps are expected, and averages are not official market averages.</Text></View>
    </>}
  </ScrollView>;
}

function Metric({label,value}:{label:string;value:number}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Info({label,value}:{label:string;value:string}){return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>}

const s=StyleSheet.create({page:{flex:1,backgroundColor:theme.colors.bg},center:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:16},content:{width:'100%',maxWidth:1040,alignSelf:'center',padding:16},authCard:{width:'100%',maxWidth:480,backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.lg,padding:28},eyebrow:{color:theme.colors.primary,fontSize:11,fontWeight:'900',letterSpacing:1.1},hero:{color:theme.colors.text,fontSize:32,fontWeight:'900',marginTop:8,lineHeight:38},title:{color:theme.colors.text,fontSize:30,fontWeight:'900',marginTop:4},sub:{color:theme.colors.textMuted,marginTop:8,marginBottom:20,lineHeight:20},input:{backgroundColor:theme.colors.panelElevated,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,padding:14,color:theme.colors.text,marginBottom:10},primary:{backgroundColor:theme.colors.primaryStrong,padding:14,borderRadius:theme.radius.sm,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{padding:14,borderRadius:theme.radius.sm,alignItems:'center',marginTop:8,borderWidth:1,borderColor:theme.colors.border},secondaryText:{color:theme.colors.text,fontWeight:'800'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:22},signOut:{borderWidth:1,borderColor:theme.colors.border,paddingHorizontal:14,paddingVertical:10,borderRadius:theme.radius.sm},signOutText:{color:theme.colors.textMuted,fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:12},metric:{minWidth:150,flexGrow:1,backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:18},metricValue:{color:theme.colors.text,fontSize:26,fontWeight:'900'},metricLabel:{color:theme.colors.textMuted,marginTop:4},card:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:20,marginTop:12},cardTitle:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginBottom:12},info:{flexDirection:'row',justifyContent:'space-between',gap:16,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#152338'},infoLabel:{color:theme.colors.textMuted},infoValue:{color:theme.colors.text,fontWeight:'700',textAlign:'right',flexShrink:1},body:{color:theme.colors.textMuted,lineHeight:21}});
