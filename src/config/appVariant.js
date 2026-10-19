// Branch capability declaration. Future firmware must never be inferred from a version string.
export const APP_VARIANT = 'current-app-ota';
export const FIRMWARE_BASELINE = '1.3.11';
export const OTA_PILOT_ENABLED = process.env.EXPO_PUBLIC_ENABLE_OTA_PILOT === 'true';
