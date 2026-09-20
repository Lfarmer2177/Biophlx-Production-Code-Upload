const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/context/firmwareSetProgress.js'), 'utf8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const freshFeedback = () => ({
  sets: 0, setc: 0, reps: 0, ROM: null, TUT: 0, Velocity: 0, Score: null,
  'Current Position': 23, exerciseStage: 1,
});

test('firmware completed-set counters map to distinct, one-based current sets', async () => {
  const { completedSetCount, currentSetNumber } = await modulePromise;
  assert.deepEqual([0, 1, 2].map(completedSetCount), [0, 1, 2]);
  assert.deepEqual([0, 1, 2].map(currentSetNumber), [1, 2, 3]);
});

test('three-second hold advances the set and clears only prior-rep measurements', async () => {
  const { applyFirmwareSetCount, currentSetNumber } = await modulePromise;
  const firstSet = { ...freshFeedback(), reps: 8, ROM: 135, TUT: 2.6, Velocity: 0.8, Score: 100 };
  const nextSet = applyFirmwareSetCount(firstSet, 1);
  assert.equal(currentSetNumber(nextSet.sets), 2);
  assert.deepEqual(nextSet, {
    ...firstSet, sets: 1, setc: 1, reps: 0, ROM: null, TUT: 0, Velocity: 0, Score: null,
  });
  assert.equal(firstSet.reps, 8, 'the previous feedback object must remain unchanged');
  const thirdSet = applyFirmwareSetCount({ ...nextSet, reps: 6 }, 2);
  assert.equal(currentSetNumber(thirdSet.sets), 3);
  assert.equal(thirdSet.reps, 0);
});

test('SET before the separate zero-REP notification does not manufacture a new rep', async () => {
  const { applyFirmwareSetCount, readRepProgress } = await modulePromise;
  const previousCounter = { completedSets: 0, reps: 8 };
  const newSet = applyFirmwareSetCount({ ...freshFeedback(), reps: 8, ROM: 130 }, 1);
  const setNotification = readRepProgress(previousCounter, newSet);
  assert.deepEqual(setNotification, {
    counter: { completedSets: 1, reps: 0 }, previousReps: 0, repsToAdd: 0,
  });
  const resetNotification = readRepProgress(setNotification.counter, { ...newSet, reps: 0 });
  assert.equal(resetNotification.repsToAdd, 0);
  const firstRep = readRepProgress(resetNotification.counter, { ...newSet, reps: 1, ROM: 132 });
  assert.deepEqual(firstRep, {
    counter: { completedSets: 1, reps: 1 }, previousReps: 0, repsToAdd: 1,
  });
});

test('repeated set and rep notifications preserve current measurements without duplicates', async () => {
  const { applyFirmwareSetCount, readRepProgress } = await modulePromise;
  const current = { ...freshFeedback(), sets: 1, setc: 1, reps: 3, ROM: 127, TUT: 2.3, Velocity: 0.7, Score: 100 };
  const repeatedSet = applyFirmwareSetCount(current, 1);
  assert.deepEqual(repeatedSet, current);
  const repeatedRep = readRepProgress({ completedSets: 1, reps: 3 }, repeatedSet);
  assert.equal(repeatedRep.repsToAdd, 0);
  assert.equal(repeatedRep.counter.reps, 3);
});

test('a new-set rep equal to the last-set count is captured when React skips the zero render', async () => {
  const { readRepProgress } = await modulePromise;
  const progress = readRepProgress({ completedSets: 0, reps: 1 }, { sets: 1, reps: 1 });
  assert.deepEqual(progress, {
    counter: { completedSets: 1, reps: 1 }, previousReps: 0, repsToAdd: 1,
  });
});

test('a completed-set decrease starts fresh rep progress for the next exercise', async () => {
  const { applyFirmwareSetCount, currentSetNumber, readRepProgress } = await modulePromise;
  const reset = applyFirmwareSetCount({ ...freshFeedback(), sets: 2, setc: 2, reps: 9, ROM: 129 }, 0);
  assert.equal(currentSetNumber(reset.sets), 1);
  assert.equal(reset.reps, 0);
  assert.equal(reset.ROM, null);
  const progress = readRepProgress({ completedSets: 2, reps: 9 }, { ...reset, reps: 1 });
  assert.deepEqual(progress, {
    counter: { completedSets: 0, reps: 1 }, previousReps: 0, repsToAdd: 1,
  });
});

test('two independent band streams pair reps only within the same exercise, set, and rep', async () => {
  const { applyFirmwareSetCount, currentSetNumber, readRepProgress } = await modulePromise;
  const streams = Object.fromEntries(['primary', 'secondary'].map(slot => [slot, {
    feedback: freshFeedback(), counter: { completedSets: 0, reps: 0 },
  }]));
  const samples = new Map();
  const paired = new Map();
  let exerciseRun = 'squats-1';

  // Model BLE's separate SET and REP notifications through the same pure helpers
  // used by BleContext and WorkoutRunner. Metrics remain specific to each band.
  function packet(slot, label, value, metrics = {}) {
    const stream = streams[slot];
    stream.feedback = label === 'sets'
      ? applyFirmwareSetCount(stream.feedback, value)
      : { ...stream.feedback, ...metrics, [label]: value };
    const progress = readRepProgress(stream.counter, stream.feedback);
    stream.counter = progress.counter;
    for (let i = 1; i <= progress.repsToAdd; i++) {
      const rep = progress.previousReps + i;
      const key = `${exerciseRun}:${currentSetNumber(stream.feedback.sets)}:${rep}`;
      const entry = samples.get(key) || {};
      entry[slot] = { ROM: stream.feedback.ROM, TUT: stream.feedback.TUT };
      samples.set(key, entry);
      if (entry.primary && entry.secondary) paired.set(key, entry);
    }
  }

  packet('primary', 'reps', 1, { ROM: 130, TUT: 2.1 });
  packet('secondary', 'reps', 1, { ROM: 110, TUT: 2.4 });
  assert.deepEqual([...paired.keys()], ['squats-1:1:1']);
  packet('primary', 'sets', 1);
  packet('primary', 'reps', 0);
  packet('primary', 'reps', 1, { ROM: 140, TUT: 2.2 });
  assert.equal(streams.secondary.counter.completedSets, 0, 'the other band advances independently');
  packet('secondary', 'reps', 1, { ROM: 110, TUT: 2.4 });
  assert.equal(paired.size, 1, 'a repeated old-set secondary rep cannot pair with the new set');
  packet('secondary', 'sets', 1);
  packet('secondary', 'reps', 0);
  packet('secondary', 'reps', 1, { ROM: 120, TUT: 2.6 });
  assert.deepEqual([...paired.keys()], ['squats-1:1:1', 'squats-1:2:1']);
  assert.deepEqual(paired.get('squats-1:1:1'), {
    primary: { ROM: 130, TUT: 2.1 }, secondary: { ROM: 110, TUT: 2.4 },
  });
  assert.deepEqual(paired.get('squats-1:2:1'), {
    primary: { ROM: 140, TUT: 2.2 }, secondary: { ROM: 120, TUT: 2.6 },
  });

  // Reverse notification order on the next hold and include repeated SET packets.
  packet('secondary', 'sets', 2);
  packet('secondary', 'reps', 1, { ROM: 133, TUT: 2.7 });
  packet('secondary', 'sets', 2);
  packet('primary', 'sets', 2);
  packet('primary', 'reps', 1, { ROM: 138, TUT: 2.5 });
  assert.equal(paired.size, 3);
  assert.equal(paired.get('squats-1:3:1').secondary.ROM, 133);

  exerciseRun = 'curls-2';
  for (const slot of ['primary', 'secondary']) packet(slot, 'sets', 0);
  packet('secondary', 'reps', 1, { ROM: 115, TUT: 3.1 });
  packet('primary', 'reps', 1, { ROM: 125, TUT: 3.3 });
  assert.deepEqual([...paired.keys()], ['squats-1:1:1', 'squats-1:2:1', 'squats-1:3:1', 'curls-2:1:1']);
  assert.equal(paired.get('squats-1:1:1').primary.ROM, 130, 'earlier exercise history remains intact');
});
