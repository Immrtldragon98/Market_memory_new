import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../src/services/api';

export default function MarketScreen() {
  const [symbol, setSymbol] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');

  const payload = () => ({ symbol: symbol.trim().toUpperCase(), asset_type: 'stock', observation: note.trim(), price: price ? Number(price) : null });

  const saveObservation = async () => {
    if (!symbol.trim() || !note.trim()) return;
    try { await apiRequest('/api/observations', { method: 'POST', body: JSON.stringify(payload()) }); setNote(''); Alert.alert('Remembered', 'Observation saved.'); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Unable to save.'); }
  };

  const saveSnapshot = async () => {
    if (!symbol.trim()) return;
    const body = { symbol: symbol.trim().toUpperCase(), asset_type: 'stock', price: price ? Number(price) : null, note: note.trim() || null, market_payload: { manual_capture: true } };
    try { await apiRequest('/api/snapshots', { method: 'POST', body: JSON.stringify(body) }); setNote(''); Alert.alert('Captured', 'Immutable market snapshot saved.'); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Unable to capture.'); }
  };

  return <View style={s.page}><Text style={s.kicker}>OBSERVE</Text><Text style={s.title}>Market</Text><Text style={s.sub}>Capture what matters before hindsight changes the story.</Text><TextInput style={s.input} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" placeholder="Symbol e.g. RELIANCE" placeholderTextColor="#64748b" /><TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Current price (optional)" placeholderTextColor="#64748b" /><TextInput style={[s.input,s.note]} value={note} onChangeText={setNote} multiline placeholder="What are you noticing?" placeholderTextColor="#64748b" /><TouchableOpacity style={s.primary} onPress={saveObservation}><Text style={s.btn}>Save observation</Text></TouchableOpacity><TouchableOpacity style={s.secondary} onPress={saveSnapshot}><Text style={s.btn}>Capture snapshot</Text></TouchableOpacity></View>;
}

const s=StyleSheet.create({page:{flex:1,backgroundColor:'#0f172a',padding:24},kicker:{color:'#60a5fa',fontSize:11,fontWeight:'900'},title:{color:'#f8fafc',fontSize:30,fontWeight:'900',marginTop:4},sub:{color:'#94a3b8',marginVertical:12},input:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:10,padding:14,color:'#f8fafc',marginBottom:10},note:{minHeight:120,textAlignVertical:'top'},primary:{backgroundColor:'#2563eb',padding:14,borderRadius:10,alignItems:'center'},secondary:{backgroundColor:'#1e293b',padding:14,borderRadius:10,alignItems:'center',marginTop:10},btn:{color:'#fff',fontWeight:'800'}});
