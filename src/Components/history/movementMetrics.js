// Read-only presentation of the deployed v1 band_metrics contract.
// No target scores or historical measurements are synthesized here.
export const MOVEMENT_METRICS = [
  { key: 'rom', label: 'Range of motion', unit: '°', digits: 1 },
  { key: 'tut', label: 'Rep duration', unit: 's', digits: 2 },
  { key: 'velocity', label: 'Estimated speed', unit: 'm/s', digits: 2 },
];

export function validMeasurement(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function recordedBands(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (value?.version !== 1 || !Array.isArray(value.bands)) return [];
    return [1, 2].map(number => value.bands.find(band => band?.band === number) ||
      { band: number, label: `Band ${number}`, missing: true });
  } catch { return []; }
}

function placement(label) {
  const match = typeof label === 'string' && label.trim().toLowerCase().match(/^(left|right) (arm|leg)$/);
  return match ? { side: match[1], limb: match[2] } : null;
}

export function compareBands(bands) {
  if (bands.length !== 2 || bands.some(band => band.missing)) return 'A band was not recorded.';
  const first = placement(bands[0].label), second = placement(bands[1].label);
  if (!first || !second) return 'Recorded placement is unavailable.';
  if (first.limb !== second.limb) return 'Different limb placements; measurements stay separate.';
  if (first.side === second.side) return 'Matching side assignments; measurements stay separate.';
  return null;
}

export function repMovement(rep) {
  const bands = recordedBands(rep?.band_metrics);
  const reason = bands.length ? compareBands(bands) : 'Individual band measurements were not recorded.';
  const metrics = Object.fromEntries(MOVEMENT_METRICS.map(({ key }) => {
    const values = bands.map(band => band.missing ? null : validMeasurement(band[key]));
    const count = values.filter(value => value != null).length;
    return [key, {
      value: !reason && count === 2 ? (values[0] + values[1]) / 2 : null,
      count,
      reason: reason || (count < 2 ? 'A valid measurement from both bands is required.' : null),
    }];
  }));
  const complete = MOVEMENT_METRICS.every(({ key }) => metrics[key].count === 2);
  return { bands, metrics, reason, legacy: !bands.length, complete, comparable: !reason };
}

export function summarizeMovement(reps = []) {
  const rows = reps.map(repMovement);
  const metrics = Object.fromEntries(MOVEMENT_METRICS.map(({ key }) => {
    const values = rows.map(row => row.metrics[key].value).filter(value => value != null);
    return [key, { mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      count: values.length, excluded: rows.length - values.length }];
  }));
  return {
    repCount: reps.length,
    setCount: new Set(reps.filter(rep => Number.isInteger(Number(rep.session_item_set_index)) && Number(rep.session_item_set_index) > 0)
      .map(rep => `${rep.session_id || ''}:${rep.session_item_index || ''}:${rep.session_item_set_index}`)).size,
    completeCount: rows.filter(row => !row.legacy && row.complete).length,
    incompleteCount: rows.filter(row => !row.legacy && !row.complete).length,
    legacyCount: rows.filter(row => row.legacy).length,
    nonComparableCount: rows.filter(row => !row.legacy && !!row.reason).length,
    metrics,
  };
}

// Date-only workout dates are already local dates. Timestamps are rendered in the user's zone.
export function localWorkoutDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function selectMovementSessions(sessions, selectedDate, monthDate, range = 'month') {
  const anchor = new Date(monthDate.getFullYear(), monthDate.getMonth(), monthDate.getDate());
  let start, end;
  if (range === 'year') { start = new Date(anchor.getFullYear(), 0, 1); end = new Date(anchor.getFullYear() + 1, 0, 1); }
  else if (range === 'week') { start = new Date(anchor); start.setDate(start.getDate() - 6); end = new Date(anchor); end.setDate(end.getDate() + 1); }
  else { start = new Date(anchor.getFullYear(), anchor.getMonth(), 1); end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1); }
  const startKey = localWorkoutDate(start), endKey = localWorkoutDate(end);
  return sessions.filter(session => {
    const key = localWorkoutDate(session.workout_date || session.created_at);
    return key && (selectedDate ? key === selectedDate : key >= startKey && key < endKey);
  });
}
