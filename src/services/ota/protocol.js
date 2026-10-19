// BIOPHLX BLE OTA v1.3.11. All multibyte wire fields are little-endian.
export const OTA_UUIDS = Object.freeze({
  service: 'eae2f5f4-b18f-4f4d-0003-100000000000',
  version: 'eae2f5f4-b18f-4f4d-0003-100000000001',
  control: 'eae2f5f4-b18f-4f4d-0003-100000000002',
  packet: 'eae2f5f4-b18f-4f4d-0003-100000000003',
  start: 'eae2f5f4-b18f-4f4d-0003-100000000006',
});
export const OTA_SLOT_SIZE = 0x150000;
export const OTA_WINDOW = 32;
export class OtaError extends Error {
  constructor(code, message) { super(message); this.name = 'OtaError'; this.code = code; }
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] || 0, c = bytes[i + 2] || 0;
    result += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | (b >>> 4)]
      + (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >>> 6)] : '=')
      + (i + 2 < bytes.length ? alphabet[c & 63] : '=');
  }
  return result;
}
export function base64ToBytes(text) {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
    throw new OtaError('INVALID_RESPONSE', 'The band returned invalid encoded data.');
  }
  const size = text.length / 4 * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(size);
  for (let i = 0, j = 0; i < text.length; i += 4) {
    const value = (alphabet.indexOf(text[i]) << 18) | (alphabet.indexOf(text[i + 1]) << 12)
      | (Math.max(0, alphabet.indexOf(text[i + 2])) << 6) | Math.max(0, alphabet.indexOf(text[i + 3]));
    if (j < size) bytes[j++] = (value >>> 16) & 255;
    if (j < size) bytes[j++] = (value >>> 8) & 255;
    if (j < size) bytes[j++] = value & 255;
  }
  return bytes;
}
export function uint32(bytes) {
  if (!bytes || bytes.length !== 4) throw new OtaError('INVALID_RESPONSE', 'Expected a four-byte band response.');
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}
export function decodeControl(bytes) {
  const value = uint32(bytes);
  if (value === 0) return { kind: 'idle' };
  if (value === 0xffffffff) return { kind: 'busy' };
  if (value === 0xfffffffe) return { kind: 'error' };
  if (value === 0xfffffff0) return { kind: 'success' };
  if (value >= 0xfffffff0 || ((value & 0xffff0000) >>> 0) !== 0x80000000) {
    throw new OtaError('INVALID_RESPONSE', 'The band returned an unsupported update status.');
  }
  return { kind: 'ack', sequence: value & 0xffff };
}
export function versionNumber(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/.exec(String(version));
  if (!match) throw new OtaError('INVALID_VERSION', 'A firmware version such as 1.3.12 is required.');
  const [major, minor, release] = match.slice(1).map(Number);
  if (major > 255 || minor > 255 || release > 65535) throw new OtaError('INVALID_VERSION', 'The firmware version exceeds the device format.');
  return ((major * 0x1000000) + (minor * 0x10000) + release) >>> 0;
}
export function formatVersion(value) { return `${value >>> 24}.${(value >>> 16) & 255}.${value & 65535}`; }
export function validateArtifact(artifact) {
  if (!(artifact?.bytes instanceof Uint8Array) || artifact.bytes.length < 18 || artifact.bytes.length > OTA_SLOT_SIZE
      || artifact.bytes[0] !== 0x1f || artifact.bytes[1] !== 0x8b || artifact.bytes[2] !== 8) {
    throw new OtaError('INVALID_ARTIFACT', 'Select a validated BIOPHLX firmware gzip file that fits the update slot.');
  }
  if (!Number.isInteger(artifact.imageSize) || artifact.imageSize <= 0 || artifact.imageSize > OTA_SLOT_SIZE || artifact.imageSize % 4096 !== 0) {
    throw new OtaError('INVALID_ARTIFACT', 'The firmware image must fit the band and be padded to 4096 bytes.');
  }
  for (const field of ['gzipMd5', 'imageMd5']) {
    if (!/^[0-9a-f]{32}$/i.test(artifact[field] || '')) throw new OtaError('INVALID_ARTIFACT', `The ${field} checksum is missing or invalid.`);
  }
  versionNumber(artifact.targetVersion);
  // Hash/signature, decompression and board checks belong to the artifact validator.
  // This boundary intentionally receives an already validated artifact, not a URL/file.
  return artifact;
}
export function validateTransfer(size, mtu, originalPayload) {
  if (!Number.isInteger(mtu) || mtu < 35) throw new OtaError('MTU_TOO_SMALL', 'The Bluetooth connection cannot carry the update commands. Reconnect and try again.');
  const available = Math.min(242, mtu - 5);
  const payload = originalPayload ?? available;
  if (!Number.isInteger(payload) || payload < 1 || payload > available) throw new OtaError('MTU_CHANGED', 'Bluetooth packet size changed. Stop this attempt and restart the update.');
  const packetCount = Math.ceil(size / payload);
  if (!Number.isInteger(size) || size <= 0 || size > OTA_SLOT_SIZE || packetCount > 65535) throw new OtaError('TRANSFER_TOO_LARGE', 'This image cannot be transferred with the negotiated Bluetooth packet size.');
  return { payload, packetCount };
}
export function encodeStart(artifact) {
  const bytes = new Uint8Array(22);
  new DataView(bytes.buffer).setUint32(0, artifact.bytes.length, true);
  for (let i = 0; i < 16; i++) bytes[i + 4] = parseInt(artifact.gzipMd5.slice(i * 2, i * 2 + 2), 16);
  return bytes; // silent=0; full gzip=0
}
export function encodePacket(image, sequence, payload) {
  const offset = sequence * payload;
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= 65535 || offset >= image.length) throw new OtaError('INVALID_SEQUENCE', 'The update packet sequence is invalid.');
  const bytes = new Uint8Array(2 + Math.min(payload, image.length - offset));
  new DataView(bytes.buffer).setUint16(0, sequence, true);
  bytes.set(image.subarray(offset, offset + payload), 2);
  return bytes;
}
export function asciiBytes(text) { return Uint8Array.from(text, c => c.charCodeAt(0)); }
