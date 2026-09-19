import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, useColorScheme } from 'react-native';
import { bandRating, combinedRating } from './repFeedback';

export default function RepFeedbackCard({ reps }) {
  const brandTheme = useBIOPHLXTheme();

  const [selected, setSelected] = useState(null);
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '#FFFFFF' : '#202024', muted = dark ? '#C5C5CB' : '#606066';
  const latest = reps[reps.length - 1];
  const rep = reps.find(r => r.id === selected) || latest;
  const metric = (value, unit) => value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(1)} ${unit}`;
  const score = r => r?.available ? combinedRating(bandRating(r.primaryRom), bandRating(r.secondaryRom)) : null;
  const band = (label, data, available, number) => {
    const rating = available ? bandRating(data?.rom) : null;
    return <View key={number} style={brandTheme.style({ marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: dark ? '#303034' : '#F5F5F7' })}>
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: ink, fontSize: 18, fontWeight: '700' })]}>{label || `Band ${number}`} rating</Text>
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted })]}>Band {number}</Text>
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: ink, fontSize: 32, fontWeight: '800', marginTop: 8 })]}>{rating == null ? 'Not rated' : `${rating} / 100`}</Text>
      {rating != null && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: rating }} style={brandTheme.style({ height: 8, borderRadius: 4, backgroundColor: dark ? '#55555A' : '#DDDEE2', marginVertical: 10 })}><View style={brandTheme.style({ height: 8, width: `${rating}%`, borderRadius: 4, backgroundColor: '#D71920' })} /></View>}
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted, lineHeight: 23 })]}>Range of motion: {available ? metric(data?.rom, '°') : '—'}{'\n'}Rep duration: {available ? metric(data?.tut, 's') : '—'}{'\n'}Velocity: {available ? metric(data?.velocity, 'm/s') : '—'}</Text>
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted, marginTop: 8 })]}>{!available ? 'Waiting for this band’s rep measurement.' : rating == null ? 'No valid range measurement.' : 'ROM score: 0 through 90°, 50 above 90°, 100 above 120°.'}</Text>
    </View>;
  };
  return <View style={brandTheme.style({ padding: 20, borderRadius: 20, backgroundColor: dark ? '#202024' : '#FFFFFF', borderWidth: 1, borderColor: dark ? '#414147' : '#E4E4E7', marginVertical: 12 })}>
    <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: ink, fontWeight: '700', fontSize: 20 })]}>Your rep performance</Text>
    {!rep ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted, marginTop: 12 })]}>Complete a rep to see a separate rating and metrics for each band.</Text> : <>
      <Text accessibilityLiveRegion="polite" style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted, marginTop: 12 })]}>Set {rep.setNo} · Rep {rep.repIndex}{rep === latest ? ' · Latest' : ''}</Text>
      {band(rep.band1Label, rep.primaryMetrics, rep.primaryAvailable, 1)}
      {band(rep.band2Label, rep.secondaryMetrics, !!rep.secondaryMetrics, 2)}
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: ink, fontWeight: '700', marginTop: 16 })]}>Combined summary score: {score(rep) == null ? 'Not rated' : `${score(rep)} / 100`}</Text>
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: muted, marginTop: 8, lineHeight: 20 })]}>The saved score is the average of both band ratings. Ratings use the same ROM scoring rule for every exercise; they are not an overall form or safety assessment.</Text>
    </>}
    <ScrollView horizontal style={brandTheme.style({ marginTop: 14 })} accessibilityLabel="Completed rep history">
      {reps.map(r => <Pressable key={r.id} onPress={() => setSelected(r.id)} accessibilityRole="button" accessibilityState={{ selected: r === rep }} style={brandTheme.style({ minHeight: 48, padding: 12, marginRight: 8, borderRadius: 10, backgroundColor: r === rep ? '#D71920' : dark ? '#343438' : '#F2F2F4' })}><Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: r === rep ? '#FFFFFF' : ink })]}>S{r.setNo} R{r.repIndex}</Text></Pressable>)}
    </ScrollView>
    {selected && <Pressable onPress={() => setSelected(null)} accessibilityRole="button" style={brandTheme.style({ paddingVertical: 14 })}><Text style={[{color:brandTheme.colors.text}, brandTheme.style({ color: dark ? '#FF777D' : '#B51018' })]}>Follow latest rep</Text></Pressable>}
  </View>;
}
