// One BLE owner at a time, shared by maintenance, workout commands and navigation actions.
export function createOperationGate() {
  let maintenance = null;
  const commands = new Set();
  const activeWorkouts = new Set();
  return {
    assertAvailable() { if (maintenance) throw new Error('A band update is in progress. Wait for it to finish.'); },
    command(deviceId) {
      this.assertAvailable();
      if (commands.has(deviceId)) throw new Error('Wait for the previous band command to finish.');
      commands.add(deviceId);
      return () => commands.delete(deviceId);
    },
    setWorkout(deviceId, active) { if (active) activeWorkouts.add(deviceId); else activeWorkouts.delete(deviceId); },
    beginMaintenance(deviceId) {
      this.assertAvailable();
      if (commands.size || activeWorkouts.size) throw new Error('End the exercise on both bands before updating.');
      const token = { deviceId };
      maintenance = token;
      return () => { if (maintenance === token) maintenance = null; };
    },
    get updating() { return !!maintenance; },
    get updatingDeviceId() { return maintenance?.deviceId || null; },
    get workoutActive() { return activeWorkouts.size > 0; },
  };
}
