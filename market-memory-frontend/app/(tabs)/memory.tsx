import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../src/services/api';

type Observation={id:number;symbol:string;observation:string;price:number|null;created_at:string};
type Snapshot={id:number;symbol:string;note:string|null;price:number|null;created_at:string};

export default function MemoryScreen(){
  const [obs,setObs]=useState<Observation[]>([]); const [snaps,setSnaps]=useState<Snapshot[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const [o,s]=await Promise.all([apiRequest<Observation[]>('/api/observations'),apiRequest<Snapshot[]>('/api/snapshots')]);setObs(o);setSnaps(s);}catch(e){setError(e instanceof Error?e.message:'Unable to load memory.');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const items=useMemo(()=>[...obs.map(x=>({kind:'Observation',id:`o-${x.id}`,symbol:x.symbol,text:x.observation,price:x.price,at:x.created_at})),...snaps.map(x=>({kind:'Snapshot',id:`s-${x.id}`,symbol:x.symbol,text:x.note||'Market state captured.',price:x.price,at:x.created_at}))].sort((a,b)=>+new Date(b.at)-+new Date(a.at)),[obs,snaps]);
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#60a5fa"/>}><Text style={s.kicker}>REMEMBER</Text><Text style={s.title}>Memory</Text><Text style={s.sub}>What you saw, preserved in time.</Text>{error?<Text style={s.error}>{error}</Text>:null}{!loading&&!error&&!items.length?<Text style={s.empty}>No memory yet. Save an observation or snapshot from Market.</Text>:null}{items.map(item=><View key={item.id} style={s.card}><View style={s.row}><Text style={s.kind}>{item.kind.toUpperCase()}</Text><Text style={s.date}>{new Date(item.at).toLocaleString()}</Text></View><Text style={s.symbol}>{item.symbol}</Text><Text style={s.body}>{item.text}</Text><Text style={s.price}>{item.price!=null?`Price then: ₹${item.price.toLocaleString('en-IN')}`:'Price unavailable'}</Text></View>)}</ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#0f172a'},content:{padding:24},kicker:{color:'#60a5fa',fontSize:11,fontWeight:'900'},title:{color:'#f8fafc',fontSize:30,fontWeight:'900'},sub:{color:'#94a3b8',marginVertical:12},error:{color:'#fca5a5'},empty:{color:'#64748b',marginTop:20},card:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:16,marginBottom:12},row:{flexDirection:'row',justifyContent:'space-between'},kind:{color:'#60a5fa',fontSize:10,fontWeight:'900'},date:{color:'#64748b',fontSize:11},symbol:{color:'#f8fafc',fontSize:20,fontWeight:'900',marginTop:8},body:{color:'#cbd5e1',marginTop:6,lineHeight:20},price:{color:'#94a3b8',marginTop:10,fontSize:12}});
