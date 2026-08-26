import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../src/services/api';

type Observation={id:number;symbol:string;observation:string;price:number|null;created_at:string};
type Snapshot={id:number;symbol:string;note:string|null;price:number|null;created_at:string};
type JournalEntry={id:number;symbol:string;title:string;note:string;confidence:number|null;created_at:string};
type ReviewItem={kind:'Observation'|'Snapshot'|'Decision';id:string;symbol:string;text:string;price:number|null;at:string;meta?:string};

export default function MemoryScreen(){
  const [obs,setObs]=useState<Observation[]>([]);
  const [snaps,setSnaps]=useState<Snapshot[]>([]);
  const [journal,setJournal]=useState<JournalEntry[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selectedSymbol,setSelectedSymbol]=useState<string>('ALL');

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const [o,s,j]=await Promise.all([
        apiRequest<Observation[]>('/api/observations'),
        apiRequest<Snapshot[]>('/api/snapshots'),
        apiRequest<JournalEntry[]>('/api/journal'),
      ]);
      setObs(o); setSnaps(s); setJournal(j);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load memory.');}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const items=useMemo<ReviewItem[]>(()=>[
    ...obs.map(x=>({kind:'Observation' as const,id:`o-${x.id}`,symbol:x.symbol,text:x.observation,price:x.price,at:x.created_at})),
    ...snaps.map(x=>({kind:'Snapshot' as const,id:`s-${x.id}`,symbol:x.symbol,text:x.note||'Market state captured.',price:x.price,at:x.created_at})),
    ...journal.map(x=>({kind:'Decision' as const,id:`j-${x.id}`,symbol:x.symbol,text:`${x.title}: ${x.note}`,price:null,at:x.created_at,meta:x.confidence!=null?`Confidence ${x.confidence}/10`:undefined})),
  ].sort((a,b)=>+new Date(b.at)-+new Date(a.at)),[obs,snaps,journal]);

  const symbols=useMemo(()=>['ALL',...Array.from(new Set(items.map(x=>x.symbol))).sort()],[items]);
  const filtered=useMemo(()=>selectedSymbol==='ALL'?items:items.filter(x=>x.symbol===selectedSymbol),[items,selectedSymbol]);

  const summary=useMemo(()=>{
    const source=selectedSymbol==='ALL'?items:filtered;
    return {
      observations:source.filter(x=>x.kind==='Observation').length,
      snapshots:source.filter(x=>x.kind==='Snapshot').length,
      decisions:source.filter(x=>x.kind==='Decision').length,
    };
  },[items,filtered,selectedSymbol]);

  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#60a5fa"/>}>
    <Text style={s.kicker}>REVIEW</Text>
    <Text style={s.title}>Memory</Text>
    <Text style={s.sub}>Reconstruct what you saw, recorded, and decided — in the order it actually happened.</Text>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      {symbols.map(symbol=><TouchableOpacity key={symbol} onPress={()=>setSelectedSymbol(symbol)} style={[s.filter,selectedSymbol===symbol&&s.filterActive]}><Text style={[s.filterText,selectedSymbol===symbol&&s.filterTextActive]}>{symbol}</Text></TouchableOpacity>)}
    </ScrollView>

    <View style={s.summaryRow}>
      <View style={s.summaryCard}><Text style={s.summaryValue}>{summary.observations}</Text><Text style={s.summaryLabel}>Observations</Text></View>
      <View style={s.summaryCard}><Text style={s.summaryValue}>{summary.snapshots}</Text><Text style={s.summaryLabel}>Snapshots</Text></View>
      <View style={s.summaryCard}><Text style={s.summaryValue}>{summary.decisions}</Text><Text style={s.summaryLabel}>Decisions</Text></View>
    </View>

    {selectedSymbol!=='ALL'?<View style={s.reviewBanner}><Text style={s.reviewTitle}>{selectedSymbol} review</Text><Text style={s.reviewText}>This timeline shows only the information you saved for {selectedSymbol}, helping you compare earlier observations with later decisions without hindsight rewriting the story.</Text></View>:null}

    {error?<Text style={s.error}>{error}</Text>:null}
    {!loading&&!error&&!filtered.length?<Text style={s.empty}>No memory yet. Save an observation, snapshot, or journal decision first.</Text>:null}

    {filtered.map(item=><View key={item.id} style={s.card}>
      <View style={s.row}><Text style={s.kind}>{item.kind.toUpperCase()}</Text><Text style={s.date}>{new Date(item.at).toLocaleString()}</Text></View>
      <Text style={s.symbol}>{item.symbol}</Text>
      <Text style={s.body}>{item.text}</Text>
      {item.meta?<Text style={s.meta}>{item.meta}</Text>:null}
      {item.kind!=='Decision'?<Text style={s.price}>{item.price!=null?`Price then: ₹${item.price.toLocaleString('en-IN')}`:'Price unavailable'}</Text>:null}
    </View>)}
  </ScrollView>;
}

const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#0f172a'}, content:{padding:24}, kicker:{color:'#60a5fa',fontSize:11,fontWeight:'900'}, title:{color:'#f8fafc',fontSize:30,fontWeight:'900'}, sub:{color:'#94a3b8',marginTop:6,marginBottom:14,lineHeight:20},
  filters:{gap:8,paddingVertical:4,paddingBottom:14}, filter:{borderWidth:1,borderColor:'#334155',backgroundColor:'#111827',paddingHorizontal:12,paddingVertical:8,borderRadius:999}, filterActive:{borderColor:'#2563eb',backgroundColor:'#172554'}, filterText:{color:'#94a3b8',fontWeight:'700'}, filterTextActive:{color:'#93c5fd'},
  summaryRow:{flexDirection:'row',gap:10,marginBottom:14}, summaryCard:{flex:1,backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:12}, summaryValue:{color:'#f8fafc',fontSize:20,fontWeight:'900'}, summaryLabel:{color:'#64748b',fontSize:11,marginTop:2},
  reviewBanner:{backgroundColor:'#111827',borderLeftWidth:3,borderLeftColor:'#2563eb',borderRadius:10,padding:14,marginBottom:14}, reviewTitle:{color:'#f8fafc',fontWeight:'900'}, reviewText:{color:'#94a3b8',marginTop:5,lineHeight:19},
  error:{color:'#fca5a5'}, empty:{color:'#64748b',marginTop:20}, card:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:16,marginBottom:12}, row:{flexDirection:'row',justifyContent:'space-between',gap:12}, kind:{color:'#60a5fa',fontSize:10,fontWeight:'900'}, date:{color:'#64748b',fontSize:11}, symbol:{color:'#f8fafc',fontSize:20,fontWeight:'900',marginTop:8}, body:{color:'#cbd5e1',marginTop:6,lineHeight:20}, meta:{color:'#a5b4fc',marginTop:9,fontSize:12,fontWeight:'700'}, price:{color:'#94a3b8',marginTop:10,fontSize:12}
});
