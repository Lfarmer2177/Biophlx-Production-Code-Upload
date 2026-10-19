// One failed device must not prevent STOP being attempted on the other device.
export async function stopBands(targets, sendStop) {
  const connected = targets.filter(([device]) => device);
  const results = await Promise.allSettled(connected.map(([device, slot]) => sendStop(device, slot)));
  return results.flatMap((result, index) => result.status === 'rejected' ? [connected[index][1]] : []);
}
