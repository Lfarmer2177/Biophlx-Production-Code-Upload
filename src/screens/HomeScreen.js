import ExerciseHistory from '../Components/history/HistoryCards';
import MovementSummary from '../Components/history/MovementSummary';
import useSessionMovement from '../Components/history/useSessionMovement';
import { localWorkoutDate, selectMovementSessions } from '../Components/history/movementMetrics';
import { loadSessionDetails } from '../Components/history/sessionHistoryData';
import BrandButton from '../Components/Button/BrandButton';
import { useBIOPHLXTheme } from '../Theme/BIOPHLXTheme';
import { TutorialCard } from '../Components/band-setup/BandSetup';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Modal,
  FlatList,
  Button
} from 'react-native';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
// import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Colors from '../Theme/Colors';
import DirectMessageBottomSheet from '../Components/BottomSheet/DirectMessageBottomSheet';
import {
  listSessionsByCustomerQuery,
  listSessionItemsBySession,
  listSessionItemRepsQuery,
  listSessionItemSetsQuery,
  listExercises,
  getExerciseQuery,
} from '../graphql/queries';

import { useBle } from '../context/BleContext';
import { ExerciseLimb, ExerciseSide } from '../constants/bleConstants';

const LIST_CUSTOMERS_BY_USER = /* GraphQL */ `
  query ListCustomers($user_id: ID!) {
    listCustomers(filter: { user_id: { eq: $user_id } }, limit: 1) {
      items { customer_id }
      nextToken
    }
  }
`;

const GET_USER = /* GraphQL */ `
  query GetUser($user_id: ID!) {
    getUser(user_id: $user_id) {
      gender
      role
    }
  }
`;

const LIST_TRAINERS_BY_USER = /* GraphQL */ `
  query ListTrainers($user_id: ID!) {
    listTrainers(filter: { user_id: { eq: $user_id } }, limit: 500) {
      items { trainer_id user_id }
      nextToken
    }
  }
`;

const CREATE_CUSTOMER = /* GraphQL */ `
  mutation CreateCustomer($input: CreateCustomerInput!) {
    createCustomer(input: $input) { customer_id }
  }
`;

const actions = [
  { label: 'Run a Workout', key: 'runner', accent: true },
  { label: 'Build a Workout', key: 'builder' },
  { label: 'My Workouts', key: 'library' },
  { label: 'View Sessions', key: 'sessions' },
  { label: 'Exercise Library', key: 'exercises' },
  { label: 'Trainers', key: 'trainerDirectory' },
  { label: 'Edit Profile', key: 'profile' },
  // Trainer Dashboard will be injected dynamically when a trainer_id exists
];

const MAX_SESSION_ITEM_INDEX = 20;

const formatDate = value => localWorkoutDate(value) || 'Unknown date';
const normalizeDate = localWorkoutDate;

const unwrapString = (value) => {
  if (value?.S) return value.S;
  if (typeof value === 'string') {
    if (value.startsWith('{') && value.endsWith('}')) {
      const idx = value.indexOf('=');
      if (idx !== -1) {
        return value.substring(idx + 1, value.length - 1).trim();
      }
    }
    return value;
  }
  return value ?? '';
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(unwrapString).filter(Boolean);
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') {
    if (Array.isArray(value.SS)) return value.SS.map(unwrapString).filter(Boolean);
    if (value.S) return [value.S];
    return Object.values(value)
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry?.S) return entry.S;
        if (Array.isArray(entry?.SS)) return entry.SS;
        return null;
      })
      .flat()
      .map(unwrapString)
      .filter(Boolean);
  }
  return [];
};

const normalizeKey = (val) => {
  if (val === null || val === undefined) return '';
  const unwrapped = unwrapString(val);
  if (typeof unwrapped === 'string') return unwrapped.trim().toLowerCase();
  return String(unwrapped).trim().toLowerCase();
};

export default function HomeScreen({ route, navigation }) {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  const { fromClientList, clientData } = route?.params || {};
  const client = useMemo(() => generateClient({ authMode: 'userPool' }), []);
  const [exerciseMap, setExerciseMap] = useState({});
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionDetailsMap, setSessionDetailsMap] = useState({});
  const [sessionLoadingMap, setSessionLoadingMap] = useState({});
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [range, setRange] = useState('month'); // 'week' | 'month' | 'year'
  const [trainerId, setTrainerId] = useState(null);
  const [userGender, setUserGender] = useState('male');
  const [userRole, setUserRole] = useState('');
  const [openDeviceSettings, setOpenDeviceSettings] = useState(null);
  const {
    connectedDevice,
    secondaryDevice,
    connecting,
    showDeviceModal,
    scannedDevices,
    deviceSlotToConnect,
    deviceSettings,
    batteryLevels,
    firmwareInfo,
    otaState,
    scanAndConnect,
    disconnect,
    flashDevice,
    updateDeviceSetting,
    handleDeviceSelect,
    cancelScan,
  } = useBle();
  const [isMessageSheetVisible, setIsMessageSheetVisible] = useState(false);
  const handleRangeChange = (opt) => {
    setRange(opt);
    setSelectedDate(null);
  };

  const asList = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }, []);

  const getDateLabel = (inputDate) => {
    const startOfDay = (d) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const today = startOfDay(new Date());
    const date = startOfDay(inputDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((date - today) / msPerDay);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (Math.abs(diff) < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderToggleGroup = (slot, key, options) => {
    const currentValue = deviceSettings?.[slot]?.[key];
    return (
      <View style={brandTheme.style(styles.deviceToggleGroup)}>
        {options.map((option) => {
          const selected = currentValue === option.value;
          return (
            <Pressable
              key={`${slot}-${key}-${option.label}`}
              style={brandTheme.style([styles.deviceToggle, selected && styles.deviceToggleActive])}
              onPress={() => updateDeviceSetting(slot, key, option.value)}
            >
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style([styles.deviceToggleText, selected && styles.deviceToggleTextActive])]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderSensorRow = (label, device, slot) => {
    const isOpen = openDeviceSettings === slot;
    const batteryLevel = batteryLevels?.[slot];
    return (
      <View style={brandTheme.style(styles.sensorBox)}>
        <View style={brandTheme.style(styles.sensorRow)}>
          <View style={brandTheme.style(styles.sensorTextWrap)}>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sensorLabel)]}>
              {label}
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sensorBattery)]}>
                {'  '}Battery: {Number.isFinite(batteryLevel) ? `${batteryLevel}%` : '--'}
              </Text>
            </Text>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sensorStatus)]}>
              {device ? device.name || device.id : 'Not connected'}
            </Text>
          </View>
          <View style={brandTheme.style(styles.sensorActions)}>
            <Pressable
              style={brandTheme.style([styles.flashButton, !device && styles.sensorButtonDisabled])}
              disabled={!device}
              onPress={() => flashDevice(slot)}
            >
              <FontAwesome5 name="bolt" color={brandTheme.color(device ? '#fff' : '#64748b')} size={15} />
            </Pressable>
            {device ? (
              <Pressable style={brandTheme.style([styles.sensorButton, styles.sensorButtonDanger])} onPress={() => disconnect(slot)}>
                <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sensorButtonText)]}>Disconnect</Text>
              </Pressable>
            ) : (
              <Pressable
                style={brandTheme.style([styles.sensorButton, connecting && styles.sensorButtonDisabled])}
                disabled={connecting}
                onPress={() => scanAndConnect(slot)}
              >
                <Text style={[{color:brandTheme.colors.text}, brandTheme.style([styles.sensorButtonText, connecting && styles.sensorButtonTextDisabled])]}>
                  {connecting ? 'Scanning...' : 'Connect'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <Pressable
          style={brandTheme.style(styles.deviceDropdownButton)}
          onPress={() => setOpenDeviceSettings((prev) => (prev === slot ? null : slot))}
        >
          <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.deviceDropdownText)]}>
            Device setup: {isOpen ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
        {isOpen ? (
          <View style={brandTheme.style(styles.deviceDropdown)}>
            <Text style={{color:brandTheme.colors.text}}>Firmware: {firmwareInfo?.[slot]?.version || 'Connect to check'}</Text>
            <BrandButton title={otaState?.slot === slot ? 'View update status' : 'Firmware update'} disabled={!device || fromClientList} onPress={() => navigation.navigate('FirmwareUpdate', {slot})} />
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.deviceOptionLabel)]}>Side</Text>
            {renderToggleGroup(slot, 'side', [
              { label: 'Left', value: ExerciseSide.left.value },
              { label: 'Right', value: ExerciseSide.right.value },
            ])}
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.deviceOptionLabel)]}>Placement</Text>
            {renderToggleGroup(slot, 'limb', [
              { label: 'Leg', value: ExerciseLimb.leg.value },
              { label: 'Arm', value: ExerciseLimb.arm.value },
            ])}
          </View>
        ) : null}
      </View>
    );
  };


  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const current = await getCurrentUser();
      const activeUser = current?.userId || current?.username;
      let custId = fromClientList && clientData?.id ? clientData.id : null;
      if (!custId && activeUser) {
        const { data, errors } = await client.graphql({ query: LIST_CUSTOMERS_BY_USER, variables: { user_id: activeUser } });
        if (errors?.length || !Array.isArray(data?.listCustomers?.items)) throw new Error('Customer profile unavailable.');
        custId = data?.listCustomers?.items?.[0]?.customer_id;
      }
      if (!custId) {
        setSessions([]);
        setSessionsError('No customer profile found.');
        setSessionsLoading(false);
        return;
      }
      const { data, errors } = await client.graphql({
        query: listSessionsByCustomerQuery,
        variables: { customer_id: custId, limit: 50 },
      });
      if (errors?.length || !data?.listSessionsByCustomer) throw new Error('Session history unavailable.');
      const list = asList(data?.listSessionsByCustomer);
      list.sort((a, b) => new Date(b.workout_date || b.created_at) - new Date(a.workout_date || a.created_at));
      setSessions(list);
      if (list.length) {
        const recent = normalizeDate(list[0].workout_date || list[0].created_at);
        if (recent) {
          setSelectedDate(recent);
          setMonthDate(new Date(`${recent}T12:00:00`));

        }

      }
    } catch (err) {
      console.log('Fetch sessions failed', err);
      setSessionsError('Failed to load sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, [client, asList, fromClientList, clientData?.id]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSessions]);

  // Discover trainer_id to decide whether to show the Trainer dashboard entry
  useEffect(() => {
    (async () => {
      try {
        const current = await getCurrentUser();
        const user_id = current?.userId || current?.username;
        // Fetch user gender (fetch the viewed client's gender if in client view mode)
        const targetUserId = (fromClientList && clientData?.id) ? clientData.id : user_id;
        console.log('HomeScreen: Fetching user data for user_id:', targetUserId);
        try {
          const { data } = await client.graphql({
            query: GET_USER,
            variables: { user_id: targetUserId },
          });
          const g = (data?.getUser?.gender || '').toLowerCase();
          if (g === 'female' || g === 'male') setUserGender(g);

          // Only fetch/set the role for the logged-in user so we preserve trainer capabilities in the UI
          if (!fromClientList) {
            const r = (data?.getUser?.role || '').toLowerCase();
            setUserRole(r);
          } else {
            // If in trainer view mode, we are definitely a trainer
            setUserRole('trainer');
          }
        } catch (e) {
          console.log('HomeScreen: Fetch user role/gender failed', e);
        }

        // Even if role isn't 'trainer' yet in DB, we check if a trainer record exists for the logged in user
        const { data: tData } = await client.graphql({
          query: LIST_TRAINERS_BY_USER,
          variables: { user_id },
        });

        console.log('HomeScreen: Fetch trainer data is', tData.listTrainers.items);

        // Reverted: Trusting the first item returned
        const trainer = tData?.listTrainers?.items?.[0];

        if (trainer?.trainer_id) {
          setTrainerId(trainer.trainer_id);
          console.log('HomeScreen: User has trainer_id:', trainer.trainer_id);
        } else {
          setTrainerId(null);
          console.log('HomeScreen: No trainer record found for user_id:', user_id);
        }
      } catch (err) {
        console.log('HomeScreen: Fetch trainer for dashboard failed', err);
      }
    })();
  }, [client, fromClientList, clientData]);

  const ensureTrainerId = useCallback(async () => {
    if ((userRole || '').toLowerCase() !== 'trainer') return null;
    if (trainerId) return trainerId;
    try {
      const current = await getCurrentUser();
      const user_id = current?.userId || current?.username;
      const { data: listData } = await client.graphql({
        query: LIST_TRAINERS_BY_USER,
        variables: { user_id },
      });
      const items = listData?.listTrainers?.items || [];
      const trainer = items.find(item => item.user_id === user_id);
      if (trainer?.trainer_id) {
        setTrainerId(trainer.trainer_id);
        console.log('Trainer ID (existing):', trainer.trainer_id);
        return trainer.trainer_id;
      }
    } catch (err) {
      console.log('ensureTrainerId failed', err);
    }
    return null;
  }, [client, trainerId, userRole]);

  const movement = useSessionMovement(client, sessions);
  const selectedSessions = selectMovementSessions(sessions, selectedDate, monthDate, range);
  const selectedReps = selectedSessions.flatMap(session => movement.records[session.session_id] || []);
  const movementError = selectedSessions.some(session => movement.errors[session.session_id]);
  useEffect(() => {
    let active = true;
    (async () => {
      const map = {};
      let nextToken;
      do {
        const { data } = await client.graphql({ query: listExercises, variables: { limit: 500, nextToken } });
        asList(data?.listExercises).forEach(exercise => { map[normalizeKey(exercise.exercise_id)] = exercise; });
        nextToken = data?.listExercises?.nextToken;
      } while (nextToken && active);
      if (active) setExerciseMap(map);
    })().catch(() => {});
    return () => { active = false; };
  }, [client, asList]);

  const ensureSessionDetails = useCallback(async sessionId => {
    setSessionLoadingMap(previous => ({ ...previous, [sessionId]: true }));
    try {
      const details = await loadSessionDetails(client, sessionId);
      setSessionsError(null);
      setSessionDetailsMap(previous => ({ ...previous, [sessionId]: details }));
    } catch { setSessionsError('Session details could not be loaded. Close and reopen the session to retry.'); }
    finally { setSessionLoadingMap(previous => ({ ...previous, [sessionId]: false })); }
  }, [client]);

  const toggleSession = async (session_id) => {
    if (expandedSessionId === session_id) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(session_id);
    await ensureSessionDetails(session_id);
  };

  const renderSession = (session) => {
    const isOpen = expandedSessionId === session.session_id;
    const details = sessionDetailsMap[session.session_id] || [];
    const loadingDetails = sessionLoadingMap[session.session_id];
    return (
      <View key={`home-sess-${session.session_id}`} style={brandTheme.style(styles.sessCard)}>
        <Pressable onPress={() => toggleSession(session.session_id)} style={brandTheme.style(styles.sessHeader)}>
          <View>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessTitle)]}>{formatDate(session.workout_date)}</Text>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessMeta)]}>Created: {formatDate(session.created_at)}</Text>
          </View>
          <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessExpand)]}>{isOpen ? 'Hide' : 'View'}</Text>
        </Pressable>
        {isOpen && (
          <View style={brandTheme.style(styles.sessBody)}>
            {loadingDetails ? (
              <ActivityIndicator />
            ) : details.length === 0 ? (
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.muted)]}>No session items recorded.</Text>
            ) : (
              details.map(item => <ExerciseHistory
                key={`${session.session_id}-${item.session_item_index}`}
                name={exerciseMap[normalizeKey(item.exercise_id)]?.name || `Exercise ${item.session_item_index}`}
                reps={item.reps} sets={item.sets} metadataError={item.setsError} />)
            )}
          </View>
        )}
      </View>
    );
  };

  const handleAction = async (key) => {
    switch (key) {
      case 'runner':
        navigation.navigate('WorkoutRunner');
        break;
      case 'builder': {
        const tId = await ensureTrainerId();
        navigation.navigate('CreateWorkout', { trainer_id: tId || undefined });
        break;
      }
      case 'library':
        navigation.navigate('WorkoutLibrary');
        break;
      case 'sessions':
        navigation.navigate('SessionDashboard', fromClientList ? { fromClientList: true, clientData } : undefined);
        break;
      case 'exercises':
        navigation.navigate('ExerciseLibrary');
        break;
      case 'trainerDirectory':
        navigation.navigate('TrainerDirectory');
        break;
      case 'profile':
        navigation.navigate('ProfileSetup', { next: 'Home' });
        break;
      case 'trainerDash': {
        const tId = await ensureTrainerId();
        if (tId) navigation.navigate('TrainerDashboard', { trainer_id: tId });
        break;
      }
      case 'signOut':
        try {
          await signOut();
        } catch (err) {
          console.log('Sign out failed', err);
        }
        break;
      default:
        Alert.alert('Coming Soon', `The ${key} feature is under development.`);
    }
  };

  const backToAuth = async () => {
    try {
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    } catch (e) {
      Alert.alert('Sign out failed', e?.message || 'Please try again.');
    }
  };

  return (
    <View style={brandTheme.style(styles.safe)}>
      <ScrollView contentContainerStyle={styles.container}>
        <TutorialCard />
        {fromClientList && (
          <View style={brandTheme.style(styles.topDesignContainer)}>
            <View style={brandTheme.style(styles.actionRow)}>
              <TouchableOpacity
                style={brandTheme.style(styles.bubbleButton)}
                onPress={() => navigation.navigate('WorkoutLibrary', {
                  clientData
                })}
              >
                <View style={brandTheme.style(styles.bubble)}>
                  <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.bubbleText)]}>Send{"\n"}Workout</Text>
                </View>
                <View style={brandTheme.style(styles.bubbleTailLeft)} />
              </TouchableOpacity>

              <View
                style={brandTheme.style([styles.profileContainer, { justifyContent: 'center', alignItems: 'center' }])}
              >
                {clientData?.Demographic?.profile_image_url ? (
                  <Image
                    source={{ uri: clientData.Demographic.profile_image_url }}
                    style={brandTheme.style(styles.dashboardProfileImage)}
                  />
                ) : (
                  <Ionicons name="person" size={54} color={brandTheme.color("#000")} />
                )}
              </View>

              <TouchableOpacity
                style={brandTheme.style(styles.bubbleButton)}
                onPress={() => setIsMessageSheetVisible(true)}
              >
                <View style={brandTheme.style(styles.bubble)}>
                  <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.bubbleText)]}>Send{"\n"}Message</Text>
                </View>
                <View style={brandTheme.style(styles.bubbleTailRight)} />
              </TouchableOpacity>
            </View>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.clientNameText)]}>{clientData?.Demographic?.name || 'Client'}</Text>
          </View>
        )}

        {!fromClientList &&
          <>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Welcome back</Text>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.subtitle)]}>Connect your bands, record movement, and review your progress.</Text>
          </>
        }

        <View style={brandTheme.style(styles.bluetoothCard)}>
          <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.bluetoothTitle)]}>Your bands</Text>
          {renderSensorRow('Device 1', connectedDevice, 'primary')}
          {renderSensorRow('Device 2', secondaryDevice, 'secondary')}
        </View>

        <View style={brandTheme.style(styles.grid)}>
          {(() => {
            const base = [...actions];
            if (trainerId && userRole === 'trainer' && !fromClientList) {
              base.push({ label: 'Trainer Dashboard', key: 'trainerDash' });
            }
            return base.map((action) => {
              const isCardDisabled = fromClientList && action.key !== 'sessions';
              return (
                <TouchableOpacity
                  key={action.key}
                  style={brandTheme.style([
                    styles.card,
                    action.accent && styles.cardAccent,
                    isCardDisabled && { backgroundColor: '#f1f5f9', opacity: 0.5 }
                  ])}
                  onPress={() => {
                    if (!isCardDisabled) {
                      handleAction(action.key);
                    }
                  }}
                  disabled={isCardDisabled}
                >
                  <Text style={[{color:brandTheme.colors.text}, brandTheme.style([
                    styles.cardText,
                    action.accent && styles.cardTextAccent,
                    isCardDisabled && { color: '#94a3b8' }
                  ])]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            });
          })()}
        </View>

        <View style={brandTheme.style(styles.mapCard)}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {['week', 'month', 'year'].map(option => <Pressable key={option} onPress={() => handleRangeChange(option)} accessibilityRole="button" accessibilityState={{ selected: !selectedDate && range === option }} style={{ padding: 12, borderRadius: 12, backgroundColor: !selectedDate && range === option ? brandTheme.colors.raised : brandTheme.colors.surface }}><Text style={{ color: brandTheme.colors.text }}>{option}</Text></Pressable>)}
          </View>
          <Text style={{ color: brandTheme.colors.muted, marginBottom: 12 }}>{selectedDate || `Selected ${range}`}</Text>
          <MovementSummary label="Your recorded movement" reps={selectedReps} sessionCount={selectedSessions.length}
            loading={movement.loading} error={movementError} onRetry={movement.retry} />
          <Pressable accessibilityRole="button" onPress={() => handleAction('sessions')} style={{ paddingVertical: 16 }}><Text style={{ color: brandTheme.colors.accent, fontWeight: '700' }}>Review sets and reps →</Text></Pressable>
        </View>

        <View style={brandTheme.style(styles.homeCalCard)}>
          <View style={brandTheme.style(styles.homeCalHeader)}>
            <TouchableOpacity onPress={() => { setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); setSelectedDate(null); }}>
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.homeCalNav)]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.homeCalTitle)]}>
              {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => { setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); setSelectedDate(null); }}>
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.homeCalNav)]}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={brandTheme.style(styles.homeCalGrid)}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Text key={d} style={[{color:brandTheme.colors.text}, brandTheme.style(styles.homeCalDow)]}>{d}</Text>
            ))}
            {(() => {
              const year = monthDate.getFullYear();
              const month = monthDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells = [];
              for (let i = 0; i < firstDay; i += 1) {
                cells.push(<View key={`pad-${i}`} style={brandTheme.style(styles.homeCalCell)} />);
              }
              const sessionDates = new Set(
                sessions
                  .map((s) => normalizeDate(s.workout_date || s.created_at))
                  .filter((d) => d && d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
              );
              for (let day = 1; day <= daysInMonth; day += 1) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasSession = sessionDates.has(dateStr);
                const isSelected = selectedDate === dateStr;
                cells.push(
                  <TouchableOpacity
                    key={dateStr}
                    style={brandTheme.style([
                      styles.homeCalCell,
                      isSelected && styles.homeCalCellSelected,
                    ])}
                    accessibilityLabel={`Review movement on ${dateStr}`}
                    onPress={() => setSelectedDate(dateStr)}
                  >
                    <Text style={[{color:brandTheme.colors.text}, brandTheme.style([styles.homeCalCellText, isSelected && styles.homeCalCellTextSelected])]}>{day}</Text>
                    {hasSession ? <View style={brandTheme.style(styles.homeCalDot)} /> : null}
                  </TouchableOpacity>
                );
              }
              return cells;
            })()}
          </View>
        </View>

        <View style={brandTheme.style(styles.sessionSection)}>
          <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessionSectionTitle)]}>Recent Sessions</Text>
          {sessionsLoading ? <ActivityIndicator /> : null}
          {sessionsError ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.errorText)]}>{sessionsError}</Text> : null}
          {!sessionsLoading && !sessions.length ? (
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.muted)]}>No sessions recorded yet.</Text>
          ) : null}
          {sessions.slice(0, 5).map(renderSession)}
        </View>

        {!fromClientList && (
          <TouchableOpacity onPress={backToAuth} style={brandTheme.style(styles.signOut)}>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.signOutText)]}>Sign out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showDeviceModal} transparent animationType="slide">
        <View style={brandTheme.style(styles.modalOverlay)}>
          <View style={brandTheme.style(styles.modalCard)}>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.modalTitle)]}>
              {deviceSlotToConnect === 'secondary'
                ? 'Select Device 2'
                : 'Select Device 1'}
            </Text>
            {connecting ? (
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.modalText)]}>Scanning for nearby Bluetooth devices...</Text>
            ) : scannedDevices.length === 0 ? (
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.modalText)]}>No devices found. Try scanning again.</Text>
            ) : null}
            <FlatList
              style={brandTheme.style(styles.deviceList)}
              data={scannedDevices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleDeviceSelect(item)} style={brandTheme.style(styles.deviceRow)}>
                  <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.deviceName)]}>{item.name || 'Unnamed device'}</Text>
                  <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.deviceId)]}>{item.id}</Text>
                </TouchableOpacity>
              )}
            />
            <BrandButton color={brandTheme.colors.primary} title="Cancel" onPress={cancelScan} />
          </View>
        </View>
      </Modal>

      <DirectMessageBottomSheet
        isVisible={isMessageSheetVisible}
        onClose={() => setIsMessageSheetVisible(false)}
        recipientName={clientData?.Demographic?.name || 'Client'}
        sendTo={clientData?.Demographic?.email || ''}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    // padding: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#d0494b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#b55658',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexBasis: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f6cdd0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardAccent: {
    backgroundColor: '#d0494b',
    borderColor: '#d0494b',
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b55658',
  },
  cardTextAccent: {
    color: '#fff',
  },
  signOut: {
    marginTop: 24,
    alignSelf: 'flex-start',
  },
  signOutText: {
    color: '#d0494b',
    fontWeight: '600',
  },
  mapCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f2f4f7',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowMomentumHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors?.APP_BLACK || '#0f172a',
  },
  mapHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapDate: {
    fontSize: 14,
    color: '#475569',
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  rangeChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  rangeChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  rangeChipTextActive: {
    color: '#fff',
  },
  mapDateLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors?.APP_BLUE || '#2563eb',
  },
  bodyHighlighterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  muscleList: {
    marginTop: 16,
  },
  muscleChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  muscleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  musclePct: {
    fontSize: 14,
    color: '#0f172a',
  },
  momentumList: {
    marginTop: 8,
    gap: 2,
  },
  muted: {
    marginTop: 8,
    color: '#94a3b8',
  },
  momentumRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 16,
  },
  momentumItem: {
    alignItems: 'center',
  },
  momentumValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  momentumLabel: {
    fontSize: 14,
    color: '#475569',
  },
  homeCalCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  homeCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  homeCalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  homeCalNav: {
    fontSize: 18,
    color: '#0f172a',
  },
  homeCalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  homeCalDow: {
    width: '13%',
    textAlign: 'center',
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  homeCalCell: {
    width: '13%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  homeCalCellSelected: {
    backgroundColor: '#e0ecff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  homeCalCellText: {
    fontSize: 12,
    color: '#0f172a',
  },
  homeCalCellTextSelected: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  homeCalMomentum: {
    fontSize: 11,
    color: '#0f172a',
    marginTop: 2,
  },
  homeCalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    marginTop: 2,
  },
  sessionSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  sessionSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  errorText: {
    color: '#b91c1c',
  },
  sessCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  sessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sessMeta: {
    fontSize: 12,
    color: '#475569',
  },
  sessExpand: {
    color: '#2563eb',
    fontWeight: '700',
  },
  sessBody: {
    marginTop: 8,
    gap: 6,
  },
  sessItem: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  sessSetList: {
    marginTop: 4,
    gap: 2,
  },
  topDesignContainer: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bubbleButton: {
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#005AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bubbleTailLeft: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderRightColor: 'transparent',
    borderTopColor: '#005AFF',
    alignSelf: 'flex-end',
    marginRight: 15,
    marginTop: -2,
    transform: [{ rotate: '0deg' }]
  },
  bubbleTailRight: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderTopColor: '#005AFF',
    alignSelf: 'flex-start',
    marginLeft: 15,
    marginTop: -2,
  },
  profileContainer: {
    marginHorizontal: 15,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 50,
    padding: 2,
    width: 88,
    height: 88,
  },
  dashboardProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  clientNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 10,
  },
  bluetoothCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  bluetoothTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  sensorBox: {
    gap: 8,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sensorTextWrap: {
    flex: 1,
  },
  sensorLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sensorBattery: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  sensorStatus: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  sensorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flashButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  deviceDropdownButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  deviceDropdownText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  deviceDropdown: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 4,
  },
  deviceOptionLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  deviceToggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  deviceToggle: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  deviceToggleActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  deviceToggleText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  deviceToggleTextActive: {
    color: '#fff',
  },
  sensorButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  sensorButtonDanger: {
    backgroundColor: '#d0494b',
  },
  sensorButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  sensorButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sensorButtonTextDisabled: {
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 16,
    color: '#475569',
    textAlign: 'center',
  },
  deviceList: {
    maxHeight: 220,
    width: '100%',
  },
  deviceRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  deviceName: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  deviceId: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
});


