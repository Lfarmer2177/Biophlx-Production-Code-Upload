'use strict';

// BIOPHLX proposed contract adapter. No BLE binding; not a 1.3.11 decoder.
const CONTRACT_ID = 'biophlx.finalized-rep';
const CONTRACT_VERSION = '0.1-proposed';
const REQUIRED_CAPABILITIES = Object.freeze([
  'immutable-finalized-rep', 'shared-session-set-rep-identity', 'atomic-set-boundary',
]);
const METRICS = Object.freeze({
  range: { unit: 'deg', scales: { deg: 1, rad: 180 / Math.PI } },
  duration: { unit: 's', scales: { s: 1, ms: 0.001 } },
  angularSpeed: { unit: 'deg/s', scales: { 'deg/s': 1, 'rad/s': 180 / Math.PI } },
});

class ContractError extends Error {
  constructor(code, message) { super(message); this.name = 'ContractError'; this.code = code; }
}
function demand(condition, code, message) {
  if (!condition) throw new ContractError(code, message);
}
function record(value, name) {
  demand(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_SHAPE', `${name} must be an object`);
  return value;
}
function nonempty(value, name) {
  demand(typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value,
    'INVALID_ID', `${name} must be a nonempty string of at most 256 characters`);
  return value;
}
function integer(value, name, minimum = 0) {
  demand(Number.isSafeInteger(value) && value >= minimum, 'INVALID_INDEX', `${name} must be an integer >= ${minimum}`);
  return value;
}
function jsonCopy(value) {
  // Reject non-JSON values instead of silently dropping provenance or replacing NaN.
  function check(item) {
    demand(item !== undefined && typeof item !== 'function' && typeof item !== 'symbol' && typeof item !== 'bigint',
      'INVALID_JSON', 'Contract input must be JSON data');
    if (typeof item === 'number') demand(Number.isFinite(item), 'INVALID_JSON', 'Contract numbers must be finite');
    if (item && typeof item === 'object') {
      demand(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null,
        'INVALID_JSON', 'Contract input must contain plain objects');
      Object.values(item).forEach(check);
    }
  }
  check(value);
  return JSON.parse(JSON.stringify(value));
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function identity(parts) { return JSON.stringify(parts); }
function matching(actual, expected, code, label) {
  demand(actual === expected, code, `${label} does not match the configured session`);
}

function normalizeConfiguration(input) {
  const config = jsonCopy(record(input, 'configuration'));
  ['sessionId', 'exerciseInstanceId', 'exerciseId', 'setId'].forEach(key => nonempty(config[key], key));
  integer(config.setIndex, 'setIndex', 1);
  demand(['fixture', 'negotiated-device'].includes(config.mode), 'CONTRACT_NOT_NEGOTIATED', 'Explicit fixture or negotiated-device mode is required');
  demand(Array.isArray(config.bands) && config.bands.length === 2, 'INVALID_BANDS', 'Exactly two explicitly assigned bands are required');
  config.maxReps = config.maxReps === undefined ? 10000 : integer(config.maxReps, 'maxReps', 1);
  demand(config.maxReps <= 10000, 'CAPACITY_LIMIT', 'A set is limited to 10000 records');
  for (const band of config.bands) {
    record(band, 'band');
    ['slot', 'deviceId', 'deviceRunId', 'exerciseProfileId'].forEach(key => nonempty(band[key], key));
    demand(['left', 'right'].includes(band.side), 'INVALID_PLACEMENT', 'Band side must be left or right');
    demand(['arm', 'thigh'].includes(band.limb), 'INVALID_PLACEMENT', 'Band limb must be arm or thigh');
    const negotiation = record(band.negotiation, 'negotiation');
    matching(negotiation.contractId, CONTRACT_ID, 'CONTRACT_NOT_NEGOTIATED', 'Contract ID');
    matching(negotiation.contractVersion, CONTRACT_VERSION, 'UNSUPPORTED_CONTRACT', 'Contract version');
    demand(negotiation.confirmed === true, 'CONTRACT_NOT_NEGOTIATED', 'Contract must be explicitly confirmed');
    matching(negotiation.source, config.mode === 'fixture' ? 'fixture' : 'verified-device-handshake',
      'CONTRACT_NOT_NEGOTIATED', 'Negotiation evidence source');
    ['evidenceRef', 'firmwareVersion', 'firmwareBuildId'].forEach(key => nonempty(negotiation[key], key));
    demand(Array.isArray(negotiation.capabilities) && REQUIRED_CAPABILITIES.every(capability => negotiation.capabilities.includes(capability)),
      'MISSING_CAPABILITY', 'Finalized event, shared identity, and atomic set-boundary capabilities are required');
  }
  for (const key of ['slot', 'deviceId']) {
    demand(new Set(config.bands.map(band => band[key])).size === 2, 'INVALID_BANDS', `Both bands must have distinct ${key}`);
  }
  demand(new Set(config.bands.map(band => identity([band.side, band.limb]))).size === 2,
    'INVALID_PLACEMENT', 'The same physical placement cannot be assigned twice');
  return freeze(config);
}

function normalizeMetric(input, name) {
  const metric = record(input, name);
  const definition = METRICS[name];
  nonempty(metric.definitionId, `${name}.definitionId`);
  demand(['whole-rep', 'concentric', 'eccentric'].includes(metric.phase), 'INVALID_PHASE', `${name} phase is required`);
  demand(Object.prototype.hasOwnProperty.call(definition.scales, metric.unit), 'UNSUPPORTED_UNIT', `${name} unit is unsupported`);
  demand(['valid', 'missing', 'invalid', 'unsupported'].includes(metric.validity), 'INVALID_VALIDITY', `${name} validity is required`);
  if (metric.validity === 'valid') {
    demand(Number.isFinite(metric.value) && metric.value >= 0, 'INVALID_METRIC', `${name} requires a finite nonnegative measurement`);
    demand(metric.reason === null || metric.reason === undefined, 'INVALID_VALIDITY', `${name} valid measurement cannot carry a failure reason`);
  } else {
    demand(metric.value === null, 'INVALID_METRIC', `${name} unavailable value must be null`);
    nonempty(metric.reason, `${name}.reason`);
  }
  const value = metric.validity === 'valid' ? metric.value * definition.scales[metric.unit] : null;
  demand(value === null || Number.isFinite(value), 'INVALID_METRIC', `${name} conversion exceeds numeric range`);
  return {
    value, unit: definition.unit, validity: metric.validity, reason: metric.reason || null,
    definitionId: metric.definitionId, phase: metric.phase,
    rawValue: metric.value, rawUnit: metric.unit,
  };
}

function normalizeEvent(input, receivedAt, config) {
  const event = jsonCopy(record(input, 'event'));
  matching(event.contractId, CONTRACT_ID, 'UNSUPPORTED_CONTRACT', 'Event contract ID');
  matching(event.contractVersion, CONTRACT_VERSION, 'UNSUPPORTED_CONTRACT', 'Event contract version');
  matching(event.status, 'finalized', 'NOT_FINALIZED', 'Event status');
  ['eventId', 'logicalRepId', 'deviceId', 'deviceRunId'].forEach(key => nonempty(event[key], key));
  integer(event.sequence, 'sequence');
  integer(event.repIndex, 'repIndex', 1);
  integer(event.setIndex, 'setIndex', 1);
  for (const key of ['sessionId', 'exerciseInstanceId', 'exerciseId']) matching(event[key], config[key], 'WRONG_SESSION', key);
  for (const key of ['setId', 'setIndex']) matching(event[key], config[key], 'WRONG_SET', key);
  const band = config.bands.find(item => item.deviceId === event.deviceId);
  demand(band, 'UNKNOWN_DEVICE', 'Event is not from an assigned device');
  matching(event.deviceRunId, band.deviceRunId, 'WRONG_DEVICE_RUN', 'Device run');
  matching(event.slot, band.slot, 'WRONG_PLACEMENT', 'Band slot');
  for (const key of ['side', 'limb']) matching(event[key], band[key], 'WRONG_PLACEMENT', key);
  const provenance = record(event.provenance, 'provenance');
  matching(provenance.firmwareVersion, band.negotiation.firmwareVersion, 'WRONG_BUILD', 'Firmware version');
  matching(provenance.firmwareBuildId, band.negotiation.firmwareBuildId, 'WRONG_BUILD', 'Firmware build');
  matching(provenance.exerciseProfileId, band.exerciseProfileId, 'WRONG_PROFILE', 'Exercise profile');
  demand(provenance.calibrationId === null || typeof provenance.calibrationId === 'string', 'INVALID_PROVENANCE', 'Unknown calibration must be null');
  if (provenance.calibrationId !== null) nonempty(provenance.calibrationId, 'calibrationId');
  const capture = record(event.capturedAt, 'capturedAt');
  integer(capture.value, 'capturedAt.value');
  matching(capture.unit, 'ms', 'INVALID_TIME', 'Capture time unit');
  demand(['device-monotonic', 'device-utc'].includes(capture.kind), 'INVALID_TIME', 'Capture clock kind is required');
  nonempty(capture.clockId, 'capturedAt.clockId');
  demand(typeof receivedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(receivedAt)
    && Number.isFinite(Date.parse(receivedAt)) && new Date(receivedAt).toISOString() === receivedAt,
    'INVALID_TIME', 'App receive time must be canonical ISO UTC with milliseconds');
  record(event.metrics, 'metrics');
  demand(Object.keys(event.metrics).length === 3 && Object.keys(METRICS).every(key => Object.prototype.hasOwnProperty.call(event.metrics, key)),
    'INVALID_METRICS', 'Contract 0.1 requires range, duration and angularSpeed, including explicit unavailable entries');
  const normalized = {
    contractId: CONTRACT_ID, contractVersion: CONTRACT_VERSION,
    sessionId: event.sessionId, exerciseInstanceId: event.exerciseInstanceId, exerciseId: event.exerciseId,
    setId: event.setId, setIndex: event.setIndex, logicalRepId: event.logicalRepId, repIndex: event.repIndex,
    eventId: event.eventId, sequence: event.sequence, deviceId: event.deviceId, deviceRunId: event.deviceRunId,
    slot: event.slot, side: event.side, limb: event.limb, capturedAt: event.capturedAt, receivedAt,
    provenance: { ...provenance, contractId: CONTRACT_ID, contractVersion: CONTRACT_VERSION,
      negotiationSource: band.negotiation.source, negotiationEvidenceRef: band.negotiation.evidenceRef },
    metrics: Object.fromEntries(Object.keys(METRICS).map(name => [name, normalizeMetric(event.metrics[name], name)])),
    raw: event,
  };
  return freeze(normalized);
}

function combinePair(entries, config) {
  const results = config.bands.map(band => entries.find(event => event.slot === band.slot) || null);
  const first = entries[0];
  const combined = {};
  for (const name of Object.keys(METRICS)) {
    const values = results.map(event => event && event.metrics[name]);
    const validBandCount = values.filter(value => value && value.validity === 'valid').length;
    let reason = null;
    if (results.some(event => !event)) reason = 'missing-band';
    else if (results[0].limb !== results[1].limb) reason = 'incompatible-placement';
    else if (values[0].definitionId !== values[1].definitionId) reason = 'incompatible-definition';
    else if (values[0].phase !== values[1].phase) reason = 'incompatible-phase';
    else if (validBandCount !== 2) reason = 'unavailable-metric';
    combined[name] = {
      value: reason ? null : values[0].value / 2 + values[1].value / 2,
      unit: METRICS[name].unit, validity: reason ? 'unavailable' : 'valid', reason,
      validBandCount, pairedValidCount: reason ? 0 : 1,
      definitionId: reason ? null : values[0].definitionId,
      phase: reason ? null : values[0].phase,
    };
  }
  return freeze({
    key: identity([first.sessionId, first.exerciseInstanceId, first.setId, first.repIndex]),
    sessionId: first.sessionId, exerciseInstanceId: first.exerciseInstanceId, exerciseId: first.exerciseId,
    setId: first.setId, setIndex: first.setIndex, logicalRepId: first.logicalRepId, repIndex: first.repIndex,
    complete: results.every(Boolean), missingSlots: config.bands.filter((_, index) => !results[index]).map(band => band.slot),
    bands: results, combined,
    calculationVersion: 'paired-mean/0.1-proposed', evidenceMode: config.mode,
  });
}

function createFinalizedRepAdapter(input) {
  const config = normalizeConfiguration(input);
  const events = new Map();
  const sequences = new Map();
  const reps = new Map();
  const logicalRepIndexes = new Map();
  return Object.freeze({
    configuration: config,
    ingest(inputEvent, receivedAt) {
      // Validate before mutation; rejected input cannot poison subsequent captures.
      const event = normalizeEvent(inputEvent, receivedAt, config);
      const eventKey = identity([event.deviceId, event.deviceRunId, event.eventId]);
      const signature = canonical(event.raw);
      if (events.has(eventKey)) {
        demand(events.get(eventKey).signature === signature, 'CONFLICTING_EVENT', 'An immutable event ID was reused with a changed payload');
        return freeze({ status: 'duplicate', event: events.get(eventKey).event, pair: combinePair(reps.get(event.repIndex), config) });
      }
      const sequenceKey = identity([event.deviceId, event.deviceRunId, event.sequence]);
      demand(!sequences.has(sequenceKey), 'CONFLICTING_SEQUENCE', 'Device sequence was reused for another event');
      const entries = reps.get(event.repIndex) || [];
      demand(!entries.some(existing => existing.deviceId === event.deviceId), 'CONFLICTING_REP', 'A band finalized the same rep more than once');
      demand(entries.every(existing => existing.logicalRepId === event.logicalRepId), 'CONFLICTING_REP_ID', 'The bands disagree on logical rep identity');
      demand(!logicalRepIndexes.has(event.logicalRepId) || logicalRepIndexes.get(event.logicalRepId) === event.repIndex,
        'CONFLICTING_REP_INDEX', 'Logical rep identity was reused at a different index');
      demand(reps.has(event.repIndex) || reps.size < config.maxReps, 'CAPACITY_LIMIT', 'Set capacity reached; preserve data before creating another adapter');
      const updated = [...entries, event];
      events.set(eventKey, { signature, event });
      sequences.set(sequenceKey, eventKey);
      logicalRepIndexes.set(event.logicalRepId, event.repIndex);
      reps.set(event.repIndex, updated);
      return freeze({ status: 'accepted', event, pair: combinePair(updated, config) });
    },
    snapshot() { return freeze([...reps.keys()].sort((a, b) => a - b).map(index => combinePair(reps.get(index), config))); },
  });
}

module.exports = { CONTRACT_ID, CONTRACT_VERSION, REQUIRED_CAPABILITIES, ContractError, createFinalizedRepAdapter };
