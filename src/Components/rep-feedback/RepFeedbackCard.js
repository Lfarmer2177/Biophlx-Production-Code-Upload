import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, useColorScheme } from 'react-native';
import { bandRating, combinedRating } from './repFeedback';

export default function RepFeedbackCard({ reps }) {
  const [selected, setSelected] = useState(null);
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#FFFFFF' : '#202024', muted = dark ? '#C5C5CB' : '#606066';
  const latest = reps[reps.length - 1];
  const rep = reps.find(r => r.id === selected) || latest;
  const metric = (value, unit) => value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(1)} ${unit}`;
  const score = r => r?.available ? combinedRating(bandRating(r.primaryRom, r.target1), bandRating(r.secondaryRom, r.target2)) : null;
  const band = (label, data, target, available, number) => {
    const rating = available ? bandRating(data?.rom, target) : null;
    return <View key={number} style={{ marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: dark ? '#303034' : '#F5F5F7' }}>
      <Text style={{ color: ink, fontSize: 18, fontWeight: '700' }}>{label || `Band ${number}`} rating</Text>
      <Text style={{ color: muted }}>Band {number}</Text>
      <Text style={{ color: ink, fontSize: 32, fontWeight: '800', marginTop: 8 }}>{rating == null ? 'Not rated' : `${rating} / 100`}</Text>
      {rating != null && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: rating }} style={{ height: 8, borderRadius: 4, backgroundColor: dark ? '#55555A' : '#DDDEE2', marginVertical: 10 }}><View style={{ height: 8, width: `${rating}%`, borderRadius: 4, backgroundColor: '#D71920' }} /></View>}
      <Text style={{ color: muted, lineHeight: 23 }}>Range of motion: {available ? metric(data?.rom, '°') : '—'}{target > 0 ? ` / ${target}° target` : ''}{'\n'}Rep duration: {available ? metric(data?.tut, 's') : '—'}{'\n'}Velocity: {available ? metric(data?.velocity, 'm/s') : '—'}</Text>
      <Text style={{ color: muted, marginTop: 8 }}>{!available ? 'Waiting for this band’s rep measurement.' : rating == null ? 'No valid range measurement or exercise target.' : 'Range-target rating, capped at 100.'}</Text>
    </View>;
  };
  return <View style={{ padding: 20, borderRadius: 20, backgroundColor: dark ? '#202024' : '#FFFFFF', borderWidth: 1, borderColor: dark ? '#414147' : '#E4E4E7', marginVertical: 12 }}>
    <Text style={{ color: ink, fontWeight: '700', fontSize: 20 }}>Your rep performance</Text>
    {!rep ? <Text style={{ color: muted, marginTop: 12 }}>Complete a rep to see a separate rating and metrics for each band.</Text> : <>
      <Text accessibilityLiveRegion="polite" style={{ color: muted, marginTop: 12 }}>Set {rep.setNo} · Rep {rep.repIndex}{rep === latest ? ' · Latest' : ''}</Text>
      {band(rep.band1Label, rep.primaryMetrics, rep.target1, rep.primaryAvailable, 1)}
      {band(rep.band2Label, rep.secondaryMetrics, rep.target2, !!rep.secondaryMetrics, 2)}
      <Text style={{ color: ink, fontWeight: '700', marginTop: 16 }}>Combined summary score: {score(rep) == null ? 'Not rated' : `${score(rep).toFixed(1)} / 100`}</Text>
      <Text style={{ color: muted, marginTop: 8, lineHeight: 20 }}>The combined score averages both band ratings. Each rating compares range with its own exercise target; it is not an overall form or safety assessment.</Text>
    </>}
    <ScrollView horizontal style={{ marginTop: 14 }} accessibilityLabel="Completed rep history">
      {reps.map(r => <Pressable key={r.id} onPress={() => setSelected(r.id)} accessibilityRole="button" accessibilityState={{ selected: r === rep }} style={{ minHeight: 48, padding: 12, marginRight: 8, borderRadius: 10, backgroundColor: r === rep ? '#D71920' : dark ? '#343438' : '#F2F2F4' }}><Text style={{ color: r === rep ? '#FFFFFF' : ink }}>S{r.setNo} R{r.repIndex}</Text></Pressable>)}
    </ScrollView>
    {selected && <Pressable onPress={() => setSelected(null)} accessibilityRole="button" style={{ paddingVertical: 14 }}><Text style={{ color: dark ? '#FF777D' : '#B51018' }}>Follow latest rep</Text></Pressable>}
  </View>;
}
