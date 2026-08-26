import { useCallback, useEffect, useState } from 'react';
import { Alert as RNAlert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiRequest } from '../../src/services/api';

type PriceAlert={id:number;symbol:string;target_price:number;condition:'above'|'below';asset_type:'stock'|'crypto';backend_id:string;currency:string|null;is_active:boolean;last_checked_price:number|null;last_checked_at:string|null;triggered_at:string|null;created_at:string};
type CheckResponse={checked:number;results:Array<{id:number;symbol:string;current_price?:number;target_price?:number;condition?:'above'|'below';triggered:boolean;currency?:string;source?:string;checked_at:string;error?:string}>};

export default function AlertsScreen(){
  const [items,setItems]=useState<PriceAlert[]>([]);
  const [loading,setLoading]=useState(false);
  const [checking,setChecking]=useState(false);

  const load=useCallback(async()=>{setLoading(true);try{setItems(await apiRequest<PriceAlert[]>('/api/alerts'));}catch(e){RNAlert.alert('Alerts',e instanceof Error?e.message:'Unable to load alerts.');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);

  const checkNow=async()=>{
    setChecking(true);
    try{
      const result=await apiRequest<CheckResponse>('/api/alerts/check',{method:'POST'});
      const triggered=result.results.filter(x=>x.triggered);
      await load();
      if(triggered.length){RNAlert.alert('Alert triggered',triggered.map(x=>`${x.symbol} reached ${formatPrice(x.current_price??0,x.currency||'INR')}`).join('\n'));}
      else RNAlert.alert('Alerts checked',`${result.checked} active alert${result.checked===1?'':'s'} checked.`);
    }catch(e){RNAlert.alert('Check failed',e instanceof Error?e.message:'Unable to check alerts.');}
    finally{setChecking(false);}
  };

  const remove=async(id:number)=>{try{await apiRequest(`/api/alerts/${id}`,{method:'DELETE'});await load();}catch(e){RNAlert.alert('Alerts',e instanceof Error?e.message:'Unable to remove alert.');}};

  const activeCount=items.filter(x=>x.is_active).length;
  const triggeredCount=items.filter(x=>!x.is_active&&x.triggered_at).length;

  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#60a5fa"/>}>
    <Text style={s.kicker}>REMEMBER LEVELS</Text><Text style={s.title}>Alerts</Text><Text style={s.sub}>Price alerts are tied to the same market source used by the Market workspace.</Text>
    <View style={s.stats}><View style={s.stat}><Text style={s.statValue}>{activeCount}</Text><Text style={s.statLabel}>Active</Text></View><View style={s.stat}><Text style={s.statValue}>{triggeredCount}</Text><Text style={s.statLabel}>Triggered</Text></View></View>
    <TouchableOpacity style={s.checkBtn} disabled={checking||!activeCount} onPress={checkNow}><Text style={s.btn}>{checking?'Checking…':'Check active alerts now'}</Text></TouchableOpacity>
    <Text style={s.hint}>Create new alerts from the Market tab after selecting an asset.</Text>
    <Text style={s.heading}>Saved alerts</Text>
    {!items.length?<Text style={s.empty}>No alerts yet.</Text>:items.map(x=><View key={x.id} style={[s.card,!x.is_active&&s.triggeredCard]}><View style={s.main}><View style={s.row}><Text style={s.symbol}>{x.symbol}</Text><Text style={[s.status,x.is_active?s.active:s.triggered]}>{x.is_active?'ACTIVE':'TRIGGERED'}</Text></View><Text style={s.body}>{x.condition.toUpperCase()} {formatPrice(x.target_price,x.currency||'INR')}</Text>{x.last_checked_price!=null?<Text style={s.meta}>Last price: {formatPrice(x.last_checked_price,x.currency||'INR')} · {x.last_checked_at?new Date(x.last_checked_at).toLocaleString():''}</Text>:<Text style={s.meta}>Not checked yet</Text>}{x.triggered_at?<Text style={s.triggerText}>Triggered {new Date(x.triggered_at).toLocaleString()}</Text>:null}</View><TouchableOpacity onPress={()=>remove(x.id)}><Text style={s.remove}>Remove</Text></TouchableOpacity></View>)}
  </ScrollView>;
}

function formatPrice(value:number,currency:string){try{return new Intl.NumberFormat('en-IN',{style:'currency',currency,maximumFractionDigits:value<1?6:2}).format(value);}catch{return `${currency} ${value.toLocaleString('en-IN')}`;}}

const s=StyleSheet.create({page:{flex:1,backgroundColor:'#0f172a'},content:{padding:24,maxWidth:880,width:'100%',alignSelf:'center'},kicker:{color:'#60a5fa',fontSize:11,fontWeight:'900'},title:{color:'#f8fafc',fontSize:30,fontWeight:'900'},sub:{color:'#94a3b8',marginVertical:12,lineHeight:20},stats:{flexDirection:'row',gap:10,marginBottom:12},stat:{flex:1,backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:16},statValue:{color:'#f8fafc',fontSize:24,fontWeight:'900'},statLabel:{color:'#64748b',marginTop:2},checkBtn:{backgroundColor:'#2563eb',padding:14,borderRadius:10,alignItems:'center'},btn:{color:'#fff',fontWeight:'800'},hint:{color:'#64748b',fontSize:12,marginTop:10},heading:{color:'#f8fafc',fontSize:18,fontWeight:'800',marginVertical:18},empty:{color:'#64748b'},card:{backgroundColor:'#111827',borderWidth:1,borderColor:'#334155',borderRadius:12,padding:16,marginBottom:10,flexDirection:'row',justifyContent:'space-between',gap:12},triggeredCard:{borderColor:'#166534'},main:{flex:1},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},symbol:{color:'#60a5fa',fontWeight:'900',fontSize:17},status:{fontSize:10,fontWeight:'900'},active:{color:'#fbbf24'},triggered:{color:'#4ade80'},body:{color:'#cbd5e1',marginTop:6},meta:{color:'#64748b',fontSize:11,marginTop:8},triggerText:{color:'#4ade80',fontSize:11,marginTop:4,fontWeight:'700'},remove:{color:'#f87171',fontWeight:'700'}});
