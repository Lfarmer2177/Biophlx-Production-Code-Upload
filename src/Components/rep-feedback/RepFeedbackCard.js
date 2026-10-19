import React from 'react';
import { Text, View } from 'react-native';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import ExerciseHistory from '../history/HistoryCards';
import { bandRating, combinedRating } from './repFeedback';

// Live capture and persisted history share the same Set > Rep > both-band review.
// This component presents observations; it does not mark writes as saved.
export default function RepFeedbackCard({ reps = [] }) {
  const { colors } = useBIOPHLXTheme();
  const rows = reps.map(rep => ({
    run: rep.run ?? 0,
    session_item_set_index: rep.setNo,
    session_item_rep_index: rep.repIndex,
    score: rep.available ? combinedRating(bandRating(rep.primaryRom), bandRating(rep.secondaryRom)) : null,
    band_metrics: { version: 1, bands: [rep.primaryMetrics, rep.secondaryMetrics].map((metrics, index) => {
      const available = index === 0 ? rep.primaryAvailable : !!metrics;
      return { ...metrics, band: index + 1, label: rep[index === 0 ? 'band1Label' : 'band2Label'],
        missing: !available, score: available ? bandRating(metrics?.rom) : null };
    }) },
  }));
  const runs = [...new Set(rows.map(row => row.run))];
  return <View style={{ padding: 18, marginVertical: 12, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
    {runs.map((run, index) => <ExerciseHistory key={run} name={runs.length > 1 ? `Set and rep review · run ${index + 1}` : 'Set and rep review'} reps={rows.filter(row => row.run === run)} />)}
    {!rows.length && <Text style={{ color: colors.muted, marginTop: 8 }}>Complete a rep to review each band’s movement measurements.</Text>}
  </View>;
}
