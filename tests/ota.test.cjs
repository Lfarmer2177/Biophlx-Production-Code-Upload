const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const directory = path.join(__dirname, '../src/services/ota');
const url = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const protocolUrl = url(fs.readFileSync(path.join(directory, 'protocol.js'), 'utf8'));
const protocolPromise = import(protocolUrl);
const updaterPromise = import(url(fs.readFileSync(path.join(directory, 'updater.js'), 'utf8').replace("'./protocol'", JSON.stringify(protocolUrl))));
const uint32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b.toString('base64'); };
const shortTimeouts = { operation: 100, start: 100, resend: 12, stall: 200, resume: 200, verify: 250, reboot: 200, recovery: 5, poll: 1, readInterval: 5, total: 1000 };
function fixture(length = 8192) {
  // Real gzip + MD5 fixture; device transport simulation does not claim to flash it.
  const image = crypto.randomBytes(length);
  image[0] = 0xe9;
  const bytes = new Uint8Array(zlib.gzipSync(image));
  return { bytes, imageSize: length, gzipMd5: crypto.createHash('md5').update(bytes).digest('hex'),
    imageMd5: crypto.createHash('md5').update(image).digest('hex'), targetVersion: '1.3.12' };
}
async function fakeBand(artifact, options = {}) {
  const { OTA_UUIDS } = await protocolPromise;
  const callbacks = new Set(), disconnects = new Set();
  let accepted = 0, dropped = false, disconnected = false, completeStarted = false;
  let version = 0x0103000b, status = 0, md5 = null, payload = null;
  const acceptedBytes = [], writes = [], starts = [];
  const timers = [];
  const schedule = (action, delay) => timers.push(setTimeout(action, delay));
  const emit = value => { status = value >>> 0; for (const callback of callbacks) callback(null, { value: uint32(status) }); };
  const loseLink = () => { disconnected = true; for (const callback of disconnects) callback(null, device); };
  function finishIfReady() {
    if (!md5 || acceptedBytes.reduce((n, bytes) => n + bytes.length, 0) !== artifact.bytes.length || completeStarted || options.neverVerify) return;
    completeStarted = true;
    assert.equal(md5, artifact.imageMd5);
    if (options.rejectImage) { emit(0xfffffffe); return; }
    emit(0xffffffff);
    schedule(() => {
      if (!options.omitSuccess) emit(0xfffffff0);
      schedule(() => {
        version = options.wrongVersion ? 0x0103000d : 0x0103000c;
        status = 0;
        loseLink();
      }, 2);
    }, 2);
  }
  const device = {
    id: 'test-band-serial-1', mtu: options.mtu || 247,
    async discoverAllServicesAndCharacteristics() { return this; },
    async characteristicsForService() { return Object.values(OTA_UUIDS).filter(v => v !== OTA_UUIDS.service && (!options.noStart || v !== OTA_UUIDS.start)).map(uuid => ({ uuid })); },
    async requestMTU() { return this; }, async requestConnectionPriority() { return this; },
    monitorCharacteristicForService(service, characteristic, callback) { callbacks.add(callback); return { remove: () => callbacks.delete(callback) }; },
    onDisconnected(callback) { disconnects.add(callback); return { remove: () => disconnects.delete(callback) }; },
    async readCharacteristicForService(service, characteristic) {
      if (disconnected) throw new Error('Disconnected');
      return { value: uint32(characteristic === OTA_UUIDS.version ? version : status) };
    },
    async writeCharacteristicWithResponseForService(service, characteristic, encoded) {
      if (disconnected) throw new Error('Disconnected');
      const bytes = Buffer.from(encoded, 'base64');
      writes.push({ characteristic, bytes });
      if (characteristic === OTA_UUIDS.start) {
        starts.push(bytes);
        assert.equal(bytes.length, 22);
        assert.equal(bytes.readUInt32LE(0), artifact.bytes.length);
        assert.equal(bytes.subarray(4, 20).toString('hex'), artifact.gzipMd5);
        if (options.rejectStart) { emit(0xfffffffe); return; }
        emit(0xffffffff);
        queueMicrotask(() => emit((0x80000000 | accepted) >>> 0));
      } else if (characteristic === OTA_UUIDS.version && bytes.toString() === 'RESET') {
        emit(0xfffffffe);
      } else if (characteristic === OTA_UUIDS.version) {
        md5 = bytes.toString();
        finishIfReady();
        if (options.dropMd5Response && !options.didDropMd5Response) {
          options.didDropMd5Response = true;
          loseLink();
          throw new Error('MD5 response lost');
        }
      }
      return this;
    },
    async writeCharacteristicWithoutResponseForService(service, characteristic, encoded) {
      if (disconnected) throw new Error('Disconnected');
      const bytes = Buffer.from(encoded, 'base64');
      const sequence = bytes.readUInt16LE(0);
      writes.push({ characteristic, sequence, bytes });
      if (options.onPacket) options.onPacket(sequence);
      if (options.disconnectAt === sequence && !options.didDisconnect) {
        options.didDisconnect = true; loseLink(); throw new Error('Radio dropped');
      }
      if (options.dropSequence === sequence && !dropped) { dropped = true; return this; }
      if (options.dropAllData) return this;
      if (sequence < accepted) return this;
      if (sequence > accepted) { emit(0x80000000 | accepted); return this; }
      payload = payload || bytes.length - 2;
      acceptedBytes.push(bytes.subarray(2)); accepted++;
      if (accepted % 16 === 0 && !options.suppressAcks) emit(0x80000000 | accepted);
      finishIfReady();
      return this;
    },
  };
  return { device, writes, starts,
    reconnect: async () => { disconnected = false; if (options.reconnectMtu) device.mtu = options.reconnectMtu; return device; },
    joined: () => Buffer.concat(acceptedBytes),
    listenerCount: () => callbacks.size + disconnects.size,
    clear: () => timers.forEach(clearTimeout),
  };
}

test('wire messages preserve two distinct checksums and little-endian status/version fields', async () => {
  const p = await protocolPromise;
  const artifact = fixture();
  const start = Buffer.from(p.encodeStart(artifact));
  assert.equal(start.subarray(4, 20).toString('hex'), artifact.gzipMd5);
  assert.notEqual(artifact.gzipMd5, artifact.imageMd5);
  assert.deepEqual(p.decodeControl(Buffer.from('30010080', 'hex')), { kind: 'ack', sequence: 304 });
  assert.deepEqual(p.decodeControl(Buffer.from('ffffffff', 'hex')), { kind: 'busy' });
  assert.deepEqual(p.decodeControl(Buffer.from('f0ffffff', 'hex')), { kind: 'success' });
  assert.throws(() => p.decodeControl(Buffer.from('f1ffffff', 'hex')), /unsupported/);
  assert.equal(p.formatVersion(p.uint32(Buffer.from('0b000301', 'hex'))), '1.3.11');
  for (const length of [0, 1, 2, 3, 244, 1024]) {
    const input = crypto.randomBytes(length);
    assert.equal(p.bytesToBase64(input), input.toString('base64'));
    assert.deepEqual(Buffer.from(p.base64ToBytes(input.toString('base64'))), input);
  }
  assert.throws(() => p.base64ToBytes('not base64'), /invalid/);
});

test('preflight rejects malformed images and unsafe MTU, sequence, or changed packet boundaries', async () => {
  const p = await protocolPromise;
  const artifact = fixture();
  assert.throws(() => p.validateArtifact({ ...artifact, imageSize: 1025 }), /4096/);
  assert.throws(() => p.validateArtifact({ ...artifact, imageMd5: 'wrong' }), /checksum/);
  assert.throws(() => p.validateTransfer(1000, 23), /Bluetooth/);
  assert.throws(() => p.validateTransfer(1000, 100, 242), /packet size changed/);
  assert.throws(() => p.validateTransfer(1376256, 35, 18), /packet size/);
  assert.deepEqual(p.validateTransfer(1000, 247), { payload: 242, packetCount: 5 });
});

test('finishes when the device never emits a final ACK and confirms version after reboot', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(4096), fake = await fakeBand(artifact);
  const events = [];
  try {
    const updater = createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, onProgress: e => events.push(e), timeouts: shortTimeouts });
    const result = await updater.run(artifact);
    assert.equal(result.version, '1.3.12');
    assert.equal(result.recovered, false, 'normal reboot confirmation is not a transfer recovery');
    assert.deepEqual(fake.joined(), Buffer.from(artifact.bytes));
    assert.equal(fake.starts.length, 1, 'reboot verification must not start a second flash');
    assert.equal(fake.listenerCount(), 0);
    assert.ok(events.some(e => e.phase === 'verifying' && !e.cancellable));
    assert.equal(updater.cancel(), false);
  } finally { fake.clear(); }
});

test('recovers a missing packet using the cumulative window without duplicating image bytes', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(16384), fake = await fakeBand(artifact, { dropSequence: 11 });
  try {
    await createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run(artifact);
    assert.deepEqual(fake.joined(), Buffer.from(artifact.bytes));
    assert.ok(fake.writes.filter(w => w.sequence === 11).length > 1);
  } finally { fake.clear(); }
});

test('reconnect resumes the same live session and preserves payload/identity', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(16384), fake = await fakeBand(artifact, { disconnectAt: 20 });
  try {
    const result = await createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run(artifact);
    assert.equal(result.recovered, true);
    assert.equal(fake.starts.length, 2);
    assert.deepEqual(fake.starts[0], fake.starts[1]);
    assert.deepEqual(fake.joined(), Buffer.from(artifact.bytes));
  } finally { fake.clear(); }
});

test('a disconnect after MD5 does not restart an image that is already verifying', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(4096), fake = await fakeBand(artifact, { dropMd5Response: true, omitSuccess: true });
  try {
    const result = await createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run(artifact);
    assert.equal(result.version, '1.3.12');
    assert.equal(fake.starts.length, 1);
  } finally { fake.clear(); }
});

test('does not permit cancel after MD5 has been sent, even before verification status arrives', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(4096), fake = await fakeBand(artifact);
  let updater, cancelled;
  try {
    updater = createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts, onProgress: event => {
      if (event.phase === 'verifying') cancelled = updater.cancel();
    } });
    await updater.run(artifact);
    assert.equal(cancelled, false);
  } finally { fake.clear(); }
});

test('cancel during transfer sends RESET, never sends final MD5, and cleans subscriptions', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(8192);
  let updater;
  const fake = await fakeBand(artifact, { onPacket: sequence => { if (sequence === 5) assert.equal(updater.cancel(), true); } });
  try {
    updater = createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts });
    await assert.rejects(updater.run(artifact), e => e.code === 'CANCELLED');
    assert.ok(fake.writes.some(w => w.bytes.toString() === 'RESET'));
    assert.ok(!fake.writes.some(w => w.bytes.toString() === artifact.imageMd5));
    assert.equal(fake.listenerCount(), 0);
  } finally { fake.clear(); }
});

test('missing OTA service, image rejection and changed MTU fail without reporting Updated', async () => {
  const { createOtaUpdater } = await updaterPromise;
  for (const [options, code] of [[{ noStart: true }, 'OTA_UNSUPPORTED'], [{ rejectImage: true }, 'DEVICE_REJECTED'], [{ disconnectAt: 20, reconnectMtu: 100 }, 'MTU_CHANGED']]) {
    const artifact = fixture(8192), fake = await fakeBand(artifact, options);
    try {
      const updater = createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts });
      await assert.rejects(updater.run(artifact), error => error.code === code);
      assert.equal(updater.getState().phase, 'failed');
      assert.equal(fake.listenerCount(), 0);
    } finally { fake.clear(); }
  }
});

test('same-version update is rejected before any START and wrong post-reboot version is not success', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(4096), fake = await fakeBand(artifact);
  try {
    await assert.rejects(createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run({ ...artifact, targetVersion: '1.3.11' }), e => e.code === 'NOT_NEWER');
    assert.equal(fake.starts.length, 0);
  } finally { fake.clear(); }
  const wrong = await fakeBand(artifact, { wrongVersion: true });
  try {
    await assert.rejects(createOtaUpdater({ device: wrong.device, reconnect: wrong.reconnect, timeouts: shortTimeouts }).run(artifact), e => e.code === 'UNEXPECTED_VERSION');
  } finally { wrong.clear(); }
});

test('lost final packet is retransmitted after MD5 without treating sent bytes as success', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(4096);
  const lastSequence = Math.ceil(artifact.bytes.length / 242) - 1;
  const fake = await fakeBand(artifact, { dropSequence: lastSequence });
  try {
    const result = await createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run(artifact);
    assert.equal(result.version, '1.3.12');
    assert.ok(fake.writes.filter(w => w.sequence === lastSequence).length > 1);
    assert.deepEqual(fake.joined(), Buffer.from(artifact.bytes));
  } finally { fake.clear(); }
});

test('a stalled receiver never opens the 32-packet window and cannot produce success', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(16384), fake = await fakeBand(artifact, { dropAllData: true });
  try {
    const updater = createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: { ...shortTimeouts, stall: 45 } });
    await assert.rejects(updater.run(artifact), e => e.code === 'TRANSFER_STALLED');
    assert.ok(fake.writes.filter(w => w.sequence != null).every(w => w.sequence < 32));
    assert.ok(!fake.writes.some(w => w.bytes.toString() === artifact.imageMd5));
    assert.equal(fake.listenerCount(), 0);
  } finally { fake.clear(); }
});

test('a valid transfer also works with smaller fixed negotiated packets', async () => {
  const { createOtaUpdater } = await updaterPromise;
  const artifact = fixture(8192), fake = await fakeBand(artifact, { mtu: 100 });
  try {
    await createOtaUpdater({ device: fake.device, reconnect: fake.reconnect, timeouts: shortTimeouts }).run(artifact);
    assert.ok(fake.writes.filter(w => w.sequence != null).every(w => w.bytes.length <= 97));
    assert.deepEqual(fake.joined(), Buffer.from(artifact.bytes));
  } finally { fake.clear(); }
});
