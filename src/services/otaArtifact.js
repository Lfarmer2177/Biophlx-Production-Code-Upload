import { Inflate } from 'pako';
import { Md5 } from '@smithy/md5-js';

export const OTA_SLOT_SIZE = 1376256;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
async function md5(bytes) { const hash = new Md5(); hash.update(bytes); return hex(await hash.digest()); }

export function validateTarget(targetVersion, hardware, currentVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error('Enter the release version supplied with the firmware, for example 1.3.12.');
  const parts = targetVersion.split('.').map(Number);
  if (parts[0] > 255 || parts[1] > 255 || parts[2] > 65535) throw new Error('Release version is outside the protocol range.');
  if (!/^\d+\.\d+$/.test(hardware || '')) throw new Error('Hardware identity is unavailable. Reconnect the band.');
  if (parts.slice(0, 2).join('.') !== hardware) throw new Error('This release version does not match the band hardware.');
  if (targetVersion === currentVersion) throw new Error('A unique target version is required to verify installation.');
  const numeric = a => a.split('.').map(Number).reduce((n,v,i) => n + v * [16777216,65536,1][i],0);
  if (currentVersion && numeric(targetVersion) <= numeric(currentVersion)) throw new Error('Customer updates must move to a newer release. Use the service recovery process for downgrades.');
}

// Pilot file validation. Hashes detect corruption; they do not authenticate an image publisher.
export async function validateFirmwareArtifact(bytes, {targetVersion, hardware, currentVersion, expectedImageMd5}) {
  validateTarget(targetVersion, hardware, currentVersion);
  if (!/^[a-fA-F0-9]{32}$/.test(expectedImageMd5 || '')) throw new Error('Enter the image MD5 provided by the release engineer.');
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > OTA_SLOT_SIZE) throw new Error('Compressed image exceeds the update slot or is empty.');
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) throw new Error('Choose a firmware.bin.gz file.');
  const chunks = [];
  let size = 0;
  const inflater = new Inflate({chunkSize: 16384});
  inflater.onData = chunk => {
    size += chunk.length;
    if (size > OTA_SLOT_SIZE) throw new Error('Uncompressed image exceeds the update slot.');
    chunks.push(chunk);
  };
  inflater.push(bytes, true);
  if (inflater.err || !inflater.ended || !size) throw new Error('The gzip image is damaged or incomplete.');
  if (size % 4096 !== 0) throw new Error('Firmware must be padded to a 4096-byte boundary by the release build.');
  const image = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { image.set(chunk, offset); offset += chunk.length; }
  if (image[0] !== 0xe9 || image.length < 24) throw new Error('The file does not contain an ESP32 application image.');
  const imageMd5 = await md5(image);
  if (imageMd5 !== expectedImageMd5.toLowerCase()) throw new Error('Image MD5 does not match the release engineer\'s value.');
  return {bytes, imageSize: size, imageMd5, gzipMd5: await md5(bytes), targetVersion, hardware};
}
