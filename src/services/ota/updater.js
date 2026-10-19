import {
  OTA_UUIDS, OTA_WINDOW, OtaError, asciiBytes, base64ToBytes, bytesToBase64,
  decodeControl, encodePacket, encodeStart, formatVersion, uint32,
  validateArtifact, validateTransfer, versionNumber,
} from './protocol';

const DEFAULT_TIMEOUTS = Object.freeze({
  operation: 8000, start: 5000, resend: 3000, stall: 15000,
  resume: 18000, verify: 60000, reboot: 30000, recovery: 2200,
  poll: 100, readInterval: 1000, total: 600000, maxRecoveries: 3,
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * An exclusive, foreground-only updater for ONE band. The caller must own the
 * existing BLE connection, prevent workouts/other commands and reconnect loops,
 * and pass an artifact verified for this hardware before calling run().
 *
 * reconnect({ deviceId, timeoutMs }) must reconnect/discover the SAME band and
 * return its BLE-plx Device. It must not attach competing workout monitors.
 * This module owns only its own subscriptions; it never changes app ownership.
 * run() rejects with OtaError (including CANCELLED), and always removes listeners.
 * A successful result requires the target version observed after reboot.
 */
export function createOtaUpdater({ device: initialDevice, reconnect, onProgress = () => {}, platform = 'ios', timeouts = {} }) {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  let device = initialDevice;
  const deviceId = initialDevice?.id;
  let started = false, finished = false, cancelled = false;
  let state = { phase: 'idle', progress: 0, bytesSent: 0, totalBytes: 0, cancellable: false, message: '' };
  let subscriptions = [], listenerEpoch = 0;
  let linkLost = false, fatal = null, control = null;
  let artifact, transfer, previousVersion, targetVersion;
  let highestAck = 0, nextSequence = 0, furthestSequence = 0;
  let ready = false, md5Written = false, md5Attempted = false, verifying = false, success = false;
  let repeatHint = null, lastHintUsed = null;
  let lastProgressAt = 0, startDeadline = 0, lastReadAt = 0, verifyDeadline = 0, overallDeadline = 0;
  let recoveries = 0, finalResult = null;

  function publish(phase, message, extra = {}) {
    const bytesSent = transfer ? Math.min(artifact.bytes.length, furthestSequence * transfer.payload) : 0;
    state = { ...state, phase, message, bytesSent, totalBytes: artifact?.bytes.length || 0,
      progress: artifact ? bytesSent / artifact.bytes.length : 0,
      cancellable: !finished && !md5Attempted && ['preparing', 'sending', 'reconnecting'].includes(phase), ...extra };
    try { onProgress({ ...state }); } catch { /* presentation callbacks cannot interrupt a flash */ }
  }
  function removeListeners() {
    listenerEpoch++;
    for (const subscription of subscriptions) { try { subscription?.remove(); } catch { /* already disconnected */ } }
    subscriptions = [];
  }
  function receive(bytes, allowGapHint = true) {
    try {
      control = decodeControl(bytes);
      if (control.kind === 'error') {
        fatal = new OtaError('DEVICE_REJECTED', 'The band rejected or could not complete the update. Reconnect before retrying.');
      } else if (control.kind === 'ack') {
        if (control.sequence > transfer.packetCount) throw new OtaError('INVALID_RESPONSE', 'The band acknowledged data outside this firmware image.');
        const wasReady = ready;
        ready = true;
        if (!wasReady || control.sequence > highestAck) {
          highestAck = Math.max(highestAck, control.sequence);
          lastProgressAt = Date.now();
          lastHintUsed = null;
        } else if (allowGapHint && control.sequence === highestAck && nextSequence > highestAck) {
          repeatHint = highestAck;
        }
      } else if (control.kind === 'busy' && md5Attempted) {
        if (!verifying) verifyDeadline = Date.now() + limits.verify;
        verifying = true;
        publish('verifying', 'The band is checking the firmware. Keep it powered on.', { cancellable: false });
      } else if (control.kind === 'success') {
        success = true;
        if (!verifyDeadline) verifyDeadline = Date.now() + limits.reboot;
        publish('restarting', 'Firmware verified. Waiting for the band to restart.', { cancellable: false });
      }
    } catch (error) { fatal = error; }
  }
  function listen() {
    removeListeners();
    const epoch = listenerEpoch;
    subscriptions.push(device.monitorCharacteristicForService(OTA_UUIDS.service, OTA_UUIDS.control, (error, characteristic) => {
      if (epoch !== listenerEpoch || finished) return;
      if (error) { linkLost = true; return; }
      if (characteristic?.value != null) receive(base64ToBytesSafe(characteristic.value));
    }));
    if (device.onDisconnected) subscriptions.push(device.onDisconnected(() => {
      if (epoch === listenerEpoch && !finished) linkLost = true;
    }));
  }
  function base64ToBytesSafe(value) {
    try { return base64ToBytes(value); } catch (error) { fatal = error; return new Uint8Array(); }
  }
  async function bounded(promise, duration, code = 'LINK_TIMEOUT') {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new OtaError(code, 'The Bluetooth operation timed out.')), duration);
      })]);
    } finally { clearTimeout(timer); }
  }
  async function io(operation) {
    try { return await bounded(Promise.resolve().then(operation), limits.operation); }
    catch (error) { linkLost = true; throw error; }
  }
  async function read(characteristic) {
    const response = await io(() => device.readCharacteristicForService(OTA_UUIDS.service, characteristic));
    return base64ToBytes(response?.value);
  }
  async function write(characteristic, bytes, withResponse = true) {
    const method = withResponse ? 'writeCharacteristicWithResponseForService' : 'writeCharacteristicWithoutResponseForService';
    return io(() => device[method](OTA_UUIDS.service, characteristic, bytesToBase64(bytes)));
  }
  async function configure(isReconnect) {
    if (!device || device.id !== deviceId) throw new OtaError('WRONG_DEVICE', 'The updater must reconnect to the same band.');
    device = await io(() => device.discoverAllServicesAndCharacteristics());
    const characteristics = await io(() => device.characteristicsForService(OTA_UUIDS.service));
    const available = new Set(characteristics.map(item => item.uuid.toLowerCase()));
    if (![OTA_UUIDS.version, OTA_UUIDS.control, OTA_UUIDS.packet, OTA_UUIDS.start].every(uuid => available.has(uuid))) {
      throw new OtaError('OTA_UNSUPPORTED', 'This band needs a service update over USB before Bluetooth firmware updates are available.');
    }
    if (platform === 'android') {
      device = await io(() => device.requestMTU(247));
      // High connection priority is an optimization, not permission to exceed the window.
      if (device.requestConnectionPriority) {
        try { await bounded(device.requestConnectionPriority(1), limits.operation); } catch { /* normal priority works */ }
      }
    }
    if (!isReconnect) transfer = validateTransfer(artifact.bytes.length, device.mtu);
    return uint32(await read(OTA_UUIDS.version));
  }
  function checkDeadline() {
    if (Date.now() >= overallDeadline) throw new OtaError('UPDATE_TIMEOUT', 'This update took too long. Reconnect and check the firmware version before retrying.');
  }
  function resetTransfer() {
    highestAck = 0; nextSequence = 0; furthestSequence = 0; ready = false;
    md5Written = false; md5Attempted = false; verifying = false; success = false;
    fatal = null; control = null; repeatHint = null; lastHintUsed = null;
    verifyDeadline = 0; lastProgressAt = Date.now();
  }
  async function startTransfer() {
    startDeadline = Date.now() + limits.start;
    publish('preparing', 'Preparing the band for its firmware update.');
    await write(OTA_UUIDS.start, encodeStart(artifact));
  }
  async function pollControl() {
    lastReadAt = Date.now();
    receive(await read(OTA_UUIDS.control), false);
  }
  function confirmed(version) {
    if (version !== targetVersion) return false;
    finalResult = { device, previousVersion: formatVersion(previousVersion), version: formatVersion(version),
      bytesSent: artifact.bytes.length, recovered: recoveries > 0 };
    return true;
  }
  async function recover() {
    // The expected reboot is confirmation, not a failed transfer/retry.
    const expectedReboot = md5Attempted && (success || verifying);
    if (!expectedReboot) recoveries++;
    if (typeof reconnect !== 'function' || recoveries > limits.maxRecoveries) {
      throw new OtaError('RECONNECT_FAILED', 'The band disconnected. Reconnect and check its firmware version before retrying.');
    }
    const afterImage = md5Attempted;
    const deadline = Date.now() + (afterImage ? limits.reboot : limits.resume);
    publish('reconnecting', afterImage ? 'Reconnecting to confirm the firmware version.' : 'Reconnecting to resume the update.');
    removeListeners();
    let lastError;
    while (Date.now() < deadline) {
      checkDeadline();
      if (cancelled && !md5Attempted) return;
      try {
        device = await bounded(Promise.resolve().then(() => reconnect({ deviceId, timeoutMs: Math.max(1, deadline - Date.now()) })), Math.max(1, deadline - Date.now()), 'RECONNECT_FAILED');
        linkLost = false;
        const version = await configure(true);
        if (afterImage && confirmed(version)) return;
        if (version !== previousVersion) throw new OtaError('UNEXPECTED_VERSION', 'The band is running a different firmware version. Review it before attempting another update.');
        // Read status before START: the device may already be verifying or rebooting.
        const current = decodeControl(await read(OTA_UUIDS.control));
        fatal = null;
        listen();
        if (current.kind === 'busy' || current.kind === 'success') {
          if (current.kind === 'success' && !afterImage) throw new OtaError('UNEXPECTED_STATE', 'The band completed an update outside this attempt. Reconnect and check its version.');
          receiveControlObject(current);
          if (!afterImage) {
            validateTransfer(artifact.bytes.length, device.mtu, transfer.payload);
            startDeadline = Date.now() + limits.start;
          }
          return;
        }
        if (current.kind === 'ack') {
          validateTransfer(artifact.bytes.length, device.mtu, transfer.payload);
          if (current.sequence > transfer.packetCount) throw new OtaError('INVALID_RESPONSE', 'The band update state does not match the selected image.');
          ready = true;
          highestAck = Math.max(highestAck, current.sequence);
          nextSequence = highestAck;
          lastProgressAt = Date.now();
          repeatHint = null; lastHintUsed = null;
          if (afterImage) {
            // An ACK can persist while FINALIZING waits for a lost MD5 write.
            // Re-send the same MD5, not START (which would be rejected there).
            await write(OTA_UUIDS.version, asciiBytes(artifact.imageMd5));
            md5Written = true;
          } else {
            await startTransfer(); // same size/hash and original packet boundaries
          }
          publish(afterImage ? 'verifying' : 'sending', afterImage ? 'Finishing the firmware transfer.' : 'Connection restored. Resuming the update.');
          return;
        }
        // IDLE after reboot or ERROR after timeout: the old firmware is still running.
        // The previous in-memory session cannot be resumed; start from byte zero.
        if (current.kind === 'error') await sleep(limits.recovery);
        transfer = validateTransfer(artifact.bytes.length, device.mtu);
        resetTransfer();
        publish('preparing', 'The previous transfer ended. Restarting from the beginning.');
        await startTransfer();
        return;
      } catch (error) {
        if (error instanceof OtaError && !['LINK_TIMEOUT', 'RECONNECT_FAILED'].includes(error.code)) throw error;
        lastError = error;
        removeListeners();
        await sleep(limits.poll);
      }
    }
    throw new OtaError('RECONNECT_FAILED', `Could not reconnect to the band. ${lastError?.message || 'The update must be restarted.'}`);
  }
  function receiveControlObject(value) {
    // Use the same transition function for reads and notifications.
    const encoded = new Uint8Array(4);
    const number = value.kind === 'busy' ? 0xffffffff : 0xfffffff0;
    new DataView(encoded.buffer).setUint32(0, number, true);
    receive(encoded);
  }
  async function stopBeforeVerification() {
    if (!linkLost && ready) {
      try { await write(OTA_UUIDS.version, asciiBytes('RESET')); } catch { /* no MD5 was sent; the device cannot activate this image */ }
    }
    throw new OtaError('CANCELLED', 'The transfer was stopped before verification. The band may need a moment to leave update mode.');
  }
  async function run(input) {
    if (started) throw new OtaError('ALREADY_STARTED', 'Create a new updater for each firmware attempt.');
    started = true;
    overallDeadline = Date.now() + limits.total;
    try {
      artifact = validateArtifact(input);
      targetVersion = versionNumber(artifact.targetVersion);
      publish('preparing', 'Checking the band and Bluetooth connection.');
      previousVersion = await configure(false);
      if (previousVersion < versionNumber('1.3.11')) throw new OtaError('OTA_UNSUPPORTED', 'This band requires its first Bluetooth-update firmware through a USB service update.');
      if (targetVersion <= previousVersion) throw new OtaError('NOT_NEWER', 'Choose a newer approved firmware version. Same-version updates cannot be verified reliably.');
      resetTransfer();
      listen();
      if (cancelled) await stopBeforeVerification();
      try { await startTransfer(); } catch (error) { if (!linkLost) throw error; }
      while (!finalResult) {
        checkDeadline();
        if (cancelled && !md5Attempted) await stopBeforeVerification();
        if (linkLost) { await recover(); continue; }
        if (fatal) throw fatal;
        if (success || verifying) {
          if (Date.now() > verifyDeadline) throw new OtaError('CONFIRMATION_TIMEOUT', 'The band has not confirmed the new firmware. Reconnect and check its version before retrying.');
          if (Date.now() - lastReadAt >= limits.readInterval) {
            try {
              if (success) {
                const version = uint32(await read(OTA_UUIDS.version));
                if (confirmed(version)) break;
              }
              await pollControl();
            } catch (error) { if (!linkLost) throw error; }
          }
          await sleep(limits.poll); continue;
        }
        if (!ready) {
          if (Date.now() > startDeadline) throw new OtaError('START_TIMEOUT', 'The band did not become ready for the update. Reconnect before retrying.');
        } else {
          const stalled = Date.now() - lastProgressAt;
          if (stalled > limits.stall) throw new OtaError('TRANSFER_STALLED', 'The firmware transfer stopped progressing. Reconnect and try again.');
          if (repeatHint !== null && repeatHint !== lastHintUsed) {
            lastHintUsed = repeatHint; nextSequence = highestAck; repeatHint = null;
          } else if (stalled > limits.resend && Date.now() - (state.lastRetryAt || 0) > limits.resend) {
            nextSequence = highestAck;
            state.lastRetryAt = Date.now();
          }
          if (nextSequence < transfer.packetCount && nextSequence < highestAck + OTA_WINDOW) {
            const sequence = nextSequence++;
            try {
              await write(OTA_UUIDS.packet, encodePacket(artifact.bytes, sequence, transfer.payload), false);
              furthestSequence = Math.max(furthestSequence, sequence + 1);
              publish(md5Attempted ? 'verifying' : 'sending', md5Attempted ? 'Finishing the firmware transfer.' : 'Sending firmware. Keep the app open and the band nearby.');
            } catch (error) { if (!linkLost) throw error; }
            continue;
          }
          if (nextSequence === transfer.packetCount && !md5Written) {
            // Never wait for a final ACK. Disable cancellation BEFORE the write:
            // the firmware can begin activation even if the response is lost.
            md5Attempted = true;
            publish('verifying', 'Transfer sent. Waiting for the band to verify it.', { cancellable: false });
            try { await write(OTA_UUIDS.version, asciiBytes(artifact.imageMd5)); md5Written = true; }
            catch (error) { if (!linkLost) throw error; }
            continue;
          }
        }
        if (Date.now() - lastReadAt >= limits.readInterval) {
          try { await pollControl(); } catch (error) { if (!linkLost) throw error; }
        }
        await sleep(limits.poll);
      }
      finished = true;
      publish('complete', `The band is now running firmware ${finalResult.version}.`, { progress: 1, cancellable: false });
      return finalResult;
    } catch (error) {
      // On failures before MD5, stop a live transfer rather than leaving it to timeout.
      if (!md5Attempted && ready && !linkLost && error.code !== 'CANCELLED') {
        try { await write(OTA_UUIDS.version, asciiBytes('RESET')); } catch { /* inactive image is not activated */ }
      }
      finished = true;
      const failure = error instanceof OtaError ? error : new OtaError('UPDATE_FAILED', error?.message || 'The update could not be completed.');
      publish(failure.code === 'CANCELLED' ? 'cancelled' : 'failed', failure.message, { cancellable: false, errorCode: failure.code });
      throw failure;
    } finally { removeListeners(); }
  }
  return {
    run,
    cancel() { if (!state.cancellable || finished) return false; cancelled = true; publish('cancelling', 'Stopping the update transfer.', { cancellable: false }); return true; },
    getState() { return { ...state }; },
    getDevice() { return device; },
  };
}
