// Firmware reports completed sets (zero before the first set), not the active set.
export function completedSetCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function currentSetNumber(value) {
  return completedSetCount(value) + 1;
}

export function applyFirmwareSetCount(previous, value) {
  const sets = completedSetCount(value);
  if (sets === completedSetCount(previous.sets)) return { ...previous, sets, setc: sets };
  // SET_COMPLETE precedes REPS=0 in the firmware notification queue. Clear the
  // previous set's readings together so they cannot become reps in the new set.
  return { ...previous, sets, setc: sets, reps: 0, ROM: null, TUT: 0, Velocity: 0, Score: null };
}

export function readRepProgress(previous, sample) {
  const counter = {
    completedSets: completedSetCount(sample.sets),
    reps: Number.isInteger(sample.reps) && sample.reps >= 0 ? sample.reps : 0,
  };
  const previousReps = previous?.completedSets === counter.completedSets ? previous.reps : 0;
  return { counter, previousReps, repsToAdd: Math.max(0, counter.reps - previousReps) };
}
