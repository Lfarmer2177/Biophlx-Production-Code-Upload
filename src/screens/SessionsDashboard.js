import ExerciseHistory, { MuscleBreakdown } from '../Components/history/HistoryCards';
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
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';
import Body from '../Components/react-native-body-highlighter';

const MAX_SESSION_ITEM_INDEX = 20;
const MAX_ROM = 120;
const MAX_TUT = 5; // seconds
const MAX_VELOCITY = 2; // m/s
const MAX_MOMENTUM = 300; // heuristic cap for visualization
const clampPct = (v) => Math.max(0, Math.min(100, v || 0));
const getBarColor = (value) => {
  const v = clampPct(value);
  if (v < 25) return '#ef4444';
  if (v < 50) return '#f97316';
  if (v < 75) return '#facc15';
  return '#22c55e';
};

const muscleEmoji = {
  Legs: 'Legs',
  Chest: 'Chest',
  Back: 'Back',
  Shoulders: 'Shoulders',
  Abs: 'Abs',
  Arms: 'Arms',
};

const pieColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#8b5cf6', '#ec4899'];
const bodyParts = {
  trapezius: { muscleName: 'Traps', side: 'Both' },
  triceps: { muscleName: 'Triceps', side: 'Both' },
  forearm: { muscleName: 'Forearm', side: 'Both' },
  adductors: { muscleName: 'Adductors', side: 'Both' },
  calves: { muscleName: 'Calves', side: 'Both' },
  neck: { muscleName: 'Neck', side: 'Both' },
  deltoids: { muscleName: 'Deltoids', side: 'Both' },
  hands: { muscleName: 'Hands', side: 'Both' },
  feet: { muscleName: 'Feet', side: 'Both' },
  head: { muscleName: 'Head', side: 'Both' },
  ankles: { muscleName: 'Ankles', side: 'Both' },
  tibialis: { muscleName: 'Tibialis', side: 'Front' },
  obliques: { muscleName: 'Abs', side: 'Front' },
  chest: { muscleName: 'Chest', side: 'Front' },
  biceps: { muscleName: 'Biceps', side: 'Front' },
  abs: { muscleName: 'Abs', side: 'Front' },
  quadriceps: { muscleName: 'Quads', side: 'Front' },
  knees: { muscleName: 'Knees', side: 'Front' },
  'upper-back': { muscleName: 'Upper Back', side: 'Back' },
  'lower-back': { muscleName: 'Lower Back', side: 'Back' },
  hamstring: { muscleName: 'Hamstrings', side: 'Back' },
  gluteal: { muscleName: 'Glutes', side: 'Back' },
};

const MusclePieChart = ({ segments, size = 120 }) => {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  if (!segments.length) return null;
  const radius = size / 2;
  let startAngle = 0;
  const paths = segments.map((seg, idx) => {
    const pct = seg.percent || 0;
    const angle = (pct / 100) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = radius + radius * Math.cos(startAngle);
    const y1 = radius + radius * Math.sin(startAngle);
    const x2 = radius + radius * Math.cos(endAngle);
    const y2 = radius + radius * Math.sin(endAngle);
    const d = `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { d, color: pieColors[idx % pieColors.length], label: seg.name, percent: pct };
  });
  return (
    <View style={brandTheme.style({ alignItems: 'center' })}>
      <Svg width={size} height={size} style={brandTheme.style({ marginVertical: 8 })}>
        <G>
          {paths.map((p, idx) => (
            <Path key={idx} d={p.d} fill={p.color} />
          ))}
        </G>
      </Svg>
      <View style={brandTheme.style({ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' })}>
        {paths.map((p, idx) => (
          <View key={`legend-${idx}`} style={brandTheme.style({ flexDirection: 'row', alignItems: 'center', gap: 4 })}>
            <View style={brandTheme.style({ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color })} />
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style({ fontSize: 12, color: '#0f172a' })]}>
              {p.label} {p.percent.toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

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

  const { fromClientList, clientData } = route.params || {};
  const client = useMemo(() => generateClient({ authMode: 'userPool' }), []);
  const [customerId, setCustomerId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionDetailsMap, setSessionDetailsMap] = useState({});
  const [sessionLoadingMap, setSessionLoadingMap] = useState({});
  const [repsByItem, setRepsByItem] = useState({});
  const [repsLoadingByItem, setRepsLoadingByItem] = useState({});
  const [openItems, setOpenItems] = useState({});
  const [exerciseMap, setExerciseMap] = useState({});
  const [exerciseFetchSet, setExerciseFetchSet] = useState(new Set());
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [bodyData, setBodyData] = useState([]);
  const [muscleMomentumList, setMuscleMomentumList] = useState([]);
  const [totalMomentumData, setTotalMomentumData] = useState(0);
  const [sessionMomentumMap, setSessionMomentumMap] = useState({});
  const [momentumByDate, setMomentumByDate] = useState({});
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

  const normalizeDate = useCallback((value) => {
    if (!value) return null;
    try {
      const d = new Date(value);
      return d.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }, []);

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
        const { data } = await client.graphql({
          query: listSessionsByCustomerQuery,
          variables: { customer_id: custId, limit: 50 },
        });
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

  useEffect(() => {
    if (!sessions.length) return;
    // Default to most recent session date if nothing selected
    const recent = sessions
      .map((s) => normalizeDate(s.workout_date || s.created_at))
      .filter(Boolean)
      .sort()
      .pop();
    if (recent && !selectedDate) {
      setSelectedDate(recent);
      setMonthDate(new Date(recent));
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

        const { data } = await client.graphql({
          query: LIST_CUSTOMERS_BY_USER,
          variables: { user_id },
        });
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

  const ensureSessionDetails = useCallback(
    async (session_id) => {
      if (!session_id) return;
      try {
        setSessionLoadingMap((prev) => ({ ...prev, [session_id]: true }));
        const { data: itemData } = await client.graphql({
          query: listSessionItemsBySession,
          variables: { session_id, limit: 50 },
        });
        const items = asList(itemData?.listSessionItemsBySession);
        console.log('Session items fetch', { session_id, count: items.length, raw: itemData });

        // Pull sets across indexes to ensure we display sets even if session items are missing.
        const setsByIndex = {};
        let setMisses = 0;
        for (let idx = 1; idx <= MAX_SESSION_ITEM_INDEX && setMisses < 3; idx += 1) {
          try {
            const { data } = await client.graphql({
              query: listSessionItemSetsQuery,
              variables: { session_id, session_item_index: idx, limit: 50 },
            });
            const found = asList(data?.listSessionItemSets);
            if (found.length) {
              setsByIndex[idx] = found;
              setMisses = 0;
            } else {
              setMisses += 1;
            }
          } catch (err) {
            console.log('Fetch sets failed', err);
            setMisses += 1;
          }
        }

        const allReps = [];
        let nextToken;
        do {
          const {data} = await client.graphql({query:listSessionItemRepsQuery, variables:{session_id,limit:500,nextToken}});
          allReps.push(...asList(data?.listSessionItemReps));
          nextToken=data?.listSessionItemReps?.nextToken;
        } while(nextToken);
        const detailedItems = await Promise.all(
          items.map(async (item) => {
            const sets = setsByIndex[item.session_item_index] || [];
            const reps = allReps.filter(rep => Number(rep.session_item_index) === Number(item.session_item_index));
            return { ...item, sets, reps };
          })
        );
        setSessionDetailsMap((prev) => ({ ...prev, [session_id]: detailedItems }));
      } catch (err) {
        console.log('Fetch session details failed', err);
        setError(err?.errors?.[0]?.message || 'Failed to load session data.');
      } finally {
        setSessionLoadingMap((prev) => ({ ...prev, [session_id]: false }));
      }
    },
    [asList, client, sessionDetailsMap]
  );

  const fetchRepsForItem = useCallback(
    async (session_id, session_item_index) => {
      if (!session_id || !session_item_index) return;
      const key = `${session_id}::${session_item_index}`;
      try {
        setRepsLoadingByItem((prev) => ({ ...prev, [key]: true }));
        const { data } = await client.graphql({
          query: listSessionItemRepsQuery,
          variables: { session_id, limit: 500 },
        });
        const allReps = asList(data?.listSessionItemReps);
        const filtered = allReps.filter((rep) => rep?.session_item_index === session_item_index);
        setRepsByItem((prev) => ({ ...prev, [key]: filtered }));
      } catch (err) {
        console.log('Fetch reps failed', err);
      } finally {
        setRepsLoadingByItem((prev) => ({ ...prev, [key]: false }));
      }
    },
    [asList, client]
  );

  const toggleItem = useCallback(
    (session_id, session_item_index) => {
      const key = `${session_id}::${session_item_index}`;
      setOpenItems((prev) => {
        const next = { ...prev };
        next[key] = !next[key];
        return next;
      });
      if (!repsByItem[key]) {
        fetchRepsForItem(session_id, session_item_index);
      }
    },
    [fetchRepsForItem, repsByItem]
  );

  const fetchExerciseIfMissing = useCallback(
    async (exercise_id) => {
      if (!exercise_id) return;
      if (exerciseMap[exercise_id]) return;
      if (exerciseFetchSet.has(exercise_id)) return;
      setExerciseFetchSet((prev) => new Set(prev).add(exercise_id));
      try {
        const { data } = await client.graphql({
          query: getExerciseQuery,
          variables: { exercise_id },
        });
        const ex = data?.getExercise;
        if (ex?.exercise_id) {
          setExerciseMap((prev) => ({ ...prev, [ex.exercise_id]: ex }));
        }
      } catch (err) {
        console.log('Fetch exercise failed', err);
      } finally {
        setExerciseFetchSet((prev) => {
          const next = new Set(prev);
          next.delete(exercise_id);
          return next;
        });
      }
    },
    [client, exerciseFetchSet, exerciseMap]
  );

  const buildRepBars = useCallback((rep) => {
    const toPct = (val, max) => clampPct(((Number(val) || 0) / max) * 100);
    return [
      { label: 'Score', percent: clampPct(Number(rep?.score) || 0), display: rep?.score ?? 'N/A' },
      { label: 'ROM', percent: toPct(rep?.rom, MAX_ROM), display: rep?.rom ?? 'N/A' },
      { label: 'TUT', percent: toPct(rep?.tut, MAX_TUT), display: rep?.tut ?? 'N/A' },
      { label: 'Vel', percent: toPct(rep?.velocity, MAX_VELOCITY), display: rep?.velocity ?? 'N/A' },
      { label: 'Mom', percent: toPct(rep?.momentum, MAX_MOMENTUM), display: rep?.momentum ?? 'N/A' },
    ];
  }, []);

  const toggleSession = async (session_id) => {
    if (expandedSessionId === session_id) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(session_id);
    await ensureSessionDetails(session_id);
  };

  const fetchSessionMomentum = useCallback(
    async (session_id) => {
      if (!session_id) return 0;
      try {
        const { data } = await client.graphql({
          query: listSessionItemRepsQuery,
          variables: { session_id, limit: 500 },
        });
        const reps = asList(data?.listSessionItemReps);
        return reps.reduce((sum, rep) => sum + (Number(rep?.momentum) || 0), 0);
      } catch (err) {
        console.log('Fetch session momentum failed', err);
        return 0;
      }
    },
    [asList, client]
  );

  const distributionRun = useRef(0);
  const buildBodyHighlight = useCallback(async () => {
    const run = ++distributionRun.current;
    try {
      const exMap = {...exerciseMap};
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      let targetSessions =
        selectedDate && sessions.length
          ? sessions.filter((s) => normalizeDate(s.workout_date || s.created_at) === selectedDate)
          : sessions.filter((s) => {
              const dateStr = normalizeDate(s.workout_date || s.created_at);
              return dateStr && dateStr.startsWith(monthPrefix);
            });
      if (!targetSessions.length) {
        setBodyData([]);
        setMuscleMomentumList([]);
        setTotalMomentumData(0);
        return;
      }

      const muscleTotals = {};
      let totalMomentum = 0;

      for (const sess of targetSessions) {
        const { data: itemsData } = await client.graphql({
          query: listSessionItemsBySession,
          variables: { session_id: sess.session_id, limit: 50 },
        });
        const items = asList(itemsData?.listSessionItemsBySession);

        const { data: repsData } = await client.graphql({
          query: listSessionItemRepsQuery,
          variables: { session_id: sess.session_id, limit: 500 },
        });
        const reps = asList(repsData?.listSessionItemReps);

        const setsByIndex = {};
        for (let idx = 1; idx <= MAX_SESSION_ITEM_INDEX; idx += 1) {
          try {
            const { data } = await client.graphql({
              query: listSessionItemSetsQuery,
              variables: { session_id: sess.session_id, session_item_index: idx, limit: 50 },
            });
            const found = asList(data?.listSessionItemSets);
            if (found.length) setsByIndex[idx] = found;
          } catch {
            // ignore
          }
        }

        for (const item of items) {
          if (item.exercise_id && !exMap[item.exercise_id]) {
            const {data} = await client.graphql({query:getExerciseQuery,variables:{exercise_id:item.exercise_id}});
            if (data?.getExercise) exMap[item.exercise_id]=data.getExercise;
          }
        }
        items.forEach((item) => {
          const itemReps = reps.filter((r) => r?.session_item_index === item.session_item_index);
          let momentum = itemReps.reduce((sum, r) => sum + (Number(r?.momentum) || 0), 0);
          if (!momentum) {
            const sets = setsByIndex[item.session_item_index] || [];
            momentum = sets.reduce((sum, s) => sum + (Number(s?.momentum) || 0), 0);
          }
          totalMomentum += momentum;
          const ex = exMap[item.exercise_id];
          const mg = Array.isArray(ex?.muscle_group) ? ex.muscle_group : [];
          let parsed = mg
            .map((entry) => {
              if (typeof entry !== 'string') return null;
              const parts = entry.split(':').map((p) => p.trim());
              if (parts.length < 2) return { name: entry.trim(), weight: null };
              const weight = parseFloat(parts[1]);
              return { name: parts[0], weight: Number.isFinite(weight) ? weight : null };
            })
            .filter(Boolean);
          let totalWeight = parsed.reduce((sum, p) => (p.weight !== null ? sum + p.weight : sum), 0);
          if ((!parsed.length || !totalWeight) && item.muscle_focus) {
            parsed = [{ name: item.muscle_focus, weight: 1 }];
            totalWeight = 1;
          }
          if (momentum > 0 && totalWeight > 0) {
            parsed.forEach((p) => {
              if (p.weight === null) return;
              const portion = (momentum * p.weight) / totalWeight;
              muscleTotals[p.name] = (muscleTotals[p.name] || 0) + portion;
            });
          }
        });
      }

      const muscleTotalsObj = {};
      Object.keys(muscleTotals).forEach((key) => {
        muscleTotalsObj[key] = { total: muscleTotals[key], muscleName: key };
      });

      const newBodyData = Object.keys(bodyParts)
        .map((part) => {
          const { muscleName, side } = bodyParts[part];
          const muscleInfo = muscleTotalsObj[muscleName];
          if (muscleInfo && muscleInfo.total > 0) {
            const percentage = totalMomentum ? ((muscleInfo.total / totalMomentum) * 100).toFixed(0) : 0;
            return {
              slug: part.toLowerCase(),
              intensity: percentage >= 60 ? 3 : percentage >= 30 ? 2 : 1,
              total: muscleInfo.total,
              name: muscleInfo.muscleName,
              side,
              percentage,
            };
          }
          return null;
        })
        .filter(Boolean);

      if (run !== distributionRun.current) return;
      setBodyData(newBodyData);
      setTotalMomentumData(Number(totalMomentum.toFixed(1)));
      const momentumList = Object.keys(muscleTotalsObj)
        .map((key) => {
          const total = muscleTotalsObj[key].total;
          const percent = totalMomentum ? ((total / totalMomentum) * 100).toFixed(1) : '0';
          return { name: key, total, percent };
        })
        .sort((a, b) => b.total - a.total);
      setMuscleMomentumList(momentumList);
    } catch (err) {
      if (run !== distributionRun.current) return;
      console.log('Body highlight build failed', err);
      setBodyData([]);
      setMuscleMomentumList([]);
      setTotalMomentumData(0);
    }
  }, [asList, client, exerciseMap, monthDate, normalizeDate, selectedDate, sessions]);
  useEffect(() => {
    let cancelled = false;
    const computeMomentum = async () => {
      if (!sessions.length) {
        if (!cancelled) {
          setSessionMomentumMap({});
          setMomentumByDate({});
        }
        return;
      }
      setSessionMomentumMap((prev) => {
        const missingSessions = sessions.filter((s) => s.session_id && prev[s.session_id] === undefined);
        if (!missingSessions.length) return prev;
        const newMomentumBySession = { ...prev };
        const run = async () => {
          for (const s of missingSessions) {
            const total = await fetchSessionMomentum(s.session_id);
            newMomentumBySession[s.session_id] = total;
          }
          if (cancelled) return;
          setSessionMomentumMap(newMomentumBySession);
        };
        run();
        return prev;
      });
    };
    computeMomentum();
    return () => {
      cancelled = true;
    };
  }, [sessions, fetchSessionMomentum]);

  useEffect(() => {
    buildBodyHighlight();
  }, [buildBodyHighlight]);

  useEffect(() => {
    const dateTotals = {};
    sessions.forEach((s) => {
      const dateStr = normalizeDate(s.workout_date || s.created_at);
      if (!dateStr) return;
      const total = sessionMomentumMap[s.session_id] || 0;
      dateTotals[dateStr] = (dateTotals[dateStr] || 0) + total;
    });
    setMomentumByDate(dateTotals);
  }, [sessions, sessionMomentumMap, normalizeDate]);

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
                name={exerciseMap[item.exercise_id]?.name || item.exercise_id || 'Exercise'}
                reps={item.reps || []} sets={item.sets || []} />)
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={brandTheme.style(styles.safe)}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.title)]}>Session History</Text>
        <View style={brandTheme.style(styles.calendarCard)}>
          <View style={brandTheme.style(styles.calendarHeader)}>
            <TouchableOpacity onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarNav)]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.calendarTitle)]}>
              {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
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
                const dayMomentum = momentumByDate[dateStr];
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
          <Text style={[styles.mapTitle,{color:brandTheme.colors.text}]}>Muscle breakdown</Text>
          <Text style={[styles.mapDate,{color:brandTheme.colors.muted,marginBottom:16}]}>{selectedDate || 'This month'}</Text>
          <MuscleBreakdown segments={muscleMomentumList} />
        </View>
        {loading ? <ActivityIndicator size="large" /> : null}
        {error ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.error)]}>{error}</Text> : null}
        {!loading && !sessions.length ? <Text style={[{color:brandTheme.colors.text}, brandTheme.style(styles.muted)]}>No sessions recorded yet.</Text> : null}
        {(selectedDate
          ? sessions.filter((s) => normalizeDate(s.workout_date || s.created_at) === selectedDate)
          : sessions
        ).map(renderSession)}
      </ScrollView>
    </View>
  );
}

const formatDate = (value) => {
  if (!value) return 'Unknown date';
  try {
    const date = new Date(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch {
    return value;
  }
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

