const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/Components/history/movementMetrics.js'), 'utf8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const rep = (left = {}, right = {}) => ({ session_id: 's1', session_item_index: 1, session_item_set_index: 1,
  band_metrics: { version: 1, bands: [
    { band: 1, label: 'Left arm', rom: 0, tut: 2, velocity: 0.5, ...left },
    { band: 2, label: 'Right arm', rom: 120, tut: 4, velocity: 1.5, ...right },
  ] } });

test('valid zero is preserved and invalid measurements remain missing', async () => {
  const { validMeasurement, repMovement } = await modulePromise;
  for (const value of [null, undefined, '', '  ', false, {}, [], -1, Infinity, 'invalid']) assert.equal(validMeasurement(value), null);
  assert.equal(validMeasurement(0), 0);
  assert.equal(repMovement(rep()).metrics.rom.value, 60);
});

test('each metric has its own comparable rep count and exclusion count', async () => {
  const { summarizeMovement } = await modulePromise;
  const result = summarizeMovement([rep(), rep({ tut: null }), { session_item_set_index: 1, rom: 80, score: 75 }]);
  assert.deepEqual(result.metrics.rom, { mean: 60, count: 2, excluded: 1 });
  assert.deepEqual(result.metrics.tut, { mean: 3, count: 1, excluded: 2 });
  assert.deepEqual(result.metrics.velocity, { mean: 1, count: 2, excluded: 1 });
  assert.equal(result.completeCount, 1);
  assert.equal(result.incompleteCount, 1);
  assert.equal(result.legacyCount, 1);
});

test('mixed limbs, same side, and unknown placement never produce a two-band mean', async () => {
  const { repMovement } = await modulePromise;
  for (const record of [rep({}, { label: 'Right leg' }), rep({}, { label: 'Left arm' }), rep({ label: 'Band 1' })]) {
    const result = repMovement(record);
    assert.ok(result.reason);
    for (const metric of Object.values(result.metrics)) assert.equal(metric.value, null);
  }
});

test('missing band and malformed legacy payload do not borrow combined values', async () => {
  const { repMovement } = await modulePromise;
  const missing = rep({}, { missing: true });
  missing.rom = 75;
  assert.equal(repMovement(missing).metrics.rom.value, null);
  for (const raw of [undefined, '{bad json', { version: 2, bands: [] }]) {
    const result = repMovement({ band_metrics: raw, rom: 110, tut: 3, velocity: 1 });
    assert.equal(result.metrics.rom.value, null);
    assert.equal(result.legacy, true);
  }
});

test('summary weights each rep equally and separates sets by session and exercise', async () => {
  const { summarizeMovement } = await modulePromise;
  const first = rep(), second = rep({ rom: 100 }, { rom: 120 }), third = { ...rep(), session_id: 's2' };
  const result = summarizeMovement([first, second, third]);
  assert.equal(result.metrics.rom.mean, (60 + 110 + 60) / 3);
  assert.equal(result.setCount, 2);
  assert.equal(result.repCount, 3);
});

test('empty selected dates stay empty instead of falling back to another workout', async () => {
  const { selectMovementSessions } = await modulePromise;
  const sessions = [{ session_id: 'one', workout_date: '2026-09-17' }];
  assert.deepEqual(selectMovementSessions(sessions, '2026-09-18', new Date(2026, 8, 18)), []);
  assert.deepEqual(selectMovementSessions(sessions, null, new Date(2026, 9, 1)), []);
  assert.equal(selectMovementSessions(sessions, null, new Date(2026, 8, 20), 'week').length, 1);
});

test('date-only workout dates do not shift and timestamps follow local calendar dates', async () => {
  const { localWorkoutDate } = await modulePromise;
  assert.equal(localWorkoutDate('2026-09-17'), '2026-09-17');
  assert.equal(localWorkoutDate(new Date(2026, 8, 17, 23, 59)), '2026-09-17');
  assert.equal(localWorkoutDate('bad date'), null);
});
