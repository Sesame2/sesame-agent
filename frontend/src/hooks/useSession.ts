import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'sesame_session_id';

// Pure utility functions for session localStorage (testable without React)
export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function useSession() {
  const [sessionId, setSessionIdState] = useState<string>(() => {
    return getSessionId() || '';
  });

  const createOrSwitch = useCallback((id: string) => {
    if (id === '__new__') {
      const newId = uuidv4();
      setSessionId(newId);
      setSessionIdState(newId);
    } else {
      setSessionId(id);
      setSessionIdState(id);
    }
  }, []);

  // 如果没有 session，创建一个
  const activeId = sessionId || (() => {
    const newId = uuidv4();
    setSessionId(newId);
    setSessionIdState(newId);
    return newId;
  })();

  return { sessionId: activeId, createOrSwitch };
}
