import { ReviewActions } from './ReviewActions';
import { localDay, dayAfter, validDay } from './reviewDates';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

type Asset={symbol:string;name:string;asset_type:'stock'|'crypto';backend_id:string;exchange?:string|null};
type Entry={id:number;symbol:string;title:string;note:string;confidence:number|null;created_at:string;asset_id?:number|null;entry_price_sample_id?:number|null;entry_type?:'observation'|'decision';decision_action?:string|null;invalidation?:string|null;review_due_on?:string|null;lesson?:string|null;reviewed_at?:string|null};
type HistoryPoint={period_start:string;avg_price:number;min_price:number;max_price:number;sample_count:number};
type PriceSample={price:number;currency:string;sampled_at:string};
type Review={latest_price?:PriceSample|null;entry:Entry;entry_price?:{price:number;currency:string;sampled_at:string}|null;range:string;history:HistoryPoint[]};
type Range='7d'|'30d'|'90d'|'1y'|'5y';

export function JournalScreen(){
  const params=useLocalSearchParams<{entry?:string}>();
  const [view,setView]=useState<'all'|'due'|'reviewed'>('all');
  const [hasMore,setHasMore]=useState(false);
  const loadSeq=useRef(0);
  const [entryType,setEntryType]=useState<'observation'|'decision'>('observation');
  const [action,setAction]=useState<string>('wait');
  const [invalidation,setInvalidation]=useState('');
  const [due,setDue]=useState('');
  const [composing,setComposing]=useState(false);
  const [saving,setSaving]=useState(false);
  const savingRef=useRef(false);
  const [message,setMessage]=useState('');
  const [searchError,setSearchError]=useState('');
  const [reviewLoading,setReviewLoading]=useState(false);
  const reviewSeq=useRef(0);
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

  const load=useCallback(async(offset=0)=>{
    const seq=++loadSeq.current;
    setLoading(true);
    try{
      const rows=await apiRequest<Entry[]>(`/api/journal?view=${view}&as_of=${localDay()}&limit=50&offset=${offset}`);
      if(seq!==loadSeq.current)return;
      setEntries(previous=>offset ? [...previous,...rows.filter(row=>!previous.some(item=>item.id===row.id))] : rows);
      setHasMore(rows.length===50);
    }catch(e){if(seq===loadSeq.current){if(!offset)setEntries([]);setMessage(e instanceof Error?e.message:'Unable to load journal.');}}
    finally{if(seq===loadSeq.current)setLoading(false);}
  },[view]);
  useFocusEffect(useCallback(()=>{
    setReview(null);void load();
    const seq=++reviewSeq.current;
    const id=Number(params.entry);
    if(Number.isSafeInteger(id)&&id>0){
      setReviewLoading(true);
      apiRequest<Review>(`/api/journal/${id}/review?range=7d`).then(next=>{
        if(seq===reviewSeq.current){setReview(next);setRange('7d');}
      }).catch(e=>{if(seq===reviewSeq.current)setMessage(e instanceof Error?e.message:'Unable to open thought.');})
        .finally(()=>{if(seq===reviewSeq.current)setReviewLoading(false);});
    }
    return()=>{loadSeq.current++;reviewSeq.current++;};
  },[load,params.entry]));

  useEffect(()=>{
    const seq=++searchSeq.current;
    setSearchError('');
    const q=assetQuery.trim();
    if(selectedAsset && q===selectedAsset.name)return;
    if(q.length<2){setResults([]);return;}
    const timer=setTimeout(async()=>{
      try{
        const rows=await apiRequest<Asset[]>(`/api/assets/search?q=${encodeURIComponent(q)}&limit=8`);
        if(seq===searchSeq.current)setResults(rows.slice(0,8));
      }catch{if(seq===searchSeq.current){setResults([]);setSearchError('Search unavailable. Please try again.');}}
    },300);
    return()=>{clearTimeout(timer);searchSeq.current++;};
  },[assetQuery,selectedAsset]);

  const save=async()=>{
    if(savingRef.current||!selectedAsset||!note.trim())return;
    if(due&&!validDay(due)){setMessage('Use a valid review date in YYYY-MM-DD format.');return;}
    const score=Number(confidence);
    if(!Number.isInteger(score)||score<1||score>10){setMessage('Confidence must be a whole number from 1 to 10.');return;}
    savingRef.current=true;setSaving(true);setMessage('');
    try{
      const saved=await apiRequest<Entry>('/api/journal',{method:'POST',body:JSON.stringify({symbol:selectedAsset.symbol,asset_name:selectedAsset.name,asset_type:selectedAsset.asset_type,backend_id:selectedAsset.backend_id,exchange:selectedAsset.exchange??null,title:title.trim()||note.trim().slice(0,80),note:note.trim(),confidence:score,mistake:false,entry_type:entryType,decision_action:entryType==='decision'?action:null,invalidation:invalidation.trim()||null,review_due_on:due||null})});
      setTitle('');setNote('');setInvalidation('');setDue('');setComposing(false);await load();
      setMessage(saved.entry_price_sample_id?'Thought saved with a recorded price.':'Thought saved. Original price is unavailable.');
    }catch(e){setMessage(e instanceof Error?e.message:'Unable to save thought. Your draft is still here.');}
    finally{savingRef.current=false;setSaving(false);}
  };

  const openReview=async(entry:Entry,nextRange:Range=range)=>{
    const seq=++reviewSeq.current;
    setReviewLoading(true);
    try{
      const next=await apiRequest<Review>(`/api/journal/${entry.id}/review?range=${nextRange}`);
      if(seq===reviewSeq.current){setReview(next);setRange(nextRange);}
    }catch(e){if(seq===reviewSeq.current)setMessage(e instanceof Error?e.message:'Unable to load review.');}
    finally{if(seq===reviewSeq.current)setReviewLoading(false);}
  };

  const summary=useMemo(()=>{
    const original=review?.entry_price;
    const latest=review?.latest_price;
    if(!original||!latest||original.currency!==latest.currency||original.price<=0)return null;
    return {entry:original.price,last:latest.price,change:((latest.price-original.price)/original.price)*100};
  },[review]);

  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><View><Text style={s.eyebrow}>DECIDE → REVIEW</Text><Text style={s.title}>Journal</Text><Text style={s.sub}>Your thinking, preserved. Return to it with fresh evidence.</Text></View><View style={s.count}><Text style={s.countValue}>{entries.length}</Text><Text style={s.countLabel}>loaded thoughts</Text></View></View>

    {message?<Text accessibilityRole="alert" style={s.empty}>{message}</Text>:null}
    <TouchableOpacity accessibilityRole="button" style={s.primary} onPress={()=>setComposing(!composing)}><Text style={s.primaryText}>{composing?'Keep draft and close':'+ Record a thought'}</Text></TouchableOpacity>
    {composing?<View style={s.compose}>
      <Text style={s.sectionTitle}>Record a thought</Text>
      <View style={s.rangeRow}>{(['observation','decision'] as const).map(kind=><Pressable key={kind} accessibilityRole="button" accessibilityState={{selected:entryType===kind}} style={[s.range,entryType===kind&&s.rangeActive]} onPress={()=>setEntryType(kind)}><Text style={s.rangeTextActive}>{kind==='observation'?'Observation':'Decision'}</Text></Pressable>)}</View>
      {entryType==='decision'?<View style={s.rangeRow}>{['buy','sell','hold','wait','avoid'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:action===value}} style={[s.range,action===value&&s.rangeActive]} onPress={()=>setAction(value)}><Text style={s.rangeTextActive}>{value}</Text></Pressable>)}</View>:null}
      <TextInput style={s.input} value={assetQuery} onChangeText={(v)=>{setAssetQuery(v);setSelectedAsset(null);}} placeholder="Search asset — only top results are shown" placeholderTextColor={theme.colors.textDim}/>
      {searchError?<Text accessibilityRole="alert" style={s.empty}>{searchError}</Text>:null}
      {results.length>0?<View style={s.results}>{results.map(asset=><Pressable key={`${asset.asset_type}:${asset.backend_id}`} style={s.result} onPress={()=>{searchSeq.current++;setSelectedAsset(asset);setAssetQuery(asset.name);setResults([]);}}><View><Text style={s.resultSymbol}>{asset.symbol}</Text><Text style={s.resultName}>{asset.name}</Text></View><Text style={s.resultType}>{asset.asset_type.toUpperCase()}</Text></Pressable>)}</View>:null}
      {selectedAsset?<View style={s.selected}><Text style={s.selectedSymbol}>{selectedAsset.symbol}</Text><Text style={s.selectedName}>{selectedAsset.name} · {selectedAsset.exchange||selectedAsset.asset_type}</Text></View>:null}
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Title (optional)" placeholderTextColor={theme.colors.textDim}/>
      <TextInput style={[s.input,s.note]} value={note} onChangeText={setNote} multiline placeholder="Why? What must happen? What could make you wrong?" placeholderTextColor={theme.colors.textDim}/>
      <Text style={s.entryNote}>What would change your mind? (optional)</Text>
      <TextInput accessibilityLabel="Evidence that would change your mind" style={s.input} value={invalidation} onChangeText={setInvalidation} maxLength={2000} placeholder="What evidence would challenge this thought?" placeholderTextColor={theme.colors.textMuted}/>
      <Text style={s.entryNote}>Review date (optional, YYYY-MM-DD)</Text>
      <TextInput accessibilityLabel="New thought review date" style={s.input} value={due} onChangeText={setDue} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted}/>
      <View style={s.rangeRow}>{[7,30,90].map(days=><Pressable key={days} style={s.range} onPress={()=>setDue(dayAfter(days))}><Text style={s.rangeText}>In {days} days</Text></Pressable>)}</View>
      <Text style={s.entryNote}>Confidence (1–10)</Text>
      <View style={s.row}><TextInput style={[s.input,s.confidence]} value={confidence} onChangeText={setConfidence} keyboardType="number-pad" placeholder="Confidence 1–10" placeholderTextColor={theme.colors.textDim}/><TouchableOpacity style={[s.primary,(!selectedAsset||!note.trim()||saving)&&s.disabled]} disabled={!selectedAsset||!note.trim()||saving} onPress={save}><Text style={s.primaryText}>{saving?'Saving…':'Save thought'}</Text></TouchableOpacity></View>
    </View>:null}

    {reviewLoading?<Text style={s.empty}>Loading review…</Text>:null}
    {review?<View style={s.reviewCard}>
      <View style={s.reviewHeader}><View><Text style={s.eyebrow}>PRICE MEMORY</Text><Text style={s.reviewTitle}>{review.entry.symbol} · {review.entry.title}</Text></View><TouchableOpacity onPress={()=>{reviewSeq.current++;setReview(null);setReviewLoading(false);}}><Text style={s.close}>Close</Text></TouchableOpacity></View>
      <Text style={s.muted}>{review.entry.entry_type||'decision'}{review.entry.decision_action?` · ${review.entry.decision_action}`:''}</Text>
      <Text style={s.entryNote}>{review.entry.note}</Text>
      {review.entry.invalidation?<Text style={s.entryNote}>Evidence that would change your mind: {review.entry.invalidation}</Text>:null}
      <Text style={s.muted}>Recorded {new Date(review.entry.created_at).toLocaleString()}</Text>
      <View style={s.rangeRow}>{(['7d','30d','90d','1y','5y'] as Range[]).map(r=><Pressable key={r} style={[s.range,r===range&&s.rangeActive]} onPress={()=>void openReview(review.entry,r)}><Text style={[s.rangeText,r===range&&s.rangeTextActive]}>{r.toUpperCase()}</Text></Pressable>)}</View>
      {summary?<View style={s.metrics}><Metric label="Original recorded price" value={formatPrice(summary.entry,review.entry_price?.currency||'INR')}/><Metric label="Latest recorded price" value={formatPrice(summary.last,review.entry_price?.currency||'INR')}/><Metric label="Price change since recording" value={`${summary.change>=0?'+':''}${summary.change.toFixed(2)}%`} /></View>:<Text style={s.empty}>A comparison needs an original price and a later recorded price in the same currency. Missing prices are never estimated.</Text>}
      {review.latest_price?<Text style={s.muted}>Latest capture: {new Date(review.latest_price.sampled_at).toLocaleString()} · quote may be delayed</Text>:null}
      <Text style={s.empty}>Average of recorded samples · gaps mean no captures. These are not official market averages or investment returns.</Text>
      <View style={s.historyHeader}><Text style={s.historyHead}>Period</Text><Text style={s.historyHead}>Average</Text><Text style={s.historyHead}>Range</Text></View>
      {review.history.slice(-14).map(point=><View key={point.period_start} style={s.historyRow}><Text style={s.historyCell}>{formatPeriod(point.period_start,range)}</Text><Text style={s.historyCell}>{formatNumber(point.avg_price)}</Text><Text style={s.historyCell}>{formatNumber(point.min_price)}–{formatNumber(point.max_price)}</Text></View>)}
      <ReviewActions key={review.entry.id} entry={review.entry} onSaved={updated=>{setReview(current=>current&&current.entry.id===updated.id?{...current,entry:{...current.entry,...updated}}:current);void load();}}/>
    </View>:null}

    <View style={s.rangeRow}>{(['all','due','reviewed'] as const).map(filter=><Pressable key={filter} accessibilityRole="button" accessibilityState={{selected:view===filter}} style={[s.range,view===filter&&s.rangeActive]} onPress={()=>setView(filter)}><Text style={s.rangeTextActive}>{filter==='all'?'All thoughts':filter==='due'?'Reviews due':'Reviewed'}</Text></Pressable>)}</View>
    <View style={s.listHeader}><Text style={s.sectionTitle}>Saved thoughts</Text><Text style={s.muted}>{loading?'Refreshing…':'Select a thought to revisit your reasoning'}</Text></View>
    {!loading&&!entries.length?<Text style={s.empty}>{view==='due'?'No reviews due. Add a review date to a thought to bring it back here.':view==='reviewed'?'Completed reviews and lessons will appear here.':'Start with one thought about an asset. What do you expect?'}</Text>:null}
    {entries.map(entry=><Pressable key={entry.id} style={s.entryCard} onPress={()=>void openReview(entry)}><View style={s.entryTop}><Text style={s.entrySymbol}>{entry.symbol}</Text><Text style={s.entryDate}>{new Date(entry.created_at).toLocaleDateString()}</Text></View><Text style={s.muted}>{entry.reviewed_at?'Reviewed':entry.review_due_on?`Review ${entry.review_due_on}`:'No review date'} · {entry.entry_type||'decision'}</Text><Text style={s.entryTitle}>{entry.title}</Text><Text style={s.entryNote} numberOfLines={2}>{entry.note}</Text><View style={s.entryBottom}><Text style={s.muted}>Confidence {entry.confidence??'—'}</Text><Text style={[s.link, !entry.asset_id&&s.muted]}>{entry.asset_id?'Review thought →':'Read thought →'}</Text></View></Pressable>)}
    {hasMore?<TouchableOpacity disabled={loading} style={s.primary} onPress={()=>void load(entries.length)}><Text style={s.primaryText}>{loading?'Loading…':'Load more thoughts'}</Text></TouchableOpacity>:null}
  </ScrollView>;
}

function Metric({label,value,accent}:{label:string;value:string;accent?:'good'|'bad'}){return <View style={s.metric}><Text style={[s.metricValue,accent==='good'&&s.good,accent==='bad'&&s.bad]}>{value}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function formatNumber(v:number){return Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});}
function formatPrice(v:number,currency:string){try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:v<1?6:2}).format(v);}catch{return `${currency} ${formatNumber(v)}`;}}
function formatPeriod(v:string,range:Range){const d=new Date(v);return range==='1y'?d.toLocaleDateString(undefined,{month:'short',year:'2-digit'}):range==='5y'?String(d.getFullYear()):d.toLocaleDateString(undefined,{day:'2-digit',month:'short'});}

const s=StyleSheet.create({page:{flex:1,backgroundColor:theme.colors.bg},content:{width:'100%',maxWidth:1120,alignSelf:'center',padding:16},header:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:16,alignItems:'flex-start',marginBottom:18},eyebrow:{color:theme.colors.primary,fontSize:10,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:28,fontWeight:'900',marginTop:4},sub:{color:theme.colors.textMuted,marginTop:7,lineHeight:20,maxWidth:720},count:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,paddingHorizontal:18,paddingVertical:12,alignItems:'center'},countValue:{color:theme.colors.text,fontSize:22,fontWeight:'900'},countLabel:{color:theme.colors.textMuted,fontSize:11},compose:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.lg,padding:20},sectionTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},input:{backgroundColor:theme.colors.panelElevated,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,padding:14,color:theme.colors.text,marginTop:10},note:{minHeight:110,textAlignVertical:'top'},results:{borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.sm,overflow:'hidden',marginTop:4},result:{padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#17263a',backgroundColor:theme.colors.panelElevated},resultSymbol:{color:theme.colors.primary,fontWeight:'900'},resultName:{color:theme.colors.textMuted,fontSize:12,marginTop:2},resultType:{color:theme.colors.textDim,fontSize:10,fontWeight:'800'},selected:{backgroundColor:'#10284a',borderRadius:theme.radius.sm,padding:12,marginTop:8},selectedSymbol:{color:theme.colors.primary,fontWeight:'900'},selectedName:{color:theme.colors.textMuted,fontSize:12,marginTop:2},row:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'stretch'},confidence:{width:100},primary:{flex:1,backgroundColor:theme.colors.primaryStrong,borderRadius:theme.radius.sm,alignItems:'center',justifyContent:'center',marginTop:10,padding:14},disabled:{opacity:.4},primaryText:{color:'#fff',fontWeight:'900'},reviewCard:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:'#34527a',borderRadius:theme.radius.lg,padding:20,marginTop:16},reviewHeader:{flexDirection:'row',justifyContent:'space-between',gap:12},reviewTitle:{color:theme.colors.text,fontSize:20,fontWeight:'900',marginTop:4},close:{color:theme.colors.textMuted,fontWeight:'800'},rangeRow:{flexDirection:'row',gap:8,marginTop:16,flexWrap:'wrap'},range:{paddingHorizontal:13,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:theme.colors.border},rangeActive:{backgroundColor:theme.colors.primaryStrong,borderColor:theme.colors.primaryStrong},rangeText:{color:theme.colors.textMuted,fontSize:11,fontWeight:'800'},rangeTextActive:{color:'#fff'},metrics:{flexDirection:'row',gap:10,flexWrap:'wrap',marginTop:16},metric:{flexGrow:1,minWidth:180,backgroundColor:theme.colors.panelElevated,borderRadius:theme.radius.md,padding:16},metricValue:{color:theme.colors.text,fontSize:20,fontWeight:'900'},metricLabel:{color:theme.colors.textMuted,fontSize:11,marginTop:4},good:{color:theme.colors.success},bad:{color:theme.colors.danger},historyHeader:{flexDirection:'row',marginTop:18,paddingBottom:8,borderBottomWidth:1,borderBottomColor:theme.colors.border},historyHead:{flex:1,color:theme.colors.textDim,fontSize:10,fontWeight:'900'},historyRow:{flexDirection:'row',paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#152338'},historyCell:{flex:1,color:theme.colors.textMuted,fontSize:12},empty:{color:theme.colors.textMuted,marginTop:16},listHeader:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between',alignItems:'baseline',marginTop:24,marginBottom:10},muted:{color:theme.colors.textDim,fontSize:11},entryCard:{backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,padding:16,marginBottom:10},entryTop:{flexDirection:'row',justifyContent:'space-between'},entrySymbol:{color:theme.colors.primary,fontWeight:'900'},entryDate:{color:theme.colors.textDim,fontSize:11},entryTitle:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginTop:8},entryNote:{color:theme.colors.textMuted,lineHeight:19,marginTop:5},entryBottom:{flexDirection:'row',justifyContent:'space-between',marginTop:12},link:{color:theme.colors.primary,fontSize:11,fontWeight:'800'}});
