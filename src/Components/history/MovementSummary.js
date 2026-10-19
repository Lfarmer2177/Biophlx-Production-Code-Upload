import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import { MOVEMENT_METRICS, summarizeMovement } from './movementMetrics';

export default function MovementSummary({ reps = [], sessionCount = 0, loading = false, error = null, onRetry, label = 'Recorded movement' }) {
  const { colors } = useBIOPHLXTheme();
  const summary = summarizeMovement(reps);
  return <View style={{ gap: 14 }}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{label}</Text>
    {loading ? <View style={{ flexDirection: 'row', gap: 8 }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted }}>Loading recorded movement…</Text></View> : null}
    {error ? <View><Text accessibilityRole="alert" style={{ color: colors.text }}>Some movement records could not be loaded. The counts below are partial.</Text>{onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accent }}>Retry movement records</Text></Pressable>}</View> : null}
    <Text style={{ color: colors.text, fontSize: 16 }}>{sessionCount} recorded workouts · {summary.repCount} recorded reps · {summary.setCount} sets with reps</Text>
    {!loading && !error && !summary.repCount ? <Text style={{ color: colors.muted }}>No rep measurements recorded for this selection.</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {MOVEMENT_METRICS.map(({ key, label: metricLabel, unit, digits }) => <View key={key} style={{ flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 14, backgroundColor: colors.raised }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Mean {metricLabel.toLowerCase()}</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginVertical: 5 }}>{summary.metrics[key].mean == null ? '—' : `${summary.metrics[key].mean.toFixed(digits)} ${unit}`}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{summary.metrics[key].count} / {summary.repCount} comparable reps · {summary.metrics[key].excluded} excluded</Text>
      </View>)}
    </View>
    <Text style={{ color: colors.muted, lineHeight: 20 }}>{summary.completeCount} reps with both bands’ movement metrics · {summary.incompleteCount} incomplete · {summary.legacyCount} without individual band records.</Text>
    {!!summary.nonComparableCount && <Text style={{ color: colors.muted }}>{summary.nonComparableCount} reps have missing or incompatible band placement for comparison.</Text>}
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Means use two valid measurements from the same recorded rep and opposite sides of the same limb type. Each metric has its own count. Movement phase was not recorded, so phase matching cannot be checked. Speed is estimated from angular motion and a fixed limb radius.</Text>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Target adherence is unavailable: these records have no captured target ranges. Historical ROM scores are preserved in the set review. Counts cover the loaded session history.</Text>
  </View>;
}
