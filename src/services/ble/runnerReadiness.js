// 1.3.11: 0 = no exercise, 1 = waiting for idle, 2/3/4 = initialized.
// Readiness is firmware-owned. There is no second app countdown.
export const isReadyStage = stage => [2, 3, 4].includes(stage);
export const areBandsReady = (primary, secondary) => isReadyStage(primary) && isReadyStage(secondary);
