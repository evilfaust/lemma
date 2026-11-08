import { useEffect, useState } from 'react';
import { api } from '../../../shared/services/pocketbase';
import { assignmentNeedsAttention } from '../../../utils/assignmentAttention';

export default function useAssignmentAttention(refresh) {
  const [data, setData] = useState({ sessions: [], progress: null, loading: true });

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const sessions = await api.getDeadlineAssignments();
        const expired = sessions.filter((s) => assignmentNeedsAttention(s, null, Date.now()));
        const progress = await api.getAssignmentProgress(expired).catch(() => null);
        if (active) setData({ sessions, progress, loading: false });
      } catch {
        if (active) setData({ sessions: [], progress: null, loading: false, error: true });
      } finally {
        inFlight = false;
      }
    };
    const loadVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const interval = setInterval(loadVisible, 60000);
    document.addEventListener('visibilitychange', loadVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', loadVisible);
    };
  }, [refresh]);

  return data;
}
