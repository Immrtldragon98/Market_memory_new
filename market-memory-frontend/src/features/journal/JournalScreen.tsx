import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

type Asset={symbol:string;name:string;asset_type:'stock'|'crypto';backend_id:string;exchange?:string|null};
type Entry={id:number;symbol:string;title:string;note:string;confidence:number|null;created_at:string;asset_id?:number|null;entry_price_sample_id?:number|null};
type HistoryPoint={period_start:string;avg_price:number;min_price:number;max_price:number;sample_count:number};
type Review={entry:Entry;entry_price?:{price:number;currency:string;sampled_at:string}|null;range:string;history:HistoryPoint[]};
type Range='7d'|'30d'|'90d'|'1y'|'5y';

export function JournalScreen(){
  const [entries,setEntries]=useState<Entry[]>([]);
  const [assetQuery,setAssetQuery]=useState('');
  const [results,setResults]=useState<Asset[]>([]);
  const [selectedAsset,setSelectedAsset]=useState<Asset|null>(null);
  const [title,setTitle]=useState('');
  const [note,setNote]=useState('');
  const [confidence,setConfidence]=useState('5');
  const [loading,setLoading]=useState(false);
  const [review,setReview]=useState<Review|null>(null);
  const [range,setRange]=useState<Range>('7d');
  const searchSeq=useRef(0);

  const load=useCallback(async()=>{setLoading(true);try{setEntries(await apiRequest<Entry[]>('/api/journal'));}catch(e){Alert.alert('Journal',e instanceof Error?e.message:'Unable to load journal.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);

  useEffect(()=>{
    const q=assetQuery.trim();
    if(selectedAsset && q===selectedAsset.name)return;
    if(q.length<2){setResults([]);return;}
    const seq=++searchSeq.current;
    const timer=setTimeout(async()=>{
      try{
        const rows=await apiRequest<Asset[]>(`/api/assets/search?q=${encodeURIComponent(q)}&limit=8`);
        if(seq===searchSeq.current)setResults(rows.slice(0,8));
      }catch{}
    },300);
    return()=>clearTimeout(timer);
  },[assetQuery,selectedAsset]);

  const save=async()=>{
    if(!selectedAsset||!title.trim()||!note.trim())return;
    try{
      await apiRequest('/api/journal',{method:'POST',body:JSON.stringify({symbol:selectedAsset.symbol,asset_name:selectedAsset.name,asset_type:selectedAsset.asset_type,backend_id:selectedAsset.backend_id,exchange:selectedAsset.exchange??null,title:title.trim(),note:note.trim(),confidence:Number(confidence)||5,mistake:false})});
      setTitle('');setNote('');await load();
      Alert.alert('Decision saved','Entry price was captured when market data was available.');
    }catch(e){Alert.alert('Journal',e instanceof Error?e.message:'Unable to save decision.');}
  };

  const openReview=async(entry:Entry,nextRange:Range=range)=>{
    if(!entry.asset_id){Alert.alert('Legacy entry','This older journal row has no canonical asset link yet. New entries will support price review automatically.');return;}
    try{setReview(await apiRequest<Review>(`/api/journal/${entry.id}/review?range=${nextRange}`));setRange(nextRange);}catch(e){Alert.alert('Review',e instanceof Error?e.message:'Unable to load price history.');}
  };

  const summary=useMemo(()=>{
    if(!review?.history.length)return null;
    const first=review.history[0].avg_price;
    const last=review.history[review.history.length-1].avg_price;
    const entry=review.entry_price?.price??first;
    return {last,change:entry?((last-entry)/entry)*100:0,entry};
  },[review]);

  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><View><Text style={s.eyebrow}>DECIDE → REVIEW</Text><Text style={s.title}>Journal</Text><Text style={s.sub}>Record why you acted, then let Market Memory preserve what price did afterward.</Text></View><View style={s.count}><Text style={s.countValue}>{entries.length}</Text><Text style={s.countLabel}>decisions</Text></View></View>

    <View style={s.compose}>
      <Text style={s.sectionTitle}>New decision</Text>
      <TextInput style={s.input} value={assetQuery} onChangeText={(v)=>{setAssetQuery(v);setSelectedAsset(null);}} placeholder="Search asset — only top results are shown" placeholderTextColor={theme.colors.textDim}/>
      {results.length>0?<View style={s.results}>{results.map(asset=><Pressable key={`${asset.asset_type}:${asset.backend_id}`} style={s.result} onPress={()=>{setSelectedAsset(asset);setAssetQuery(asset.name);setResults([]);}}><View><Text style={s.resultSymbol}>{asset.symbol}</Text><Text style={s.resultName}>{asset.name}</Text></View><Text style={s.resultType}>{asset.asset_type.toUpperCase()}</Text></Pressable>)}</View>:null}
      {selectedAsset?<View style={s.selected}><Text style={s.selectedSymbol}>{selectedAsset.symbol}</Text><Text style={s.selectedName}>{selectedAsset.name} · {selectedAsset.exchange||selectedAsset.asset_type}</Text></View>:null}
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Decision / idea" placeholderTextColor={theme.colors.textDim}/>
      <TextInput style={[s.input,s.note]} value={note} onChangeText={setNote} multiline placeholder="Why? What must happen? What could make you wrong?" placeholderTextColor={theme.colors.textDim}/>
      <View style={s.row}><TextInput style={[s.input,s.confidence]} value={confidence} onChangeText={setConfidence} keyboardType="number-pad" placeholder="Confidence 1–10" placeholderTextColor={theme.colors.textDim}/><TouchableOpacity style={[s.primary,!selectedAsset&&s.disabled]} disabled={!selectedAsset} onPress={save}><Text style={s.primaryText}>Save decision + price</Text></TouchableOpacity></View>
    </View>

    {review?<View style={s.reviewCard}>
      <View style={s.reviewHeader}><View><Text style={s.eyebrow}>PRICE MEMORY</Text><Text style={s.reviewTitle}>{review.entry.symbol} · {review.entry.title}</Text></View><TouchableOpacity onPress={()=>setReview(null)}><Text style={s.close}>Close</Text></TouchableOpacity></View>
      <View style={s.rangeRow}>{(['7d','30d','90d','1y','5y'] as Range[]).map(r=><Pressable key={r} style={[s.range,r===range&&s.rangeActive]} onPress={()=>void openReview(review.entry,r)}><Text style={[s.rangeText,r===range&&s.rangeTextActive]}>{r.toUpperCase()}</Text></Pressable>)}</View>
      {summary?<View style={s.metrics}><Metric label="Entry" value={formatPrice(summary.entry,review.entry_price?.currency||'INR')}/><Metric label="Latest avg" value={formatPrice(summary.last,review.entry_price?.currency||'INR')}/><Metric label="Since entry" value={`${summary.change>=0?'+':''}${summary.change.toFixed(2)}%`} accent={summary.change>=0?'good':'bad'}/></View>:<Text style={s.empty}>Not enough sampled price history yet. Open/use the app over time and this fills automatically.</Text>}
      <View style={s.historyHeader}><Text style={s.historyHead}>Period</Text><Text style={s.historyHead}>Average</Text><Text style={s.historyHead}>Range</Text></View>
      {review.history.slice(-14).map(point=><View key={point.period_start} style={s.historyRow}><Text style={s.historyCell}>{formatPeriod(point.period_start,range)}</Text><Text style={s.historyCell}>{formatNumber(point.avg_price)}</Text><Text style={s.historyCell}>{formatNumber(point.min_price)}–{formatNumber(point.max_price)}</Text></View>)}
    </View>:null}

    <View style={s.listHeader}><Text style={s.sectionTitle}>Past decisions</Text><Text style={s.muted}>{loading?'Refreshing…':'Tap a linked entry to review price history'}</Text></View>
    {entries.map(entry=><Pressable key={entry.id} style={s.entryCard} onPress={()=>void openReview(entry)}><View style={s.entryTop}><Text style={s.entrySymbol}>{entry.symbol}</Text><Text style={s.entryDate}>{new Date(entry.created_at).toLocaleDateString()}</Text></View><Text style={s.entryTitle}>{entry.title}</Text><Text style={s.entryNote} numberOfLines={2}>{entry.note}</Text><View style={s.entryBottom}><Text style={s.muted}>Confidence {entry.confidence??'—'}</Text><Text style={[s.link, !entry.asset_id&&s.muted]}>{entry.asset_id?'Review price →':'Legacy entry'}</Text></View></Pressable>)}
  </ScrollView>;
}

function Metric({label,value,accent}:{label:string;value:string;accent?:'good'|'bad'}){return <View style={s.metric}><Text style={[s.metricValue,accent==='good'&&s.good,accent==='bad'&&s.bad]}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function formatNumber(v:number){return Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});}
function formatPrice(v:number,currency:string){try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:v<1?6:2}).format(v);}catch{return `${currency} ${formatNumber(v)}`;}}
function formatPeriod(v:string,range:Range){const d=new Date(v);return range==='1y'?d.toLocaleDateString(undefined,{month:'short',year:'2-digit'}):range==='5y'?String(d.getFullYear()):d.toLocaleDateString(undefined,{day:'2-digit',month:'short'});}

const s=StyleSheet.create({page:{flex:1,backgroundColor:theme.colors.bg},content:{width:'100%',maxWidth:1120,alignSelf:'center',padding:24},header:{flexDirection:'row',justifyContent:'space-between',gap:16,alignItems:'flex-start',marginBottom:18},eyebrow:{color:theme.colors.primary,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:32,fontWeight:'900',marginTop:4},sub:{color:theme.colors.textMuted,marginTop:7,lineHeight:20,maxWidth:720},count:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,paddingHorizontal:18,paddingVertical:12,alignItems:'center'},countValue:{color:theme.colors.text,fontSize:22,fontWeight:'900'},countLabel:{color:theme.colors.textMuted,fontSize:11},compose:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.lg,padding:20},sectionTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},input:{backgroundColor:theme.colors.panelElevated,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,padding:14,color:theme.colors.text,marginTop:10},note:{minHeight:110,textAlignVertical:'top'},results:{borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,overflow:'hidden',marginTop:4},result:{padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#17263a',backgroundColor:theme.colors.panelElevated},resultSymbol:{color:theme.colors.primary,fontWeight:'900'},resultName:{color:theme.colors.textMuted,fontSize:12,marginTop:2},resultType:{color:theme.colors.textDim,fontSize:10,fontWeight:'800'},selected:{backgroundColor:'#10284a',borderRadius:theme.radius.sm,padding:12,marginTop:8},selectedSymbol:{color:theme.colors.primary,fontWeight:'900'},selectedName:{color:theme.colors.textMuted,fontSize:12,marginTop:2},row:{flexDirection:'row',gap:10,alignItems:'stretch'},confidence:{width:170},primary:{flex:1,backgroundColor:theme.colors.primaryStrong,borderRadius:theme.radius.sm,alignItems:'center',justifyContent:'center',marginTop:10,padding:14},disabled:{opacity:.4},primaryText:{color:'#fff',fontWeight:'900'},reviewCard:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:'#34527a',borderRadius:theme.radius.lg,padding:20,marginTop:16},reviewHeader:{flexDirection:'row',justifyContent:'space-between',gap:12},reviewTitle:{color:theme.colors.text,fontSize:20,fontWeight:'900',marginTop:4},close:{color:theme.colors.textMuted,fontWeight:'800'},rangeRow:{flexDirection:'row',gap:8,marginTop:16,flexWrap:'wrap'},range:{paddingHorizontal:13,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:theme.colors.border},rangeActive:{backgroundColor:theme.colors.primaryStrong,borderColor:theme.colors.primaryStrong},rangeText:{color:theme.colors.textMuted,fontSize:11,fontWeight:'800'},rangeTextActive:{color:'#fff'},metrics:{flexDirection:'row',gap:10,flexWrap:'wrap',marginTop:16},metric:{flexGrow:1,minWidth:180,backgroundColor:theme.colors.panelElevated,borderRadius:theme.radius.md,padding:16},metricValue:{color:theme.colors.text,fontSize:20,fontWeight:'900'},metricLabel:{color:theme.colors.textMuted,fontSize:11,marginTop:4},good:{color:theme.colors.success},bad:{color:theme.colors.danger},historyHeader:{flexDirection:'row',marginTop:18,paddingBottom:8,borderBottomWidth:1,borderBottomColor:theme.colors.border},historyHead:{flex:1,color:theme.colors.textDim,fontSize:10,fontWeight:'900'},historyRow:{flexDirection:'row',paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#152338'},historyCell:{flex:1,color:theme.colors.textMuted,fontSize:12},empty:{color:theme.colors.textMuted,marginTop:16},listHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginTop:24,marginBottom:10},muted:{color:theme.colors.textDim,fontSize:11},entryCard:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:16,marginBottom:10},entryTop:{flexDirection:'row',justifyContent:'space-between'},entrySymbol:{color:theme.colors.primary,fontWeight:'900'},entryDate:{color:theme.colors.textDim,fontSize:11},entryTitle:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginTop:8},entryNote:{color:theme.colors.textMuted,lineHeight:19,marginTop:5},entryBottom:{flexDirection:'row',justifyContent:'space-between',marginTop:12},link:{color:theme.colors.primary,fontSize:11,fontWeight:'800'}});
