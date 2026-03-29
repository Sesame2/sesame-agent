import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../types';
import { listSessions, deleteSession as apiDeleteSession } from '../api/client';

export function useSessions(currentSessionId: string, onSwitch: (id: string) => void) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSessions();
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createSession = useCallback(() => {
    // 使用 useSession hook 会在切换时生成新的 ID
    // 这里只需触发 onSwitch
    onSwitch('__new__');
  }, [onSwitch]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await apiDeleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) {
        onSwitch('__new__');
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }, [currentSessionId, onSwitch]);

  return { sessions, loading, refresh, createSession, deleteSession };
}
