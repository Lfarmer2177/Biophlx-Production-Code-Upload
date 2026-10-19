// The caller serializes commands per device. A GATT write is not a firmware success response.
export async function sendAcknowledgedCommand({device, service, command, returnCode, payload, decode, timeoutMs = 8000}) {
  let subscription;
  let timer;
  let issued = false;
  let settled = false;
  try {
    return await new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (error) reject(error); else resolve(value);
      };
      subscription = device.monitorCharacteristicForService(service, returnCode, (error, characteristic) => {
        if (error) return finish(error);
        if (!issued || !characteristic?.value) return;
        const bytes = decode(characteristic.value);
        if (bytes.length !== 1) return finish(new Error('Invalid band command response.'));
        const code = bytes[0];
        if (code === 255 || code === 0) return;
        if (code === 1) finish(null, code);
        else finish(new Error(`Band rejected the command (code ${code}).`));
      });
      timer = setTimeout(() => finish(new Error('Band command outcome is unknown. Reconnect before retrying.')), timeoutMs);
      issued = true;
      // Never retry an ambiguous accepted write using another write mode.
      device.writeCharacteristicWithResponseForService(service, command, payload).catch(error => finish(error));
    });
  } finally {
    clearTimeout(timer);
    subscription?.remove?.();
  }
}
