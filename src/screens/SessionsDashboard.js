import MovementSummary from '../Components/history/MovementSummary';
import useSessionMovement from '../Components/history/useSessionMovement';
import { localWorkoutDate, selectMovementSessions } from '../Components/history/movementMetrics';
import { loadSessionDetails } from '../Components/history/sessionHistoryData';
import ExerciseHistory from '../Components/history/HistoryCards';
import { useBIOPHLXTheme } from '../Theme/BIOPHLXTheme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DirectMessageBottomSheet from '../Components/BottomSheet/DirectMessageBottomSheet';
import Colors from '../Theme/Colors';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import {
  listSessionsByCustomerQuery,
  listSessionItemsBySession,
  listSessionItemSetsQuery,
  listSessionItemRepsQuery,
  listExercises,
  getExerciseQuery,
} from '../graphql/queries';

const LIST_CUSTOMERS_BY_USER = /* GraphQL */ `
  query ListCustomers($user_id: ID!) {
    listCustomers(filter: { user_id: { eq: $user_id } }, limit: 1) {
      items { customer_id }
      nextToken
    }
  }
`;

export default function SessionsDashboard({ route, navigation }) {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  const { fromClientList, clientData } = route?.params || {};
  const client = useMemo(() => generateClient({ authMode: 'userPool' }), []);
  const [customerId, setCustomerId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionDetailsMap, setSessionDetailsMap] = useState({});
  const [sessionLoadingMap, setSessionLoadingMap] = useState({});
  const [exerciseMap, setExerciseMap] = useState({});
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [isMessageSheetVisible, setIsMessageSheetVisible] = useState(false);
  const [profileImage, setProfileImage] = useState('https://via.placeholder.com/80');

  useEffect(() => {
    if (clientData?.Demographic?.profile_image) {
      setProfileImage(clientData.Demographic.profile_image);
    }
  }, [clientData]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };
  const asList = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }, []);

  const normalizeDate = localWorkoutDate;

  const fetchSessions = useCallback(
    async (custId) => {
      if (!custId) {
        setError('No customer profile found.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data, errors } = await client.graphql({
          query: listSessionsByCustomerQuery,
          variables: { customer_id: custId, limit: 50 },
        });
        if (errors?.length || !data?.listSessionsByCustomer) throw new Error('Session history unavailable.');
        const list = asList(data?.listSessionsByCustomer);
        list.sort((a, b) => new Date(b.workout_date || b.created_at) - new Date(a.workout_date || a.created_at));
        setSessions(list);
      } catch (err) {
        console.log('Fetch sessions failed', err);
        setError(err?.errors?.[0]?.message || 'Failed to load sessions.');
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const initialDateChosen = useRef(false);
  useEffect(() => {
    if (!sessions.length || initialDateChosen.current) return;
    // Default to most recent session date if nothing selected
    const recent = sessions
      .map((s) => normalizeDate(s.workout_date || s.created_at))
      .filter(Boolean)
      .sort()
      .pop();
    if (recent && !selectedDate) {
      initialDateChosen.current = true;
      setSelectedDate(recent);
      setMonthDate(new Date(`${recent}T12:00:00`));
    }
  }, [sessions, normalizeDate, selectedDate]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // If coming from Client List, we use the passed clientData.id
        if (fromClientList && clientData?.id) {
          setCustomerId(clientData.id);
          await fetchSessions(clientData.id);
          return;
        }

        // Fallback: Current user logic
        const current = await getCurrentUser();
        const user_id = current?.userId || current?.username;
        if (!user_id) {
          setError('User not authenticated.');
          setLoading(false);
          return;
        }

        const { data, errors } = await client.graphql({
          query: LIST_CUSTOMERS_BY_USER,
          variables: { user_id },
        });
        if (errors?.length || !Array.isArray(data?.listCustomers?.items)) throw new Error('Customer profile unavailable.');
        const items = data?.listCustomers?.items || [];
        const cid = items[0]?.customer_id;
        if (cid) {
          setCustomerId(cid);
          await fetchSessions(cid);
        } else {
          setError('No customer profile found for this user.');
          setLoading(false);
        }
      } catch (err) {
        console.log('Load initial data failed', err);
        setError('Failed to load user profile.');
        setLoading(false);
      }
    })();
  }, [fetchSessions, client, fromClientList, clientData]);

  const ensureSessionDetails = useCallback(async sessionId => {
    setSessionLoadingMap(previous => ({ ...previous, [sessionId]: true }));
    try {
      const details = await loadSessionDetails(client, sessionId);
      setError(null);
      setSessionDetailsMap(previous => ({ ...previous, [sessionId]: details }));
    } catch { setError('Session details could not be loaded. Close and reopen the session to retry.'); }
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

  const movement = useSessionMovement(client, sessions);
  const selectedSessions = selectMovementSessions(sessions, selectedDate, monthDate);
  const selectedReps = selectedSessions.flatMap(session => movement.records[session.session_id] || []);
  const movementError = selectedSessions.some(session => movement.errors[session.session_id]);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await client.graphql({ query: listExercises, variables: { limit: 1000 } });
      if (active) setExerciseMap(Object.fromEntries(asList(data?.listExercises).map(exercise => [exercise.exercise_id, exercise])));
    })().catch(() => {});
    return () => { active = false; };
  }, [client, asList]);

  const renderSession = (session) => {
    const isOpen = expandedSessionId === session.session_id;
    const details = sessionDetailsMap[session.session_id] || [];
    const loadingDetails = sessionLoadingMap[session.session_id];
    return (
      <View key={session.session_id} style={brandTheme.style(styles.card)}>
        <Pressable onPress={() => toggleSession(session.session_id)} style={brandTheme.style(styles.sessionHeader)}>
          <View>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessionTitle)]}>{formatDate(session.workout_date)}</Text>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.sessionMeta)]}>Workout review</Text>
            {/* Workout/session IDs hidden per request */}
            {/* {session.workout_id ? (
              <Text style={styles.sessionMeta}>Workout: {session.workout_id}</Text>
            ) : (
              <Text style={styles.sessionMeta}>Ad-hoc workout</Text>
            )}
            <Text style={styles.sessionMeta}>Session: {session.session_id}</Text> */}
          </View>
          <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.expand)]}>{isOpen ? 'Hide' : 'View'}</Text>
        </Pressable>
        {isOpen && (
          <View style={brandTheme.style(styles.sessionBody)}>
            {loadingDetails ? (
              <ActivityIndicator />
            ) : details.length === 0 ? (
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.muted)]}>No session items recorded.</Text>
            ) : (
              details.map(item => <ExerciseHistory
                key={`${session.session_id}-${item.session_item_index}`}
                name={exerciseMap[item.exercise_id]?.name || `Exercise ${item.session_item_index}`}
                reps={item.reps || []} sets={item.sets || []} metadataError={item.setsError} />)
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={brandTheme.style(styles.safe)}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Session history</Text>
        {fromClientList && <Text style={{ color: brandTheme.colors.muted, marginBottom: 12 }}>Reviewing {clientData?.Demographic?.name || 'client'}</Text>}
        <View style={brandTheme.style(styles.calendarCard)}>
          <View style={brandTheme.style(styles.calendarHeader)}>
            <TouchableOpacity onPress={() => { setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); setSelectedDate(null); }}>
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarNav)]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarTitle)]}>
              {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => { setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); setSelectedDate(null); }}>
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarNav)]}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={brandTheme.style(styles.calendarGrid)}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Text key={d} style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarDow)]}>{d}</Text>
            ))}
            {(() => {
              const year = monthDate.getFullYear();
              const month = monthDate.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const cells = [];
              for (let i = 0; i < firstDay; i += 1) {
                cells.push(<View key={`pad-${i}`} style={brandTheme.style(styles.calendarCell)} />);
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
                      styles.calendarCell,
                      isSelected && styles.calendarCellSelected,
                    ])}
                    accessibilityLabel={`Review ${dateStr}`}
                    onPress={() => setSelectedDate(dateStr)}
                  >
                    <Text style={[{color:brandTheme.colors.text}, brandTheme.style([styles.calendarCellText, isSelected && styles.calendarCellTextSelected])]}>{day}</Text>
                    {hasSession ? <View style={brandTheme.style(styles.calendarDot)} /> : null}
                  </TouchableOpacity>
                );
              }
              return cells;
            })()}
          </View>
        </View>
        <View style={brandTheme.style(styles.mapCard)}>

          <Text style={[styles.mapDate,{color:brandTheme.colors.muted,marginBottom:16}]}>{selectedDate || monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <MovementSummary label={selectedDate ? "Day movement summary" : "Month movement summary"} reps={selectedReps} sessionCount={selectedSessions.length} loading={movement.loading} error={movementError} onRetry={movement.retry} />
        </View>
        {loading ? <ActivityIndicator size="large" /> : null}
        {error ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.error)]}>{error}</Text> : null}
        {!loading && !sessions.length ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.muted)]}>No sessions recorded yet.</Text> : null}
        {selectedSessions.map(renderSession)}
      </ScrollView>
    </View>
  );
}

const formatDate = (value) => {
  if (!value) return 'Unknown date';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00` : value);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return dateOnly ? date.toLocaleDateString() : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
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
  },
  dashboardProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  plusIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.APP_RED || '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  dashboardLabel: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  expand: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  calendarNav: {
    fontSize: 18,
    color: '#0f172a',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  calendarDow: {
    width: '14.285714%',
    textAlign: 'center',
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  calendarCell: {
    width: '14.285714%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  calendarCellSelected: {
    backgroundColor: '#e0ecff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  calendarCellText: {
    fontSize: 12,
    color: '#0f172a',
  },
  calendarCellTextSelected: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  calendarMomentum: {
    fontSize: 11,
    color: '#0f172a',
    marginTop: 2,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    marginTop: 2,
  },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowMomentumHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  mapDate: {
    fontSize: 14,
    color: '#475569',
  },
  bodyHighlighterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  muscleList: {
    marginTop: 12,
    gap: 8,
  },
  muscleChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
  momentumRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  momentumItem: {
    alignItems: 'flex-start',
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
  sessionBody: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 10,
    gap: 10,
  },
  itemBlock: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemTitle: {
    fontWeight: '600',
    color: '#0f172a',
  },
  itemMeta: {
    fontSize: 12,
    color: '#475569',
  },
  subSection: {
    marginTop: 6,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
  },
  summaryRowGrid: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  summaryTextLow: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  summaryTextWarn: {
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  summaryTextHigh: {
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  pieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  barList: {
    marginTop: 6,
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 50,
    fontSize: 11,
    color: '#475569',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barValue: {
    width: 45,
    fontSize: 11,
    color: '#334155',
    textAlign: 'right',
  },
  subText: {
    fontSize: 12,
    color: '#0f172a',
  },
  subDivider: {
    fontSize: 12,
    color: '#94a3b8',
  },
  error: {
    color: '#b91c1c',
    marginBottom: 12,
  },
  muted: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  subDivider: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
