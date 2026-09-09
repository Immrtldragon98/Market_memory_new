import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { theme } from '../../shared/theme/tokens';
import { dayAfter, validDay } from './reviewDates';

export type ReviewableEntry = { id: number; review_due_on?: string | null; lesson?: string | null; reviewed_at?: string | null };
export function ReviewActions({ entry, onSaved }: { entry: ReviewableEntry; onSaved: (entry: ReviewableEntry) => void }) {
  const [lesson, setLesson] = useState('');
  const [due, setDue] = useState(entry.review_due_on || '');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  async function submit(complete: boolean) {
    if (pending.current) return;
    if (complete && !lesson.trim()) { setMessage('Write what you learned before completing this review.'); return; }
    if (!complete && due && !validDay(due)) { setMessage('Use a valid date in YYYY-MM-DD format.'); return; }
    pending.current = true; setBusy(true); setMessage('');
    try {
      const updated = await apiRequest<ReviewableEntry>(`/api/journal/${entry.id}/${complete ? 'review' : 'schedule'}`, {
        method: complete ? 'POST' : 'PATCH',
        body: JSON.stringify(complete ? { lesson: lesson.trim() } : { review_due_on: due || null }),
      });
      onSaved(updated);
      setMessage(complete ? 'Review completed. Your original thought is preserved.' : 'Review date saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save. Your draft is still here.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (entry.reviewed_at) return <View style={s.box}><Text style={s.title}>What you learned</Text><Text style={s.body}>{entry.lesson}</Text><Text style={s.body}>Reviewed {new Date(entry.reviewed_at).toLocaleString()}</Text></View>;
  return <View style={s.box}>
    <Text style={s.title}>Return to this thought</Text>
    <Text style={s.body}>Review date (your local calendar)</Text>
    <TextInput accessibilityLabel="Review date" style={s.input} value={due} onChangeText={setDue} placeholder="YYYY-MM-DD · optional" placeholderTextColor={theme.colors.textMuted} maxLength={10} />
    <View style={s.row}>{[7, 30, 90].map(days => <Pressable key={days} style={s.secondary} onPress={() => setDue(dayAfter(days))}><Text style={s.link}>In {days} days</Text></Pressable>)}</View>
    <Pressable disabled={busy} style={s.secondary} onPress={() => void submit(false)}><Text style={s.link}>{busy ? 'Saving…' : due ? 'Save review date' : 'Remove review date'}</Text></Pressable>
    <Text style={s.title}>What changed? What did you learn?</Text>
    <Text style={s.body}>Compare the evidence with your original reasoning. A rising price alone does not prove a good decision.</Text>
    <TextInput accessibilityLabel="Review lesson" multiline maxLength={5000} style={[s.input, s.note]} value={lesson} onChangeText={setLesson} placeholder="What would you repeat or do differently?" placeholderTextColor={theme.colors.textMuted} />
    <Pressable disabled={busy || !lesson.trim()} style={[s.primary, (busy || !lesson.trim()) && s.disabled]} onPress={() => void submit(true)}><Text style={s.buttonText}>{busy ? 'Saving…' : 'Save lesson & complete review'}</Text></Pressable>
    {message ? <Text accessibilityRole="alert" style={s.body}>{message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  box: { marginTop: 20, gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' }, body: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 22 },
  input: { color: theme.colors.text, backgroundColor: theme.colors.panelElevated, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border }, note: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, secondary: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10 },
  link: { color: theme.colors.primary }, primary: { minHeight: 44, padding: 14, borderRadius: 10, backgroundColor: theme.colors.primaryStrong }, buttonText: { color: '#fff', fontWeight: '700' }, disabled: { opacity: 0.5 },
});
