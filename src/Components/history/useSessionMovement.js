import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSessionReps } from './sessionHistoryData';

export default function useSessionMovement(client, sessions) {
  const [state, setState] = useState({ records: {}, errors: {}, loading: true });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(sessions.map(session => [session.session_id, session.updated_at]));
  useEffect(() => {
    let active = true;
    setState({ records: {}, errors: {}, loading: !!sessions.length });
    (async () => {
      const records = {}, errors = {};
      // Bound concurrent requests; a single denied session does not masquerade as zero reps.
      for (let offset = 0; offset < sessions.length; offset += 3) {
        await Promise.all(sessions.slice(offset, offset + 3).map(async session => {
          try { records[session.session_id] = await loadSessionReps(client, session.session_id); }
          catch { errors[session.session_id] = true; }
        }));
        if (!active) return;
      }
      if (active) setState({ records, errors, loading: false });
    })();
    return () => { active = false; };
  }, [client, key, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
