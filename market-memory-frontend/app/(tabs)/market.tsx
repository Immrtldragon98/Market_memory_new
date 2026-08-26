import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../src/services/api';

type AssetType='stock'|'crypto';
type Asset={symbol:string;name:string;asset_type:AssetType;backend_id:string;exchange?:string|null};
type WatchItem={id:number;symbol:string;name:string|null;asset_type:AssetType;backend_id:string|null};
type PriceQuote={price:number;currency:string;source:string};

export default function MarketScreen(){
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Asset[]>([]);
  const [selected,setSelected]=useState<Asset|null>(null);
  const [quote,setQuote]=useState<PriceQuote|null>(null);
  const [note,setNote]=useState('');
  const [watchlist,setWatchlist]=useState<WatchItem[]>([]);
  const [loading,setLoading]=useState(false);
  const [searching,setSearching]=useState(false);
  const [alertPrice,setAlertPrice]=useState('');
  const [condition,setCondition]=useState<'above'|'below'>('above');

  const loadWatchlist=useCallback(async()=>{
    setLoading(true);
    try{setWatchlist(await apiRequest<WatchItem[]>('/api/watchlist'));}
    catch(e){Alert.alert('Watchlist',e instanceof Error?e.message:'Unable to load watchlist.');}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{loadWatchlist();},[loadWatchlist]);

  const search=async()=>{
    const value=query.trim();
    if(value.length<2)return;
    setSearching(true);
    try{setResults(await apiRequest<Asset[]>(`/api/assets/search?q=${encodeURIComponent(value)}`));}
    catch(e){Alert.alert('Search',e instanceof Error?e.message:'Unable to search markets.');}
    finally{setSearching(false);}
  };

  const selectAsset=async(asset:Asset)=>{
    setSelected(asset); setResults([]); setQuery(asset.name); setQuote(null); setAlertPrice('');
    try{
      const q=await apiRequest<PriceQuote>(`/api/assets/price?asset_type=${asset.asset_type}&backend_id=${encodeURIComponent(asset.backend_id)}`);
      setQuote(q); setAlertPrice(String(q.price));
    }catch(e){Alert.alert('Price unavailable',e instanceof Error?e.message:'Unable to load price.');}
  };

  const selectedInWatchlist=useMemo(()=>selected?watchlist.some(x=>x.symbol===selected.symbol&&x.asset_type===selected.asset_type):false,[selected,watchlist]);

  const saveObservation=async()=>{
    if(!selected||!note.trim())return;
    try{
      await apiRequest('/api/observations',{method:'POST',body:JSON.stringify({symbol:selected.symbol,asset_name:selected.name,asset_type:selected.asset_type,backend_id:selected.backend_id,observation:note.trim(),price:quote?.price??null})});
      setNote(''); Alert.alert('Remembered','Observation saved with current market context.');
    }catch(e){Alert.alert('Observation',e instanceof Error?e.message:'Unable to save observation.');}
  };

  const saveSnapshot=async()=>{
    if(!selected)return;
    try{
      await apiRequest('/api/snapshots',{method:'POST',body:JSON.stringify({symbol:selected.symbol,asset_name:selected.name,asset_type:selected.asset_type,backend_id:selected.backend_id,price:quote?.price??null,note:note.trim()||null,market_payload:{currency:quote?.currency??null,source:quote?.source??null,exchange:selected.exchange??null}})});
      setNote(''); Alert.alert('Captured','Immutable market snapshot saved.');
    }catch(e){Alert.alert('Snapshot',e instanceof Error?e.message:'Unable to capture snapshot.');}
  };

  const addWatchlist=async()=>{
    if(!selected||selectedInWatchlist)return;
    try{
      await apiRequest('/api/watchlist',{method:'POST',body:JSON.stringify({symbol:selected.symbol,name:selected.name,asset_type:selected.asset_type,backend_id:selected.backend_id})});
      await loadWatchlist();
    }catch(e){Alert.alert('Watchlist',e instanceof Error?e.message:'Unable to add asset.');}
  };

  const removeWatchlist=async(id:number)=>{try{await apiRequest(`/api/watchlist/${id}`,{method:'DELETE'});await loadWatchlist();}catch(e){Alert.alert('Watchlist',e instanceof Error?e.message:'Unable to remove asset.');}};

  const createAlert=async()=>{
    if(!selected)return;
    const target=Number(alertPrice);
    if(!Number.isFinite(target)||target<=0){Alert.alert('Alert','Enter a valid target price.');return;}
    try{
      await apiRequest('/api/alerts',{method:'POST',body:JSON.stringify({symbol:selected.symbol,target_price:target,condition})});
      Alert.alert('Alert saved',`${selected.symbol} ${condition} ${formatPrice(target,quote?.currency||'INR')}`);
    }catch(e){Alert.alert('Alert',e instanceof Error?e.message:'Unable to create alert.');}
  };

  const refreshSelected=async()=>{if(selected)await selectAsset(selected);await loadWatchlist();};

  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshSelected} tintColor="#60a5fa"/>}>
    <Text style={s.kicker}>OBSERVE</Text><Text style={s.title}>Market</Text><Text style={s.sub}>Find a market, see its current quote, and capture what matters before hindsight changes the story.</Text>

    <View style={s.searchRow}><TextInput style={[s.input,s.searchInput]} value={query} onChangeText={setQuery} onSubmitEditing={search} autoCapitalize="none" placeholder="Search Reliance, Bitcoin, Nvidia…" placeholderTextColor="#64748b"/><TouchableOpacity style={s.searchBtn} onPress={search}><Text style={s.btn}>{searching?'…':'Search'}</Text></TouchableOpacity></View>
    {results.map(asset=><TouchableOpacity key={`${asset.asset_type}:${asset.backend_id}`} style={s.result} onPress={()=>selectAsset(asset)}><View><Text style={s.symbol}>{asset.symbol}</Text><Text style={s.name}>{asset.name}</Text></View><View style={s.resultRight}><Text style={s.type}>{asset.asset_type.toUpperCase()}</Text><Text style={s.exchange}>{asset.exchange||''}</Text></View></TouchableOpacity>)}

    {selected?<View style={s.workspace}>
      <View style={s.assetHeader}><View><Text style={s.symbolLarge}>{selected.symbol}</Text><Text style={s.name}>{selected.name}</Text><Text style={s.exchange}>{selected.exchange||selected.asset_type}</Text></View><View style={s.priceBox}><Text style={s.price}>{quote?formatPrice(quote.price,quote.currency):'--'}</Text><Text style={s.source}>{quote?`${quote.source} · may be delayed`:'Price unavailable'}</Text></View></View>
      <TouchableOpacity style={[s.watchBtn,selectedInWatchlist&&s.watchSaved]} onPress={addWatchlist} disabled={selectedInWatchlist}><Text style={s.btn}>{selectedInWatchlist?'✓ In watchlist':'+ Add to watchlist'}</Text></TouchableOpacity>

      <Text style={s.section}>Capture memory</Text>
      <TextInput style={[s.input,s.note]} value={note} onChangeText={setNote} multiline placeholder="What are you noticing, expecting, or deciding?" placeholderTextColor="#64748b"/>
      <View style={s.row}><TouchableOpacity style={s.primary} onPress={saveObservation}><Text style={s.btn}>Save observation</Text></TouchableOpacity><TouchableOpacity style={s.secondary} onPress={saveSnapshot}><Text style={s.btn}>Capture snapshot</Text></TouchableOpacity></View>

      <Text style={s.section}>Price alert</Text>
      <TextInput style={s.input} value={alertPrice} onChangeText={setAlertPrice} keyboardType="decimal-pad" placeholder="Target price" placeholderTextColor="#64748b"/>
      <View style={s.row}><TouchableOpacity style={[s.pill,condition==='above'&&s.pillActive]} onPress={()=>setCondition('above')}><Text style={s.btn}>Above</Text></TouchableOpacity><TouchableOpacity style={[s.pill,condition==='below'&&s.pillActive]} onPress={()=>setCondition('below')}><Text style={s.btn}>Below</Text></TouchableOpacity><TouchableOpacity style={s.alertBtn} onPress={createAlert}><Text style={s.btn}>Create alert</Text></TouchableOpacity></View>
    </View>:null}

    <Text style={s.heading}>Watchlist</Text>
    {!watchlist.length?<Text style={s.empty}>No saved markets yet.</Text>:watchlist.map(item=><View key={item.id} style={s.card}><TouchableOpacity style={s.watchMain} onPress={()=>selectAsset({symbol:item.symbol,name:item.name||item.symbol,asset_type:item.asset_type,backend_id:item.backend_id||item.symbol})}><Text style={s.symbol}>{item.symbol}</Text><Text style={s.name}>{item.name||item.asset_type}</Text></TouchableOpacity><TouchableOpacity onPress={()=>removeWatchlist(item.id)}><Text style={s.remove}>Remove</Text></TouchableOpacity></View>)}
  </ScrollView>;
}

function formatPrice(value:number,currency:string){try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:value<1?6:2}).format(value);}catch{return `${currency} ${value.toLocaleString('en-IN')}`;}}

const s=StyleSheet.create({page:{flex:1,backgroundColor:'#0f172a'},content:{padding:24,maxWidth:960,width:'100%',alignSelf:'center'},kicker:{color:'#60a5fa',fontSize:11,fontWeight:'900'},title:{color:'#f8fafc',fontSize:30,fontWeight:'900',marginTop:4},sub:{color:'#94a3b8',marginVertical:12,lineHeight:20},searchRow:{flexDirection:'row',gap:8},searchInput:{flex:1},searchBtn:{backgroundColor:'#2563eb',paddingHorizontal:20,borderRadius:10,justifyContent:'center',marginBottom:10},input:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:10,padding:14,color:'#f8fafc',marginBottom:10},result:{backgroundColor:'#111827',borderWidth:1,borderColor:'#1e293b',padding:14,borderRadius:10,marginBottom:7,flexDirection:'row',justifyContent:'space-between'},resultRight:{alignItems:'flex-end'},symbol:{color:'#60a5fa',fontWeight:'900',fontSize:17},symbolLarge:{color:'#f8fafc',fontWeight:'900',fontSize:28},name:{color:'#cbd5e1',fontSize:12,marginTop:2},type:{color:'#60a5fa',fontSize:10,fontWeight:'800'},exchange:{color:'#64748b',fontSize:11,marginTop:3},workspace:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:16,padding:18,marginTop:12},assetHeader:{flexDirection:'row',justifyContent:'space-between',gap:16},priceBox:{alignItems:'flex-end'},price:{color:'#f8fafc',fontSize:24,fontWeight:'900'},source:{color:'#64748b',fontSize:10,marginTop:3},watchBtn:{backgroundColor:'#1d4ed8',alignSelf:'flex-start',paddingHorizontal:14,paddingVertical:10,borderRadius:9,marginTop:16},watchSaved:{backgroundColor:'#166534'},section:{color:'#f8fafc',fontSize:16,fontWeight:'800',marginTop:22,marginBottom:10},note:{minHeight:120,textAlignVertical:'top'},row:{flexDirection:'row',gap:8},primary:{flex:1,backgroundColor:'#2563eb',padding:14,borderRadius:10,alignItems:'center'},secondary:{flex:1,backgroundColor:'#1e293b',padding:14,borderRadius:10,alignItems:'center'},pill:{backgroundColor:'#1e293b',paddingHorizontal:16,paddingVertical:13,borderRadius:10},pillActive:{backgroundColor:'#1d4ed8'},alertBtn:{flex:1,backgroundColor:'#7c3aed',padding:14,borderRadius:10,alignItems:'center'},btn:{color:'#fff',fontWeight:'800'},heading:{color:'#f8fafc',fontSize:18,fontWeight:'800',marginVertical:18},empty:{color:'#64748b'},card:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:14,marginBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},watchMain:{flex:1},remove:{color:'#f87171',fontWeight:'700'}});
