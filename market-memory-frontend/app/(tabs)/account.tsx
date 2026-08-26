import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function AccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    Alert.alert(error ? 'Sign in failed' : 'Signed in', error?.message ?? 'Your Market Memory session is ready.');
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    Alert.alert(error ? 'Sign up failed' : 'Account created', error?.message ?? 'Check your email if confirmation is enabled.');
  };

  return <View style={s.page}><Text style={s.title}>Account</Text><Text style={s.sub}>Sign in to keep your market memory private.</Text><TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#64748b" /><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#64748b" /><TouchableOpacity style={s.primary} disabled={busy} onPress={signIn}><Text style={s.btn}>{busy ? 'Working…' : 'Sign in'}</Text></TouchableOpacity><TouchableOpacity style={s.secondary} disabled={busy} onPress={signUp}><Text style={s.btn}>Create account</Text></TouchableOpacity></View>;
}

const s = StyleSheet.create({ page:{flex:1,backgroundColor:'#0f172a',padding:24},title:{color:'#f8fafc',fontSize:30,fontWeight:'900'},sub:{color:'#94a3b8',marginVertical:12},input:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:10,padding:14,color:'#f8fafc',marginBottom:10},primary:{backgroundColor:'#2563eb',padding:14,borderRadius:10,alignItems:'center'},secondary:{backgroundColor:'#1e293b',padding:14,borderRadius:10,alignItems:'center',marginTop:10},btn:{color:'#fff',fontWeight:'800'}});
