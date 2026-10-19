'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CONTRACT_ID, CONTRACT_VERSION, REQUIRED_CAPABILITIES, createFinalizedRepAdapter } = require('../src/services/firmware/finalizedRepAdapter.js');
const RECEIVED = '2026-10-19T14:00:00.000Z';
const copy = value => JSON.parse(JSON.stringify(value));

function configuration() {
  return {
    mode: 'fixture', sessionId: 'fixture-session', exerciseInstanceId: 'fixture-exercise-occurrence',
    exerciseId: 'fixture-curl', setId: 'fixture-set-1', setIndex: 1,
    bands: ['left', 'right'].map((side, index) => ({
      slot: `band-${index + 1}`, deviceId: `fixture-device-${index + 1}`, deviceRunId: `fixture-run-${index + 1}`,
      side, limb: 'arm', exerciseProfileId: `fixture-profile-${side}`,
      negotiation: {
        contractId: CONTRACT_ID, contractVersion: CONTRACT_VERSION, confirmed: true,
        source: 'fixture', evidenceRef: 'synthetic-only:no-device-tested',
        firmwareVersion: 'future-fixture', firmwareBuildId: `fixture-build-${index + 1}`,
        capabilities: [...REQUIRED_CAPABILITIES],
      },
    })),
  };
}
function event(config, bandIndex, repIndex = 1) {
  const band = config.bands[bandIndex];
  const metric = (value, unit, definitionId) => ({ value, unit, definitionId, phase: 'whole-rep', validity: 'valid', reason: null });
  return {
    contractId: CONTRACT_ID, contractVersion: CONTRACT_VERSION, status: 'finalized',
    sessionId: config.sessionId, exerciseInstanceId: config.exerciseInstanceId, exerciseId: config.exerciseId,
    setId: config.setId, setIndex: config.setIndex, logicalRepId: `fixture-logical-rep-${repIndex}`, repIndex,
    eventId: `fixture-${band.deviceId}-rep-${repIndex}`, sequence: repIndex,
    deviceId: band.deviceId, deviceRunId: band.deviceRunId, slot: band.slot, side: band.side, limb: band.limb,
    capturedAt: { value: repIndex * 5000, unit: 'ms', kind: 'device-monotonic', clockId: band.deviceRunId },
    provenance: {
      firmwareVersion: band.negotiation.firmwareVersion, firmwareBuildId: band.negotiation.firmwareBuildId,
      exerciseProfileId: band.exerciseProfileId, calibrationId: null,
    },
    metrics: {
      range: metric(bandIndex ? 112 : 116, 'deg', 'fixture-range-definition'),
      duration: metric(bandIndex ? 3.1 : 3.2, 's', 'fixture-duration-definition'),
      angularSpeed: metric(bandIndex ? 90 : 110, 'deg/s', 'fixture-angular-speed-definition'),
    },
  };
}
function rejects(fn, code) { assert.throws(fn, error => error.code === code); }
function pair(config = configuration(), amend = () => {}) {
  const adapter = createFinalizedRepAdapter(config);
  const events = [event(config, 0), event(config, 1)]; amend(events);
  adapter.ingest(events[0], RECEIVED);
  return { adapter, events, result: adapter.ingest(events[1], RECEIVED).pair };
}

test('default and version-only activation fail closed', () => {
  const config = configuration(); delete config.mode;
  rejects(() => createFinalizedRepAdapter(config), 'CONTRACT_NOT_NEGOTIATED');
  const legacy = configuration(); legacy.bands[0].negotiation = { firmwareVersion: '1.3.11' };
  rejects(() => createFinalizedRepAdapter(legacy), 'CONTRACT_NOT_NEGOTIATED');
});
test('unknown contract version, unconfirmed negotiation and absent capability are rejected', () => {
  const version = configuration(); version.bands[0].negotiation.contractVersion = '0.2';
  rejects(() => createFinalizedRepAdapter(version), 'UNSUPPORTED_CONTRACT');
  const unconfirmed = configuration(); unconfirmed.bands[0].negotiation.confirmed = false;
  rejects(() => createFinalizedRepAdapter(unconfirmed), 'CONTRACT_NOT_NEGOTIATED');
  const missing = configuration(); missing.bands[1].negotiation.capabilities.pop();
  rejects(() => createFinalizedRepAdapter(missing), 'MISSING_CAPABILITY');
});
test('device mode cannot accept fixture negotiation evidence', () => {
  const config = configuration(); config.mode = 'negotiated-device';
  rejects(() => createFinalizedRepAdapter(config), 'CONTRACT_NOT_NEGOTIATED');
});
test('explicit future handshake gate retains its evidence without claiming real hardware', () => {
  // Synthetic test of caller-supplied handshake boundary, not an actual handshake.
  const config = configuration(); config.mode = 'negotiated-device';
  config.bands.forEach(band => { band.negotiation.source = 'verified-device-handshake'; });
  const { result } = pair(config);
  assert.equal(result.evidenceMode, 'negotiated-device');
  assert.equal(result.bands[0].provenance.negotiationEvidenceRef, 'synthetic-only:no-device-tested');
});
test('both bands retain identity and separate metrics with precise comparable means', () => {
  const { result } = pair();
  assert.equal(result.complete, true); assert.equal(result.repIndex, 1);
  assert.equal(result.combined.range.value, 114);
  assert.ok(Math.abs(result.combined.duration.value - 3.15) < 1e-12);
  assert.equal(result.combined.angularSpeed.value, 100);
  assert.equal(result.combined.range.pairedValidCount, 1);
  assert.equal(result.bands[0].metrics.range.value, 116);
  assert.equal(result.bands[1].metrics.range.value, 112);
  assert.equal(result.bands[0].provenance.firmwareBuildId, 'fixture-build-1');
  assert.equal(result.bands[1].provenance.firmwareBuildId, 'fixture-build-2');
});
test('unit conversion is explicit and raw values remain intact', () => {
  const { result } = pair(configuration(), events => {
    events[0].metrics.range.value = Math.PI / 2; events[0].metrics.range.unit = 'rad';
    events[1].metrics.range.value = 90;
    events[0].metrics.duration.value = 3200; events[0].metrics.duration.unit = 'ms';
    events[0].metrics.angularSpeed.value = Math.PI / 2; events[0].metrics.angularSpeed.unit = 'rad/s';
  });
  assert.equal(result.combined.range.value, 90);
  assert.equal(result.combined.angularSpeed.value, 90);
  assert.equal(result.bands[0].metrics.duration.rawValue, 3200);
  assert.equal(result.bands[0].metrics.duration.rawUnit, 'ms');
  assert.equal(result.bands[0].raw.metrics.range.unit, 'rad');
});
test('single-band capture remains available while combined metrics stay unavailable', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  const { pair: result } = adapter.ingest(event(config, 0), RECEIVED);
  assert.equal(result.complete, false); assert.deepEqual(result.missingSlots, ['band-2']);
  assert.equal(result.combined.range.value, null); assert.equal(result.combined.range.reason, 'missing-band');
  assert.equal(result.combined.range.validBandCount, 1);
});
test('missing duration does not invalidate range or turn into zero duration', () => {
  const { result } = pair(configuration(), events => {
    Object.assign(events[1].metrics.duration, { value: null, validity: 'missing', reason: 'sensor-gap' });
  });
  assert.equal(result.complete, true); assert.equal(result.combined.range.value, 114);
  assert.equal(result.combined.duration.value, null); assert.equal(result.combined.duration.validBandCount, 1);
  assert.equal(result.combined.duration.reason, 'unavailable-metric');
});
test('real zero remains a valid measured value', () => {
  const { result } = pair(configuration(), events => events.forEach(value => { value.metrics.range.value = 0; }));
  assert.equal(result.combined.range.value, 0); assert.equal(result.combined.range.validity, 'valid');
});
test('arm and thigh observations stay separate even with equal units', () => {
  const config = configuration(); config.bands[1].limb = 'thigh';
  const { result } = pair(config);
  assert.equal(result.complete, true); assert.equal(result.combined.range.value, null);
  assert.equal(result.combined.range.reason, 'incompatible-placement');
  assert.equal(result.bands[1].limb, 'thigh');
});
test('different metric definitions or phases are not averaged', () => {
  const { result } = pair(configuration(), events => {
    events[1].metrics.range.definitionId = 'another-definition';
    events[1].metrics.angularSpeed.phase = 'concentric';
  });
  assert.equal(result.combined.range.reason, 'incompatible-definition');
  assert.equal(result.combined.angularSpeed.reason, 'incompatible-phase');
  assert.ok(result.combined.duration.value > 3);
});
test('identical retransmission is suppressed without incrementing captured records', () => {
  const { adapter, events } = pair();
  const result = adapter.ingest(events[0], '2026-10-19T14:00:04.000Z');
  assert.equal(result.status, 'duplicate'); assert.equal(adapter.snapshot().length, 1);
  assert.equal(result.event.receivedAt, RECEIVED);
});
test('JSON property ordering does not turn an identical retry into a conflict', () => {
  const { adapter, events } = pair();
  const reordered = Object.fromEntries(Object.entries(events[0]).reverse());
  reordered.metrics = Object.fromEntries(Object.entries(reordered.metrics).reverse());
  assert.equal(adapter.ingest(reordered, RECEIVED).status, 'duplicate');
});
test('changed immutable event payload is rejected and original is preserved', () => {
  const { adapter, events } = pair();
  events[0].metrics.range.value = 119;
  rejects(() => adapter.ingest(events[0], RECEIVED), 'CONFLICTING_EVENT');
  assert.equal(adapter.snapshot()[0].bands[0].metrics.range.value, 116);
});
test('reused device sequence, finalized band rep and logical rep IDs are rejected', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  adapter.ingest(event(config, 0), RECEIVED);
  const sequence = event(config, 0, 2); sequence.sequence = 1;
  rejects(() => adapter.ingest(sequence, RECEIVED), 'CONFLICTING_SEQUENCE');
  const rep = event(config, 0); rep.eventId = 'different-event'; rep.sequence = 90;
  rejects(() => adapter.ingest(rep, RECEIVED), 'CONFLICTING_REP');
  const logical = event(config, 1, 2); logical.logicalRepId = 'fixture-logical-rep-1';
  rejects(() => adapter.ingest(logical, RECEIVED), 'CONFLICTING_REP_INDEX');
});
test('bands cannot pair different logical rep IDs at the same numerical rep', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  adapter.ingest(event(config, 0), RECEIVED);
  const wrong = event(config, 1); wrong.logicalRepId = 'different-logical-rep';
  rejects(() => adapter.ingest(wrong, RECEIVED), 'CONFLICTING_REP_ID');
  assert.equal(adapter.snapshot()[0].complete, false);
});
test('wrong set and repeated exercise occurrence do not contaminate the configured set', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  for (const [key, value, code] of [['setIndex', 2, 'WRONG_SET'], ['setId', 'another-set', 'WRONG_SET'],
    ['exerciseInstanceId', 'same-exercise-second-occurrence', 'WRONG_SESSION'], ['sessionId', 'another-session', 'WRONG_SESSION']]) {
    const wrong = event(config, 0); wrong[key] = value;
    rejects(() => adapter.ingest(wrong, RECEIVED), code);
  }
  assert.equal(adapter.snapshot().length, 0);
  assert.equal(adapter.ingest(event(config, 0), RECEIVED).status, 'accepted');
});
test('unassigned device, stale run, wrong placement and wrong firmware build are rejected', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  for (const [key, value, code] of [['deviceId', 'unknown-device', 'UNKNOWN_DEVICE'], ['deviceRunId', 'old-run', 'WRONG_DEVICE_RUN'], ['side', 'right', 'WRONG_PLACEMENT']]) {
    const wrong = event(config, 0); wrong[key] = value;
    rejects(() => adapter.ingest(wrong, RECEIVED), code);
  }
  const wrong = event(config, 0); wrong.provenance.firmwareBuildId = 'new-build-after-reboot';
  rejects(() => adapter.ingest(wrong, RECEIVED), 'WRONG_BUILD');
});
test('out-of-order arrivals preserve original numbering, pairing and device clocks', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  for (const [band, rep] of [[1, 7], [0, 2], [0, 7], [1, 2]]) adapter.ingest(event(config, band, rep), RECEIVED);
  const values = adapter.snapshot();
  assert.deepEqual(values.map(value => value.repIndex), [2, 7]);
  assert.ok(values.every(value => value.complete));
  assert.equal(values[1].bands[0].capturedAt.value, 35000);
  assert.equal(values[1].bands[0].capturedAt.kind, 'device-monotonic');
});
test('configuration and caller event mutations cannot rewrite captured provenance', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config), input = event(config, 0);
  const result = adapter.ingest(input, RECEIVED);
  input.metrics.range.value = 1; input.provenance.calibrationId = 'invented-later';
  config.bands[0].negotiation.firmwareBuildId = 'new';
  assert.equal(result.event.metrics.range.value, 116); assert.equal(result.event.provenance.calibrationId, null);
  assert.equal(adapter.configuration.bands[0].negotiation.firmwareBuildId, 'fixture-build-1');
  assert.throws(() => { result.pair.bands[0].metrics.range.value = 3; }, TypeError);
});
test('non-final, malformed metrics, units, indices and non-JSON values are rejected', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  const cases = [
    [value => { value.status = 'partial'; }, 'NOT_FINALIZED'],
    [value => { value.metrics.range.unit = 'percent'; }, 'UNSUPPORTED_UNIT'],
    [value => { value.metrics.range.value = -1; }, 'INVALID_METRIC'],
    [value => { value.metrics.range.value = NaN; }, 'INVALID_JSON'],
    [value => { value.repIndex = 0; }, 'INVALID_INDEX'],
    [value => { delete value.metrics.duration; }, 'INVALID_METRICS'],
    [value => { Object.assign(value.metrics.duration, { validity: 'missing', value: 0, reason: 'gap' }); }, 'INVALID_METRIC'],
    [value => { Object.assign(value.metrics.duration, { validity: 'missing', value: null, reason: null }); }, 'INVALID_ID'],
  ];
  for (const [amend, code] of cases) { const input = event(config, 0); amend(input); rejects(() => adapter.ingest(input, RECEIVED), code); }
  assert.equal(adapter.snapshot().length, 0);
});
test('invalid receive time and unknown capture clock are not fabricated', () => {
  const config = configuration(), adapter = createFinalizedRepAdapter(config);
  rejects(() => adapter.ingest(event(config, 0), '2026-02-30T14:00:00.000Z'), 'INVALID_TIME');
  const input = event(config, 0); input.capturedAt.kind = 'unknown';
  rejects(() => adapter.ingest(input, RECEIVED), 'INVALID_TIME');
});
test('set memory limit rejects another rep but permits a missing counterpart and duplicate', () => {
  const config = configuration(); config.maxReps = 1;
  const adapter = createFinalizedRepAdapter(config);
  adapter.ingest(event(config, 0), RECEIVED);
  rejects(() => adapter.ingest(event(config, 0, 2), RECEIVED), 'CAPACITY_LIMIT');
  assert.equal(adapter.ingest(event(config, 1), RECEIVED).pair.complete, true);
  assert.equal(adapter.ingest(event(config, 0), RECEIVED).status, 'duplicate');
});
test('two sets both containing rep one have distinct canonical keys', () => {
  const config = configuration(), first = pair(config).result;
  const secondConfig = copy(config); secondConfig.setId = 'fixture-set-2'; secondConfig.setIndex = 2;
  const second = pair(secondConfig).result;
  assert.notEqual(first.key, second.key); assert.equal(first.repIndex, second.repIndex);
});
test('duplicate slots, devices and placements are rejected before capture', () => {
  for (const key of ['slot', 'deviceId']) {
    const config = configuration(); config.bands[1][key] = config.bands[0][key];
    rejects(() => createFinalizedRepAdapter(config), 'INVALID_BANDS');
  }
  const config = configuration(); config.bands[1].side = 'left';
  rejects(() => createFinalizedRepAdapter(config), 'INVALID_PLACEMENT');
});
