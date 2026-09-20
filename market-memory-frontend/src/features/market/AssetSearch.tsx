import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';

export type Asset = { symbol: string; name: string; asset_type: 'stock' | 'crypto'; backend_id: string; exchange?: string | null };

type Props = {
  onSelect: (asset: Asset) => void;
  onClearSelection?: () => void;
  selected?: Asset | null;
  placeholder?: string;
};

const SUGGESTIONS = ['Reliance', 'TCS', 'Nvidia', 'Bitcoin'];

export function AssetSearch({ onSelect, onClearSelection, selected, placeholder = 'Search company, ticker, or crypto' }: Props) {
  const [query, setQuery] = useState(selected?.name ?? '');
  const [results, setResults] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef(0);

  useEffect(() => {
    if (selected && query === selected.name) return;
    const clean = query.trim();
    const id = ++request.current;
    setMessage('');
    if (clean.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await apiRequest<Asset[]>(`/api/assets/search?q=${encodeURIComponent(clean)}&limit=8`);
        if (id !== request.current) return;
        setResults(rows);
        if (!rows.length) setMessage('No matching asset. Try its ticker symbol.');
      } catch (error) {
        if (id !== request.current) return;
        setResults([]);
        setMessage(error instanceof Error ? error.message : 'Search is temporarily unavailable.');
      } finally {
        if (id === request.current) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); request.current++; };
  }, [query, selected]);

  const choose = (asset: Asset) => {
    request.current++;
    setQuery(asset.name);
    setResults([]);
    setMessage('');
    setLoading(false);
    onSelect(asset);
  };

  return <View>
    <View style={s.searchBox}>
      <TextInput
        accessibilityLabel="Search markets"
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={value => {
          setQuery(value);
          if (selected && value !== selected.name) {
            onClearSelection?.();
            setResults([]);
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textDim}
        style={s.input}
      />
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
    </View>
    {!query.trim() ? <View style={s.suggestions}>{SUGGESTIONS.map(item => <Pressable key={item} onPress={() => setQuery(item)} style={s.chip}><Text style={s.chipText}>{item}</Text></Pressable>)}</View> : null}
    {message ? <Text accessibilityRole="alert" style={s.message}>{message}</Text> : null}
    {results.length ? <View style={s.results}>{results.map(asset => <Pressable accessibilityRole="button" key={`${asset.asset_type}:${asset.backend_id}`} style={s.result} onPress={() => choose(asset)}><View style={s.resultCopy}><Text style={s.symbol}>{asset.symbol}</Text><Text style={s.name}>{asset.name}</Text></View><View style={s.meta}><Text style={s.type}>{asset.asset_type.toUpperCase()}</Text><Text style={s.exchange}>{asset.exchange || ''}</Text></View></Pressable>)}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  searchBox:{minHeight:50,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:theme.colors.panel,borderWidth:1,borderColor:theme.colors.border,borderRadius:12,paddingHorizontal:14},input:{flex:1,color:theme.colors.text,paddingVertical:14,fontSize:16},suggestions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},chip:{borderWidth:1,borderColor:theme.colors.border,borderRadius:999,paddingHorizontal:12,paddingVertical:7},chipText:{color:theme.colors.textMuted,fontSize:12,fontWeight:'700'},message:{color:theme.colors.textMuted,marginTop:10,lineHeight:19},results:{borderWidth:1,borderColor:theme.colors.border,borderRadius:12,overflow:'hidden',marginTop:8},result:{minHeight:58,padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:theme.colors.border,backgroundColor:theme.colors.panelElevated},resultCopy:{flex:1,paddingRight:12},symbol:{color:theme.colors.primary,fontWeight:'900',fontSize:16},name:{color:theme.colors.textMuted,fontSize:12,marginTop:2},meta:{alignItems:'flex-end'},type:{color:theme.colors.primary,fontSize:10,fontWeight:'800'},exchange:{color:theme.colors.textDim,fontSize:11,marginTop:2}
});
