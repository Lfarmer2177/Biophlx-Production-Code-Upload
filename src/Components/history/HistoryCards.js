import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import { groupRepSets, scoreTier, validScore } from './historyMetrics';
import { MOVEMENT_METRICS, repMovement, summarizeMovement, validMeasurement } from './movementMetrics';

const tones = { green: ['#DCFCE7', '#166534'], yellow: ['#FEF3C7', '#854D0E'], orange: ['#FFEDD5', '#9A3412'], red: ['#FEE2E2', '#991B1B'], unrated: ['#E5E7EB', '#374151'] };
export function ScoreBadge({ score, small = false }) {
  const value = validScore(score), [backgroundColor, color] = tones[scoreTier(value == null ? null : Math.round(value))];
  return <View accessibilityLabel={value == null ? 'ROM score unavailable' : `ROM score ${Math.round(value)} out of 100`} style={{ backgroundColor, borderRadius: 14, paddingVertical: small ? 8 : 12, paddingHorizontal: 14, minWidth: 70, alignItems: 'center' }}>
    <Text style={{ color, fontSize: small ? 20 : 28, fontWeight: '800' }}>{value == null ? '—' : Math.round(value)}</Text>
    <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{value == null ? 'Unavailable' : 'ROM / 100'}</Text>
  </View>;
}

function MetricTiles({ data }) {
  const { colors } = useBIOPHLXTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
    {MOVEMENT_METRICS.map(({ key, label, unit, digits }) => {
      const value = validMeasurement(data?.[key]);
      return <View key={key} style={{ flexGrow: 1, flexBasis: 120, padding: 12, borderRadius: 12, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 5 }}>{value == null ? 'Not recorded' : `${value.toFixed(digits)} ${unit}`}</Text>
      </View>;
    })}
  </View>;
}

function MetricMeans({ summary, total, rep = false }) {
  const { colors } = useBIOPHLXTheme();
  return <View style={{ gap: 8, marginVertical: 12 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{rep ? 'Comparable band means' : 'Set movement means'}</Text>
    {MOVEMENT_METRICS.map(({ key, label, unit, digits }) => {
      const metric = summary[key], value = rep ? metric.value : metric.mean;
      return <View key={key} style={{ paddingVertical: 6 }}>
        <Text style={{ color: colors.text }}>{label}: {value == null ? 'Unavailable' : `${value.toFixed(digits)} ${unit}`}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{rep ? (metric.reason || '2 / 2 valid, comparable bands') : `${metric.count} / ${total} comparable reps · ${metric.excluded} excluded`}</Text>
      </View>;
    })}
  </View>;
}

function RepCard({ rep }) {
  const { colors } = useBIOPHLXTheme();
  const [open, setOpen] = useState(false);
  const movement = repMovement(rep);
  const status = movement.legacy ? 'Individual bands not recorded' : !movement.complete ? 'Incomplete measurements' : movement.reason ? 'Placements shown separately' : 'Both bands recorded';
  return <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Rep ${rep.session_item_rep_index}, ${status}, details`} style={{ padding: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Rep {rep.session_item_rep_index} {open ? '⌃' : '⌄'}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{status}</Text></View>
      <ScoreBadge score={rep.score} small />
    </Pressable>
    {open && <View style={{ padding: 12, gap: 10 }}>
      {movement.bands.length ? movement.bands.map(band => <View key={band.band} style={{ padding: 14, borderRadius: 14, backgroundColor: colors.raised }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{band.label || `Band ${band.band}`}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Band {band.band} · recorded ROM score</Text></View>
          <ScoreBadge score={band.missing ? null : band.score} small />
        </View>
        {band.missing ? <Text style={{ color: colors.muted, marginTop: 10 }}>Not recorded</Text> : <MetricTiles data={band} />}
      </View>) : <>
        <Text style={{ color: colors.muted }}>This legacy rep has combined records only. Individual band measurements cannot be reconstructed.</Text>
        <MetricTiles data={rep} />
        {[1, 2].map(number => <Text key={number} style={{ color: colors.muted }}>Band {number}: not recorded</Text>)}
      </>}
      <MetricMeans summary={movement.metrics} rep />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Target and phase comparison unavailable: no target or phase snapshot was recorded.</Text>
    </View>}
  </View>;
}

export default function ExerciseHistory({ name, reps = [], sets = [], loading = false, metadataError = false }) {
  const { colors } = useBIOPHLXTheme();
  const [expanded, setExpanded] = useState({});
  const groups = groupRepSets(reps, sets);
  return <View style={{ marginTop: 18, gap: 10 }}>
    <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{name}</Text>
    {metadataError && <Text accessibilityRole="alert" style={{ color: colors.muted }}>Set details could not be loaded. Recorded reps are shown; reopen this session to retry.</Text>}
    {loading ? <ActivityIndicator color={colors.accent} /> : groups.length ? groups.map(set => {
      const movement = summarizeMovement(set.reps);
      const scoreCount = set.reps.filter(rep => validScore(rep.score) != null).length;
      return <View key={set.number} style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raised, overflow: 'hidden' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Set ${set.number}, ${set.reps.length} reps, summary`} accessibilityState={{ expanded: !!expanded[set.number] }} onPress={() => setExpanded(previous => ({ ...previous, [set.number]: !previous[set.number] }))} style={{ padding: 16, flexDirection: 'row', gap: 8, justifyContent: 'space-between', alignItems: 'center', minHeight: 84 }}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Set {set.number} {expanded[set.number] ? '⌃' : '⌄'}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{set.reps.length} recorded reps{set.weight != null ? ` · ${set.weight} lbs` : ''}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{scoreCount} / {set.reps.length} recorded ROM scores</Text></View>
          <ScoreBadge score={set.score} />
        </Pressable>
        {expanded[set.number] && <View style={{ padding: 12, gap: 10 }}>
          <MetricMeans summary={movement.metrics} total={movement.repCount} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>{movement.incompleteCount} incomplete · {movement.legacyCount} without individual bands. Expand a rep to review both bands together.</Text>
          {set.reps.length ? set.reps.map(rep => <RepCard key={rep.session_item_rep_index} rep={rep} />) : <Text style={{ color: colors.muted }}>No reps recorded in this set.</Text>}
        </View>}
      </View>;
    }) : <Text style={{ color: colors.muted }}>No sets recorded.</Text>}
    <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>ROM scores retain the existing 0/50/100 band rule; stored combined scores are unchanged. Set score averages recorded rep scores, including zero. These are not form or muscle-activation ratings. Speed is estimated. Means exclude missing measurements and incompatible placement.</Text>
  </View>;
}
