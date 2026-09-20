import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

type Summary = {
  user: { id: string; email?: string | null };
  stats: { observations: number; snapshots: number; journal_entries: number; watchlist_items: number; active_alerts: number };
  market_data: { stocks: string; crypto: string; price_capture: string };
};
type Notice = { kind: 'error' | 'success' | 'info'; text: string } | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'marketmemory://account';
}

function friendlyAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes('email not confirmed')) return 'Confirm your email first, then return here and sign in.';
  if (value.includes('invalid login credentials')) return 'Incorrect email or password. Check both and try again.';
  if (value.includes('user already registered')) return 'An account already exists for this email. Sign in or reset your password.';
  if (value.includes('rate limit')) return 'Too many attempts. Wait a few minutes, then try again.';
  return message;
}

export function AccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) { setNotice({ kind: 'error', text: friendlyAuthError(error.message) }); return; }
    const active = Boolean(data.session);
    setSignedIn(active);
    if (!active) { setSummary(null); return; }
    try { setSummary(await apiRequest<Summary>('/api/account/summary')); }
    catch (requestError) {
      setSummary(null);
      setNotice({ kind: 'error', text: requestError instanceof Error ? requestError.message : 'Unable to load your account. Please retry.' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const validate = (needsPassword = true) => {
    if (!emailPattern.test(normalizedEmail)) { setNotice({ kind: 'error', text: 'Enter a valid email address.' }); return false; }
    if (needsPassword && password.length < 6) { setNotice({ kind: 'error', text: 'Password must contain at least 6 characters.' }); return false; }
    return true;
  };

  const run = async (action: string, work: () => Promise<void>) => {
    setBusyAction(action); setNotice(null);
    try { await work(); }
    catch (error) { setNotice({ kind: 'error', text: friendlyAuthError(error instanceof Error ? error.message : 'Something went wrong. Please try again.') }); }
    finally { setBusyAction(null); }
  };

  const signIn = async () => {
    if (!validate()) return;
    await run('sign-in', async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;
      setNotice({ kind: 'success', text: 'Signed in successfully.' });
    });
  };

  const signUp = async () => {
    if (!validate()) return;
    await run('sign-up', async () => {
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      setNotice(data.session
        ? { kind: 'success', text: 'Account created and signed in.' }
        : { kind: 'info', text: `Account created. Open the confirmation email sent to ${normalizedEmail}, confirm it, then return here and sign in.` });
    });
  };

  const resendConfirmation = async () => {
    if (!validate(false)) return;
    await run('resend', async () => {
      const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: authRedirectUrl() } });
      if (error) throw error;
      setNotice({ kind: 'success', text: `Confirmation email resent to ${normalizedEmail}. Check spam if it does not arrive.` });
    });
  };

  const resetPassword = async () => {
    if (!validate(false)) return;
    await run('reset', async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: authRedirectUrl() });
      if (error) throw error;
      setNotice({ kind: 'success', text: `Password reset email sent to ${normalizedEmail}.` });
    });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setNotice({ kind: 'error', text: friendlyAuthError(error.message) });
  };

  if (!signedIn) {
    const busy = busyAction !== null;
    return <ScrollView style={s.page} contentContainerStyle={s.center} keyboardShouldPersistTaps="handled"><View style={s.authCard}>
      <Text style={s.eyebrow}>PRIVATE MARKET MEMORY</Text><Text style={s.hero}>Your research should remember you.</Text><Text style={s.sub}>Sign in to sync decisions, observations, price history and alerts across sessions.</Text>
      {notice && <View accessibilityRole="alert" style={[s.notice, notice.kind === 'error' ? s.noticeError : notice.kind === 'success' ? s.noticeSuccess : s.noticeInfo]}><Text style={s.noticeText}>{notice.text}</Text></View>}
      <Text style={s.label}>Email address</Text><TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" placeholder="you@example.com" placeholderTextColor={theme.colors.textDim}/>
      <Text style={s.label}>Password</Text><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" placeholder="At least 6 characters" placeholderTextColor={theme.colors.textDim}/>
      <TouchableOpacity style={[s.primary, busy && s.disabled]} disabled={busy} onPress={signIn}><Text style={s.primaryText}>{busyAction === 'sign-in' ? 'Signing in…' : 'Sign in'}</Text></TouchableOpacity>
      <TouchableOpacity style={[s.secondary, busy && s.disabled]} disabled={busy} onPress={signUp}><Text style={s.secondaryText}>{busyAction === 'sign-up' ? 'Creating account…' : 'Create account'}</Text></TouchableOpacity>
      <View style={s.helpRow}><TouchableOpacity disabled={busy} onPress={resendConfirmation}><Text style={s.link}>{busyAction === 'resend' ? 'Sending…' : 'Resend confirmation'}</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={resetPassword}><Text style={s.link}>{busyAction === 'reset' ? 'Sending…' : 'Forgot password?'}</Text></TouchableOpacity></View>
      <Text style={s.hint}>New accounts must confirm their email before the first sign-in.</Text>
    </View></ScrollView>;
  }

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={s.header}><View><Text style={s.eyebrow}>ACCOUNT</Text><Text style={s.title}>Your account</Text><Text style={s.sub}>{summary?.user.email ?? 'Signed in'} · Market Memory v2</Text></View><TouchableOpacity onPress={signOut} style={s.signOut}><Text style={s.signOutText}>Sign out</Text></TouchableOpacity></View>
    {notice?.kind === 'error' ? <TouchableOpacity onPress={refresh} style={s.card}><Text accessibilityRole="alert" style={s.body}>{notice.text}</Text><Text style={s.secondaryText}>Retry</Text></TouchableOpacity> : !summary ? <ActivityIndicator color={theme.colors.primary}/> : <>
      <View style={s.grid}><Metric label="Journal" value={summary.stats.journal_entries}/><Metric label="Observations" value={summary.stats.observations}/><Metric label="Snapshots" value={summary.stats.snapshots}/><Metric label="Watchlist" value={summary.stats.watchlist_items}/><Metric label="Active alerts" value={summary.stats.active_alerts}/></View>
      <View style={s.card}><Text style={s.cardTitle}>Market data</Text><Info label="Stocks / ETFs" value={summary.market_data.stocks}/><Info label="Crypto" value={summary.market_data.crypto}/><Info label="Price memory" value={summary.market_data.price_capture}/></View>
      <View style={s.card}><Text style={s.cardTitle}>Understanding recorded prices</Text><Text style={s.body}>Prices may be delayed. Your thought is saved even when a quote is unavailable. History shows the samples captured during use; gaps are expected, and averages are not official market averages.</Text></View>
    </>}
  </ScrollView>;
}

function Metric({label,value}:{label:string;value:number}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function Info({label,value}:{label:string;value:string}){return <View style={s.info}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue}>{value}</Text></View>}

const s=StyleSheet.create({page:{flex:1,backgroundColor:theme.colors.bg},center:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:16},content:{width:'100%',maxWidth:1040,alignSelf:'center',padding:16},authCard:{width:'100%',maxWidth:480,backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.lg,padding:28},eyebrow:{color:theme.colors.primary,fontSize:11,fontWeight:'900',letterSpacing:1.1},hero:{color:theme.colors.text,fontSize:32,fontWeight:'900',marginTop:8,lineHeight:38},title:{color:theme.colors.text,fontSize:30,fontWeight:'900',marginTop:4},sub:{color:theme.colors.textMuted,marginTop:8,marginBottom:20,lineHeight:20},label:{color:theme.colors.textMuted,fontSize:12,fontWeight:'700',marginBottom:6},input:{backgroundColor:theme.colors.panelElevated,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,padding:14,color:theme.colors.text,marginBottom:12},primary:{backgroundColor:theme.colors.primaryStrong,padding:14,borderRadius:theme.radius.sm,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{padding:14,borderRadius:theme.radius.sm,alignItems:'center',marginTop:8,borderWidth:1,borderColor:theme.colors.border},secondaryText:{color:theme.colors.text,fontWeight:'800'},disabled:{opacity:.55},notice:{borderWidth:1,borderRadius:theme.radius.sm,padding:12,marginBottom:16},noticeError:{backgroundColor:'#311821',borderColor:'#7f3347'},noticeSuccess:{backgroundColor:'#123027',borderColor:'#2f765d'},noticeInfo:{backgroundColor:'#14283c',borderColor:'#315878'},noticeText:{color:theme.colors.text,lineHeight:19},helpRow:{flexDirection:'row',justifyContent:'space-between',gap:16,marginTop:16},link:{color:theme.colors.primary,fontWeight:'700',fontSize:13},hint:{color:theme.colors.textDim,fontSize:12,lineHeight:18,marginTop:14},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:22},signOut:{borderWidth:1,borderColor:theme.colors.border,paddingHorizontal:14,paddingVertical:10,borderRadius:theme.radius.sm},signOutText:{color:theme.colors.textMuted,fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:12},metric:{minWidth:150,flexGrow:1,backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:18},metricValue:{color:theme.colors.text,fontSize:26,fontWeight:'900'},metricLabel:{color:theme.colors.textMuted,marginTop:4},card:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:20,marginTop:12},cardTitle:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginBottom:12},info:{flexDirection:'row',justifyContent:'space-between',gap:16,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#152338'},infoLabel:{color:theme.colors.textMuted},infoValue:{color:theme.colors.text,fontWeight:'700',textAlign:'right',flexShrink:1},body:{color:theme.colors.textMuted,lineHeight:21}});
