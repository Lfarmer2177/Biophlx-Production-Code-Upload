const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/Components/rep-feedback/repFeedback.js'), 'utf8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('existing ROM thresholds include valid zero and exact boundaries', async () => {
  const { bandRating } = await modulePromise;
  for (const [rom, expected] of [[0,0],[90,0],[90.1,50],[120,50],[120.1,100],[180,100]]) assert.equal(bandRating(rom), expected);
});
test('missing and invalid measurements never become a zero rating', async () => {
  const { bandRating, averageBands, combinedRating } = await modulePromise;
  for (const value of [null, undefined, '', NaN, Infinity, -1, false]) {
    assert.equal(bandRating(value), null);
    assert.equal(averageBands(value, 100), null);
    assert.equal(combinedRating(100, value), null);
  }
});
test('two independent bands produce the backend integer score', async () => {
  const { bandRating, combinedRating, averageBands } = await modulePromise;
  assert.equal(combinedRating(bandRating(130), bandRating(110)), 75);
  assert.equal(combinedRating(bandRating(0), bandRating(130)), 50);
  assert.equal(averageBands(0, 130), 65);
  assert.equal(combinedRating(101, 50), null);
});
test('mutation preserves Float precision and serializes only schema fields', async () => {
  const { repMetricsInput } = await modulePromise;
  assert.deepEqual(repMetricsInput({ ROM: 120.5, Score: 75, TUT: 3.15, Velocity: 1.05, Momentum: 10.5 }),
    { rom: 121, score: 75, tut: 3.15, velocity: 1.05, momentum: 11 });
  assert.deepEqual(repMetricsInput({}), { rom: null, score: null, tut: null, velocity: null, momentum: null });
});
test('null and invalid summary fields remain nullable', async () => {
  const { repMetricsInput } = await modulePromise;
  assert.deepEqual(repMetricsInput({ ROM: Infinity, Score: 150, TUT: -1, Velocity: NaN, Momentum: 2147483648 }),
    { rom: null, score: null, tut: null, velocity: null, momentum: null });
});
test('labels follow side and limb placement', async () => {
  const { bandLabel } = await modulePromise;
  assert.equal(bandLabel({side:0,limb:0}), 'Left arm');
  assert.equal(bandLabel({side:1,limb:1}), 'Right leg');
});
