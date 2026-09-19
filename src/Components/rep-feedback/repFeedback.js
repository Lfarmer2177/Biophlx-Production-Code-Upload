export function describeRep(rom, target, available = true) {
  const value = rom == null ? NaN : Number(rom);
  const goal = target == null ? NaN : Number(target);
  if (!available || !Number.isFinite(value) || value <= 0) return { value: null, percent: null, label: 'Measurement unavailable' };
  if (!Number.isFinite(goal) || goal <= 0) return { value, percent: null, label: 'Range recorded' };
  const percent = Math.round(value / goal * 100);
  return { value, percent, label: percent >= 100 ? 'Range target reached' : 'Below range target' };
}

// Never substitute zero or reuse the other band when a measurement is absent.
export function averageBands(first, second) {
  if (first == null || second == null || first === '' || second === '') return null;
  const a = Number(first), b = Number(second);
  return Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 ? (a + b) / 2 : null;
}

export function bandLabel(slot) {
  const side = slot?.side === 0 ? 'Left' : slot?.side === 1 ? 'Right' : 'Unknown side';
  const limb = slot?.limb === 0 ? 'arm' : slot?.limb === 1 ? 'leg' : 'placement';
  return `${side} ${limb}`;
}
export function bandRating(rom, target) {
  const result = describeRep(rom, target);
  return result.percent == null ? null : Math.min(100, result.percent);
}
export function combinedRating(first, second) {
  return first == null || second == null ? null : (first + second) / 2;
}
export function meanMetric(first, second) {
  if (first == null || second == null || first === '' || second === '') return null;
  const a = Number(first), b = Number(second);
  return Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b >= 0 ? (a + b) / 2 : null;
}
