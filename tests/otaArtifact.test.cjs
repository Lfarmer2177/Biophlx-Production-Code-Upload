const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

// Exercise the actual platform-neutral validator with its real JS dependencies.
// No firmware executable or physical band is used by these tests.
const source = fs.readFileSync(path.join(__dirname, '../src/services/otaArtifact.js'), 'utf8')
  .replace("import { Inflate } from 'pako';", "const { Inflate } = require('pako');")
  .replace("import { Md5 } from '@smithy/md5-js';", "const { Md5 } = require('@smithy/md5-js');")
  .replace(/export (const|function|async function) /g, '$1 ');
const api = {};
new Function('require', 'exports', source + '\nObject.assign(exports,{validateFirmwareArtifact,validateTarget,OTA_SLOT_SIZE});')(require, api);

function imageFixture(size = 4096, firstByte = 0xe9) {
  const image = Buffer.alloc(size, 0xff);
  image[0] = firstByte;
  // Data is intentionally deterministic; these are image-shaped validation fixtures.
  image.write('BIOPHLX artifact validator test', 24, 'ascii');
  return { image, bytes: new Uint8Array(zlib.gzipSync(image)), expectedImageMd5: crypto.createHash('md5').update(image).digest('hex') };
}
const options = fixture => ({ targetVersion: '1.3.12', hardware: '1.3', currentVersion: '1.3.11', expectedImageMd5: fixture.expectedImageMd5 });

test('valid gzip is inflated and both distinct MD5 values are checked against independent Node hashes', async () => {
  const fixture = imageFixture();
  const result = await api.validateFirmwareArtifact(fixture.bytes, options(fixture));
  assert.equal(result.imageSize, 4096);
  assert.equal(result.imageMd5, fixture.expectedImageMd5);
  assert.equal(result.gzipMd5, crypto.createHash('md5').update(fixture.bytes).digest('hex'));
  assert.notEqual(result.gzipMd5, result.imageMd5);
  assert.equal(result.targetVersion, '1.3.12');
  assert.equal(result.hardware, '1.3');
});

test('release checksum mismatch and malformed checksums are rejected before transport', async () => {
  const fixture = imageFixture();
  await assert.rejects(api.validateFirmwareArtifact(fixture.bytes, { ...options(fixture), expectedImageMd5: '0'.repeat(32) }), /does not match/);
  await assert.rejects(api.validateFirmwareArtifact(fixture.bytes, { ...options(fixture), expectedImageMd5: 'not-a-checksum' }), /MD5/);
});

test('corrupted gzip trailer and truncated gzip are rejected', async () => {
  const fixture = imageFixture();
  const corrupt = fixture.bytes.slice();
  corrupt[corrupt.length - 8] ^= 0x80; // corrupt CRC32 without changing the decompressed body
  await assert.rejects(api.validateFirmwareArtifact(corrupt, options(fixture)), /damaged|incomplete/);
  await assert.rejects(api.validateFirmwareArtifact(fixture.bytes.subarray(0, fixture.bytes.length - 10), options(fixture)), /damaged|incomplete/);
});

test('a small gzip that inflates beyond the application slot is stopped', async () => {
  const fixture = imageFixture(api.OTA_SLOT_SIZE + 4096);
  assert.ok(fixture.bytes.length < 10000, 'compression expansion test must use a small input');
  await assert.rejects(api.validateFirmwareArtifact(fixture.bytes, options(fixture)), /Uncompressed image exceeds/);
});

test('compressed file size and raw/non-gzip files are rejected', async () => {
  const fixture = imageFixture();
  await assert.rejects(api.validateFirmwareArtifact(new Uint8Array(api.OTA_SLOT_SIZE + 1), options(fixture)), /Compressed image/);
  await assert.rejects(api.validateFirmwareArtifact(new Uint8Array(), options(fixture)), /empty/);
  await assert.rejects(api.validateFirmwareArtifact(new Uint8Array(fixture.image), options(fixture)), /firmware.bin.gz/);
});

test('unpadded and non-ESP32-shaped decompressed images are rejected', async () => {
  const unaligned = imageFixture(4095);
  await assert.rejects(api.validateFirmwareArtifact(unaligned.bytes, options(unaligned)), /4096-byte boundary/);
  const wrongMagic = imageFixture(4096, 0x90);
  await assert.rejects(api.validateFirmwareArtifact(wrongMagic.bytes, options(wrongMagic)), /ESP32 application image/);
});

test('target version must match verified hardware and advance installed firmware', () => {
  assert.throws(() => api.validateTarget('1.2.12', '1.3', '1.3.11'), /does not match/);
  assert.throws(() => api.validateTarget('1.3.12', null, '1.3.11'), /identity is unavailable/);
  assert.throws(() => api.validateTarget('1.3.11', '1.3', '1.3.11'), /unique target/);
  assert.throws(() => api.validateTarget('1.3.10', '1.3', '1.3.11'), /newer release/);
  assert.doesNotThrow(() => api.validateTarget('1.3.12', '1.3', '1.3.11'));
});

test('malformed and overflowing release versions are rejected', () => {
  for (const target of ['latest', '1.3', '1.3.12-rc2', '-1.3.12', '1.3.65536', '256.3.12', '1.256.12']) {
    assert.throws(() => api.validateTarget(target, '1.3', '1.3.11'));
  }
});
