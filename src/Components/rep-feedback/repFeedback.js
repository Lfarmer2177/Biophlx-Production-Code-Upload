// Existing BIOPHLX ROM scoring policy; the backend stores, rather than computes, score.
// This is a range score, not an exercise-specific form or safety assessment.
function measurement(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function bandRating(rom) {
  const value = measurement(rom);
  return value == null ? null : value > 120 ? 100 : value > 90 ? 50 : 0;
}

export function meanMetric(first, second) {
  const a = measurement(first), b = measurement(second);
  return a == null || b == null ? null : (a + b) / 2;
}

export const averageBands = meanMetric;

export function combinedRating(first, second) {
  const value = meanMetric(first, second);
  return value == null || first > 100 || second > 100 ? null : Math.round(value);
}

export function bandLabel(slot) {
  const side = slot?.side === 0 ? 'Left' : slot?.side === 1 ? 'Right' : 'Unknown side';
  const limb = slot?.limb === 0 ? 'arm' : slot?.limb === 1 ? 'leg' : 'placement';
  return `${side} ${limb}`;
}

// CreateSessionItemRepInput: score/rom/momentum Int; tut/velocity Float.
export function repMetricsInput({ ROM, Score, TUT, Velocity, Momentum }) {
  const integer = value => {
    const n = measurement(value);
    return n == null || Math.round(n) > 2147483647 ? null : Math.round(n);
  };
  return {
    rom: integer(ROM),
    score: Score == null || Score > 100 ? null : integer(Score),
    tut: measurement(TUT),
    velocity: measurement(Velocity),
    momentum: integer(Momentum),
  };
}
