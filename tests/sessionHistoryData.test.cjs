const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const babel = require('@babel/core');
const commonjs = require.resolve('@babel/plugin-transform-modules-commonjs');
function load(file) {
  const source = babel.transformSync(fs.readFileSync(file, 'utf8'), { filename: file, babelrc: false, configFile: false, plugins: [commonjs] }).code;
  const target = { exports: {} };
  new Function('module', 'exports', 'require', source)(target, target.exports, name => load(path.resolve(path.dirname(file), name + '.js')));
  return target.exports;
}
const { loadSessionReps, loadSessionDetails } = load(path.join(__dirname, '../src/Components/history/sessionHistoryData.js'));
const row = (index, overrides = {}) => ({ session_id: 's', session_item_index: 1, session_item_set_index: 1, session_item_rep_index: index, ...overrides });

test('rep history follows every cursor, excludes foreign-session rows and deduplicates overlap', async () => {
  const tokens = [];
  const client = { graphql: async ({ variables }) => {
    tokens.push(variables.nextToken);
    return { data: { listSessionItemReps: variables.nextToken ? { items: [row(1), row(2)], nextToken: null } : { items: [row(1), row(8, { session_id: 'other' })], nextToken: 'page2' } } };
  } };
  assert.equal((await loadSessionReps(client, 's')).length, 2);
  assert.deepEqual(tokens, [undefined, 'page2']);
});

test('failed or nonadvancing history does not report a successful zero count', async () => {
  await assert.rejects(loadSessionReps({ graphql: async () => ({ errors: [{ message: 'Denied' }] }) }, 's'));
  await assert.rejects(loadSessionReps({ graphql: async () => ({ data: {} }) }, 's'));
  await assert.rejects(loadSessionReps({ graphql: async () => ({ data: { listSessionItemReps: { items: [], nextToken: 'same' } } }) }, 's'), /pagination/);
});

test('details include high item indexes and orphan reps without guessing an index ceiling', async () => {
  const requestedIndexes = [];
  const client = { graphql: async ({ query, variables }) => {
    if (query.includes('query ListSessionItemsBySession')) return { data: { listSessionItemsBySession: [{ session_id: 's', session_item_index: 28, exercise_id: 'squat' }] } };
    if (query.includes('query ListSessionItemReps')) return { data: { listSessionItemReps: { items: [row(1, { session_item_index: 28 }), row(1, { session_item_index: 42 })] } } };
    requestedIndexes.push(variables.session_item_index);
    return { data: { listSessionItemSets: [] } };
  } };
  const result = await loadSessionDetails(client, 's');
  assert.deepEqual(requestedIndexes, [28, 42]);
  assert.equal(result[1].reps.length, 1);
  assert.equal(result[1].exercise_id, undefined);
});

test('unavailable set metadata remains an error while recorded reps remain visible', async () => {
  const client = { graphql: async ({ query }) => {
    if (query.includes('query ListSessionItemsBySession')) return { data: { listSessionItemsBySession: [] } };
    if (query.includes('query ListSessionItemReps')) return { data: { listSessionItemReps: { items: [row(1)] } } };
    throw new Error('Network unavailable');
  } };
  const result = await loadSessionDetails(client, 's');
  assert.equal(result[0].setsError, true);
  assert.equal(result[0].reps.length, 1);
});
