import { useState, useCallback, useEffect } from 'react';
import type { Session } from '../types';
import { listSessions, deleteSession as apiDeleteSession, createSession as apiCreateSession } from '../api/client';

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

  const createSession = useCallback(async () => {
    try {
      const newSession = await apiCreateSession();
      setSessions(prev => [newSession, ...prev]);
      onSwitch(newSession.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  }, [onSwitch]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await apiDeleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === currentSessionId) {
        // 删除当前会话时，创建新会话并切换
        try {
          const newSession = await apiCreateSession();
          setSessions(prev => [newSession, ...prev]);
          onSwitch(newSession.id);
        } catch (e) {
          console.error('Failed to create fallback session:', e);
          onSwitch('__new__');
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }, [currentSessionId, onSwitch]);

  return { sessions, loading, refresh, createSession, deleteSession };
}
