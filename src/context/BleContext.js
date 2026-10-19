import { bandRating } from '../Components/rep-feedback/repFeedback';
import { applyFirmwareSetCount } from './firmwareSetProgress';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOperationGate } from '../services/ble/operationGate';
import { sendAcknowledgedCommand } from '../services/ble/commandResult';
import { createOtaUpdater } from '../services/ota/updater';
import { OTA_PILOT_ENABLED } from '../config/appVariant';
const decodeBytes = value => Uint8Array.from(base64.decode(value || ''), c => c.charCodeAt(0));
const OTA_START_UUID = 'eae2f5f4-b18f-4f4d-0003-100000000006';
const emptyOta = {phase:'idle', progress:0, cancellable:false};
import {
    BLE_CONSTANTS,
    BleUuids,
    DeviceCommands,
    ExerciseLimb,
    ExerciseSide,
    createCommand,
} from '../constants/bleConstants';

export const SERVICE_UUIDS = {
    deviceStatus: BleUuids.deviceStatusService,
    command: BleUuids.deviceCommandService,
};

export const CHARACTERISTICS = {
    rom: BleUuids.rangeOfMotion,
    tut: BleUuids.timeUnderTension,
    velocity: BleUuids.acceleration,
    currentPosition: BleUuids.currentPosition,
    command: BleUuids.command,
    reps: BleUuids.repsCompleted,
    sets: BleUuids.setComplete,
    exerciseStage: BleUuids.exerciseStage,
};

const initialFeedback = {
    ROM: null,
    TUT: 0,
    Velocity: 0,
    Score: null,
    'Current Position': 0,
    reps: 0,
    sets: 0,
    setc: 0,
    exerciseStage: 0,
};

const bleManager = new BleManager();
const BleContext = createContext(null);
const defaultDeviceSettings = {
    primary: {
        limb: ExerciseLimb.leg.value,
        side: ExerciseSide.right.value,
    },
    secondary: {
        limb: ExerciseLimb.arm.value,
        side: ExerciseSide.left.value,
    },
};

// Approximate travel radii used to convert angular velocity (deg/s) to linear speed (m/s).
const LIMB_RADIUS_METERS = {
    [ExerciseLimb.arm.value]: 0.55,
    [ExerciseLimb.leg.value]: 0.9,
    [ExerciseLimb.undefined.value]: 0.7,
};

const getVelocityRadiusMeters = (limb) => {
    if (LIMB_RADIUS_METERS[limb] !== undefined) return LIMB_RADIUS_METERS[limb];
    return LIMB_RADIUS_METERS[ExerciseLimb.undefined.value];
};

const convertDegreesPerSecondToMetersPerSecond = (degreesPerSecond, limb) => {
    const angularVelocityRadPerSec = (Number(degreesPerSecond) || 0) * (Math.PI / 180);
    const linearVelocityMetersPerSec = angularVelocityRadPerSec * getVelocityRadiusMeters(limb);
    return +(linearVelocityMetersPerSec.toFixed(2));
};

export function BleProvider({ children }) {
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [secondaryDevice, setSecondaryDevice] = useState(null);
    const [feedback, setFeedback] = useState(initialFeedback);
    const [secondaryFeedback, setSecondaryFeedback] = useState(initialFeedback);
    const [batteryLevels, setBatteryLevels] = useState({ primary: null, secondary: null });
    const [showDeviceModal, setShowDeviceModal] = useState(false);
    const [scannedDevices, setScannedDevices] = useState([]);
    const [connecting, setConnecting] = useState(false);
    const [bleState, setBleState] = useState(null);
    const [deviceSlotToConnect, setDeviceSlotToConnect] = useState('primary');
    const [deviceSettings, setDeviceSettings] = useState(defaultDeviceSettings);
    const permissionTimeoutRef = useRef(null);
    const scanTimeoutRef = useRef(null);
    const monitorSubscriptionsRef = useRef({ primary: [], secondary: [] });
    const disconnectSubscriptionsRef = useRef({});
    const gateRef = useRef(createOperationGate());
    const settingsRef = useRef(deviceSettings);
    settingsRef.current = deviceSettings;
    const updaterRef = useRef(null);
    const [firmwareInfo, setFirmwareInfo] = useState({primary:null, secondary:null});
    const [otaState, setOtaState] = useState(emptyOta);
    const connectedDeviceRef = useRef(null);
    const secondaryDeviceRef = useRef(null);

    useEffect(() => {
        connectedDeviceRef.current = connectedDevice;
    }, [connectedDevice]);

    useEffect(() => {
        secondaryDeviceRef.current = secondaryDevice;
    }, [secondaryDevice]);

    const requestBlePermissions = useCallback(async () => {
        if (Platform.OS === 'android') {
            try {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
            } catch (err) {
                console.warn('BLE permission request failed', err);
            }
        }
    }, []);

    const schedulePermissionRequest = useCallback(() => {
        if (permissionTimeoutRef.current) {
            clearTimeout(permissionTimeoutRef.current);
        }
        permissionTimeoutRef.current = setTimeout(() => {
            requestBlePermissions();
            permissionTimeoutRef.current = null;
        }, 30000);
    }, [requestBlePermissions]);

    const clearMonitorSubscriptions = useCallback((slot) => {
        monitorSubscriptionsRef.current[slot]?.forEach((subscription) => {
            try {
                subscription?.remove?.();
            } catch { }
        });
        monitorSubscriptionsRef.current[slot] = [];

        ['ROM', 'TUT', 'Velocity', 'Current Position', 'reps', 'sets', 'exerciseStage'].forEach((label) => {
            try {
                bleManager.cancelTransaction(`workoutstream-${slot}-${label}`);
            } catch { }
        });
    }, []);

    const stopScan = useCallback(() => {
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
        try {
            bleManager.stopDeviceScan();
        } catch { }
        setConnecting(false);
    }, []);

    const cancelScan = useCallback(() => {
        stopScan();
        setShowDeviceModal(false);
    }, [stopScan]);

    const updateFeedbackForSlot = useCallback((slot, label, value) => {
        const setter = slot === 'secondary' ? setSecondaryFeedback : setFeedback;
        setter((prev) => {
            if (label === 'sets') return applyFirmwareSetCount(prev, value);
            const next = { ...prev };
            if (label === 'Velocity') {
                const limb = settingsRef.current?.[slot]?.limb ?? ExerciseLimb.undefined.value;
                const degreesPerSecond = (Number(value) || 0) / 100;
                next.Velocity = convertDegreesPerSecondToMetersPerSecond(degreesPerSecond, limb);
            }
            if (label === 'TUT') next.TUT = +((value / 1000).toFixed(2));
            if (label === 'ROM') next.ROM = value;
            if (label === 'Current Position') next['Current Position'] = value;
            if (label === 'reps') next.reps = value;
            if (label === 'exerciseStage') {
                next.exerciseStage = value;
                const target = slot === 'primary' ? connectedDeviceRef.current : secondaryDeviceRef.current;
                if (target) gateRef.current.setWorkout(target.id, value !== 0);
            }
            if (label === 'ROM') next.Score = bandRating(value);
            return next;
        });
    }, []);

    const readCurrentPosition = useCallback(async (dev = null, slot = 'primary') => {
        const device = dev || connectedDevice;
        if (!device || gateRef.current.updating) return;
        try {
            const ch = await device.readCharacteristicForService(
                SERVICE_UUIDS.deviceStatus,
                CHARACTERISTICS.currentPosition
            );
            const raw = base64.decode(ch.value || '');
            const buf = Uint8Array.from(raw.split('').map((c) => c.charCodeAt(0)));
            if (buf.length !== 2) return;
            const v = new DataView(buf.buffer, buf.byteOffset, 2).getInt16(0, true);
            updateFeedbackForSlot(slot, 'Current Position', v);
        } catch (e) {
            console.warn('Read current position failed:', e?.message || e);
        }
    }, [connectedDevice, updateFeedbackForSlot]);

    const readBatteryLevel = useCallback(async (slot = 'primary', dev = null) => {
        const device =
            dev ||
            (slot === 'primary' ? connectedDeviceRef.current : secondaryDeviceRef.current);
        if (!device || gateRef.current.updating) return null;

        try {
            const ch = await device.readCharacteristicForService(
                BleUuids.batteryService,
                BleUuids.batteryLevel
            );
            const raw = base64.decode(ch.value || '');
            const level = raw.charCodeAt(0);
            if (!Number.isFinite(level)) return null;
            setBatteryLevels((prev) => ({ ...prev, [slot]: level }));
            return level;
        } catch (e) {
            console.warn('Read battery level failed:', e?.message || e);
            return null;
        }
    }, []);

    const monitor = useCallback(
        (device, slot = 'primary') => {
            clearMonitorSubscriptions(slot);

            const watch = (svc, chr, label, fmt) => {
                const transactionId = `workoutstream-${slot}-${label}`;
                const subscription = device.monitorCharacteristicForService(
                    svc,
                    chr,
                    (err, characteristic) => {
                        if (err) {
                            const message = (err?.message || '').toLowerCase();
                            if (message.includes('operation was cancelled')) {
                                return;
                            }
                            return console.warn(err);
                        }
                        const raw = base64.decode(characteristic.value || '');
                        const buf = Uint8Array.from(raw.split('').map((c) => c.charCodeAt(0)));
                        let value = 0;
                        const width = fmt === 'UINT32' ? 4 : (fmt === 'UINT8' ? 1 : 2);
                        if (buf.length !== width) return;
                        if (fmt === 'INT16') value = new DataView(buf.buffer, buf.byteOffset, 2).getInt16(0, true);
                        if (fmt === 'UINT8') value = buf[0];
                        if (fmt === 'UINT16') value = (buf[0] ?? 0) + ((buf[1] ?? 0) << 8);
                        if (fmt === 'UINT32') {
                            value =
                                (buf[0] ?? 0) +
                                ((buf[1] ?? 0) << 8) +
                                ((buf[2] ?? 0) << 16) +
                                ((buf[3] ?? 0) * 16777216);
                        }
                        updateFeedbackForSlot(slot, label, value);
                    },
                    transactionId
                );
                monitorSubscriptionsRef.current[slot].push(subscription);
            };

            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.rom, 'ROM', 'INT16');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.tut, 'TUT', 'UINT32');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.velocity, 'Velocity', 'UINT16');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.currentPosition, 'Current Position', 'INT16');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.reps, 'reps', 'UINT16');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.sets, 'sets', 'UINT8');
            watch(SERVICE_UUIDS.deviceStatus, CHARACTERISTICS.exerciseStage, 'exerciseStage', 'UINT8');
        },
        [clearMonitorSubscriptions, updateFeedbackForSlot]
    );

    const disconnect = useCallback(
        async (slot = 'primary') => {
            if (gateRef.current.updating) { Alert.alert('Update in progress', 'Wait for the band update to finish.'); return; }
            const target = slot === 'primary' ? connectedDevice : secondaryDevice;
            if (!target) return;
            gateRef.current.setWorkout(target.id, false);
            try {
                clearMonitorSubscriptions(slot);
                disconnectSubscriptionsRef.current[slot]?.remove?.();
                disconnectSubscriptionsRef.current[slot] = null;
                await bleManager.cancelDeviceConnection(target.id);
            } catch (e) {
                console.warn('Disconnect error', e?.message || e);
            } finally {
                if (slot === 'primary') {
                    setConnectedDevice(null);
                    setBatteryLevels((prev) => ({ ...prev, primary: null }));
                    setFeedback(initialFeedback);
                } else {
                    setSecondaryDevice(null);
                    setBatteryLevels((prev) => ({ ...prev, secondary: null }));
                    setSecondaryFeedback(initialFeedback);
                }
            }
        },
        [clearMonitorSubscriptions, connectedDevice, secondaryDevice]
    );

    const connectDevice = useCallback(
        async (device, slot = 'primary') => {
            if (gateRef.current.updating) return;
            if (!device?.id) return;
            const primary = connectedDeviceRef.current;
            const secondary = secondaryDeviceRef.current;
            const alreadyConnected =
                (primary?.id === device.id && slot !== 'primary') ||
                (secondary?.id === device.id && slot !== 'secondary');

            if (alreadyConnected) {
                Alert.alert('Already connected', 'That sensor is already connected in another slot.');
                return;
            }

            try {
                stopScan();
                setConnecting(true);
                await new Promise((resolve) => setTimeout(resolve, 300));
                const connected = await device.connect({ timeout: 15000 });
                const ready = await connected.discoverAllServicesAndCharacteristics();
                disconnectSubscriptionsRef.current[slot]?.remove?.();
                disconnectSubscriptionsRef.current[slot] = bleManager.onDeviceDisconnected(ready.id, () => {
                    if (gateRef.current.updatingDeviceId === ready.id) return; // Only the updater-owned band may reboot silently.
                    gateRef.current.setWorkout(ready.id, false);
                    if (slot === 'primary') connectedDeviceRef.current = null;
                    else secondaryDeviceRef.current = null;
                    console.log('Device disconnected');
                    clearMonitorSubscriptions(slot);
                    if (slot === 'primary') {
                        setConnectedDevice(null);
                        setBatteryLevels((prev) => ({ ...prev, primary: null }));
                        setFeedback(initialFeedback);
                    } else {
                        setSecondaryDevice(null);
                        setBatteryLevels((prev) => ({ ...prev, secondary: null }));
                        setSecondaryFeedback(initialFeedback);
                    }
                });
                if (slot === 'primary') connectedDeviceRef.current = ready;
                else secondaryDeviceRef.current = ready;
                await refreshFirmwareInfo(slot, ready);
                if (slot === 'primary') {
                    setConnectedDevice(ready);
                    monitor(ready, 'primary');
                    await readCurrentPosition(ready, 'primary');
                    await readBatteryLevel('primary', ready);
                } else {
                    setSecondaryDevice(ready);
                    monitor(ready, 'secondary');
                    await readCurrentPosition(ready, 'secondary');
                    await readBatteryLevel('secondary', ready);
                }
                const roleLabel = slot === 'primary' ? '' : ' (secondary)';
                Alert.alert('Connected', `Connected to ${device.name || 'device'}${roleLabel}`);
            } catch (e) {
                Alert.alert('Connect error', e?.message || 'Unable to connect to device.');
            } finally {
                stopScan();
                setShowDeviceModal(false);
            }
        },
        [clearMonitorSubscriptions, monitor, readBatteryLevel, readCurrentPosition, stopScan]
    );

    const handleDeviceSelect = useCallback(
        (device) => {
            if (!device) return;
            connectDevice(device, deviceSlotToConnect);
        },
        [connectDevice, deviceSlotToConnect]
    );

    const writeWorkoutCommand = useCallback(async (device, bytes) => {
        if (!device) throw new Error('Connect the band first.');
        const release = gateRef.current.command(device.id);
        const starts = bytes[0] === DeviceCommands.start;
        if (starts) gateRef.current.setWorkout(device.id, true);
        try {
            await sendAcknowledgedCommand({device, service:BleUuids.deviceCommandService,
                command:BleUuids.command, returnCode:BleUuids.returnCode,
                payload:base64.encode(String.fromCharCode(...bytes)), decode:decodeBytes});
            if (bytes[0] === DeviceCommands.stop) gateRef.current.setWorkout(device.id, false);
        } finally { release(); }
    }, []);

    const flashDevice = useCallback(async (slot = 'primary') => {
        const device = slot === 'primary' ? connectedDeviceRef.current : secondaryDeviceRef.current;
        try {
            if (gateRef.current.workoutActive) throw new Error('Identify is available after the exercise ends.');
            await writeWorkoutCommand(device, Array.from(createCommand(DeviceCommands.id)));
        } catch (error) { Alert.alert('Band identification', error.message); }
    }, [writeWorkoutCommand]);

    const updateDeviceSetting = useCallback((slot, key, value) => {
        if (gateRef.current.updating) return;
        settingsRef.current = {...settingsRef.current, [slot]:{...settingsRef.current[slot], [key]:value}};
        setDeviceSettings((prev) => ({
            ...prev,
            [slot]: {
                ...(prev[slot] || {}),
                [key]: value,
            },
        }));
    }, []);

    const scanAndConnect = useCallback(
        async (slot = 'primary') => {
            if (gateRef.current.updating) { Alert.alert('Update in progress', 'Wait for the band update to finish.'); return; }
            setDeviceSlotToConnect(slot);
            await requestBlePermissions();
            if (bleState && bleState !== 'PoweredOn') {
                Alert.alert('Bluetooth Off', 'Please enable Bluetooth to connect to a device.');
                return;
            }
            stopScan();
            setScannedDevices([]);
            setShowDeviceModal(true);
            setConnecting(true);

            bleManager.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    stopScan();
                    setShowDeviceModal(false);
                    Alert.alert('Scan Error', error.message || 'Unable to scan for BLE devices.');
                    return;
                }

                if (!device?.id) {
                    return;
                }

                const connectedIds = [
                    connectedDeviceRef.current?.id,
                    secondaryDeviceRef.current?.id,
                ].filter(Boolean);
                if (connectedIds.includes(device.id)) return;

                const name = (device.name || '').toLowerCase();
                if (!name.startsWith(BLE_CONSTANTS.DEVICE_NAME_PREFIX)) return;

                setScannedDevices((prev) => {
                    if (prev.some((d) => d.id === device.id)) {
                        return prev;
                    }
                    return [...prev, device];
                });
            });

            scanTimeoutRef.current = setTimeout(() => {
                stopScan();
            }, BLE_CONSTANTS.SCAN_TIMEOUT);
        },
        [bleState, requestBlePermissions, stopScan]
    );

    useEffect(() => {
        schedulePermissionRequest();
        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state !== 'active' && updaterRef.current) updaterRef.current.cancel();
            if (state === 'active') {
                schedulePermissionRequest();
            }
        });
        const subscription = bleManager.onStateChange((state) => {
            setBleState(state);
        }, true);
        bleManager.state().then(setBleState).catch(() => { });
        return () => {
            if (permissionTimeoutRef.current) {
                clearTimeout(permissionTimeoutRef.current);
                permissionTimeoutRef.current = null;
            }
            stopScan();
            clearMonitorSubscriptions('primary');
            clearMonitorSubscriptions('secondary');
            disconnectSubscriptionsRef.current.primary?.remove?.();
            disconnectSubscriptionsRef.current.secondary?.remove?.();
            subscription?.remove?.();
            appStateSub?.remove?.();
            bleManager.destroy();
        };
    }, [clearMonitorSubscriptions, schedulePermissionRequest, stopScan]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (connectedDeviceRef.current) {
                readBatteryLevel('primary');
            }
            if (secondaryDeviceRef.current) {
                readBatteryLevel('secondary');
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [readBatteryLevel]);

    const refreshFirmwareInfo = async (slot, explicitDevice) => {
        const device = explicitDevice || (slot === 'primary' ? connectedDeviceRef.current : secondaryDeviceRef.current);
        if (!device) return null;
        const info = {version:null, serial:null, hardware:null, supportsOta:false};
        try {
            const chars = await device.characteristicsForService(BleUuids.otaService);
            info.supportsOta = chars.some(c => c.uuid.toLowerCase() === OTA_START_UUID && c.isWritableWithResponse);
            const ch = await device.readCharacteristicForService(BleUuids.otaService, BleUuids.otaVersion);
            const v = decodeBytes(ch.value);
            if (v.length === 4) info.version = `${v[3]}.${v[2]}.${v[0] + v[1]*256}`;
            for (const [key,uuid] of [['serial','2A25'],['hardware','2A27']]) {
                try { const result = await device.readCharacteristicForService('180A',uuid); info[key] = base64.decode(result.value || '').replace(/\0/g,'').trim(); } catch {}
            }
        } catch (error) { info.error = error.message; }
        setFirmwareInfo(prev => ({...prev,[slot]:info}));
        return info;
    };

    const startFirmwareUpdate = async (slot, artifact) => {
        if (!OTA_PILOT_ENABLED) throw new Error('OTA is restricted to internal pilot builds until release checks pass.');
        if (AppState.currentState !== 'active') throw new Error('Keep the app in the foreground to start an update.');
        const original = slot === 'primary' ? connectedDeviceRef.current : secondaryDeviceRef.current;
        if (!original) throw new Error('Reconnect the selected band.');
        const release = gateRef.current.beginMaintenance(original.id);
        const attemptId = `${Date.now()}-${original.id}`;
        let activeDevice = original;
        let progress = {...emptyOta,phase:'checking',slot};
        setOtaState(progress);
        try {
            stopScan();
            for (const device of [connectedDeviceRef.current,secondaryDeviceRef.current].filter(Boolean)) {
                const state = decodeBytes((await device.readCharacteristicForService(BleUuids.deviceStatusService,BleUuids.exerciseStage)).value);
                if (state.length !== 1 || state[0] !== 0) throw new Error('End the exercise on both bands before updating.');
            }
            const info = await refreshFirmwareInfo(slot, original);
            if (!info?.supportsOta) throw new Error('This band requires a USB/service update before OTA is available.');
            if (!info.serial || !info.hardware || info.hardware !== artifact.hardware) throw new Error('The artifact does not match verified band identity.');
            const battery = decodeBytes((await original.readCharacteristicForService(BleUuids.batteryService,BleUuids.batteryLevel)).value);
            // Conservative pilot rule: USB state is not yet exposed reliably by the app.
            if (battery.length !== 1 || battery[0] < 10) throw new Error('Charge the band to at least 10% before this pilot update.');
            if (AppState.currentState !== 'active') throw new Error('The app left the foreground. Return to this screen before retrying.');
            clearMonitorSubscriptions(slot);
            const updater = createOtaUpdater({device:original,platform:Platform.OS,
                onProgress: next => { progress = {...next,slot}; setOtaState(progress); },
                reconnect: async ({deviceId,timeoutMs}) => {
                    // A timed-out GATT operation can leave the native link connected.
                    // Close that stale link before resuming the same device/session.
                    if (await bleManager.isDeviceConnected(deviceId)) await bleManager.cancelDeviceConnection(deviceId);
                    const device = await bleManager.connectToDevice(deviceId,{timeout:timeoutMs});
                    activeDevice = await device.discoverAllServicesAndCharacteristics();
                    const serial = base64.decode((await activeDevice.readCharacteristicForService('180A','2A25')).value || '').replace(/\0/g,'').trim();
                    if (serial !== info.serial) throw new Error('Reconnected band identity does not match.');
                    return activeDevice;
                }});
            updaterRef.current = updater;
            const result = await updater.run(artifact);
            activeDevice = result.device || activeDevice;
            await refreshFirmwareInfo(slot, activeDevice);
            await AsyncStorage.setItem('biophlx:last-ota-attempt',JSON.stringify({attemptId,slot,serial:info.serial,target:artifact.targetVersion,verifiedVersion:result.version,stage:'verified',at:new Date().toISOString()})).catch(()=>{});
            return result;
        } catch (error) {
            setOtaState({...progress,phase:error.code === 'CANCELLED' ? 'cancelled' : 'failed',message:error.message,cancellable:false,slot});
            await AsyncStorage.setItem('biophlx:last-ota-attempt',JSON.stringify({attemptId,slot,target:artifact.targetVersion,stage:'failed-or-unverified',error:error.message,at:new Date().toISOString()})).catch(()=>{});
            // Firmware keeps FINALIZING active for two seconds after RESET/error.
            // Keep workout controls locked while that cleanup finishes.
            if (updaterRef.current) await new Promise(resolve => setTimeout(resolve, 2200));
            throw error;
        } finally {
            activeDevice = updaterRef.current?.getDevice() || activeDevice;
            updaterRef.current = null;
            let live = false;
            try { live = await activeDevice.isConnected(); } catch {}
            const restored = live ? activeDevice : null;
            if (slot === 'primary') { connectedDeviceRef.current = restored; setConnectedDevice(restored); }
            else { secondaryDeviceRef.current = restored; setSecondaryDevice(restored); }
            disconnectSubscriptionsRef.current[slot]?.remove?.();
            disconnectSubscriptionsRef.current[slot] = restored ? bleManager.onDeviceDisconnected(restored.id, () => {
                if (gateRef.current.updatingDeviceId === restored.id) return;
                gateRef.current.setWorkout(restored.id, false);
                clearMonitorSubscriptions(slot);
                if (slot === 'primary') { connectedDeviceRef.current=null; setConnectedDevice(null); setFeedback(initialFeedback); }
                else { secondaryDeviceRef.current=null; setSecondaryDevice(null); setSecondaryFeedback(initialFeedback); }
                setBatteryLevels(prev => ({...prev,[slot]:null}));
            }) : null;
            release();
            if (restored) { monitor(restored,slot); await readBatteryLevel(slot,restored); }
        }
    };
    const cancelFirmwareUpdate = () => updaterRef.current?.cancel();

    const value = {
        firmwareInfo, otaState, refreshFirmwareInfo, startFirmwareUpdate, cancelFirmwareUpdate, writeWorkoutCommand,
        bleState,
        connectedDevice,
        secondaryDevice,
        feedback,
        secondaryFeedback,
        batteryLevels,
        showDeviceModal,
        scannedDevices,
        connecting,
        deviceSlotToConnect,
        deviceSettings,
        scanAndConnect,
        connectDevice,
        disconnect,
        flashDevice,
        updateDeviceSetting,
        cancelScan,
        handleDeviceSelect,
        readCurrentPosition,
        readBatteryLevel,
    };

    return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBle() {
    const context = useContext(BleContext);
    if (!context) {
        throw new Error('useBle must be used within a BleProvider');
    }
    return context;
}
