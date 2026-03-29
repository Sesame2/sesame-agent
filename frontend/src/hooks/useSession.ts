import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'sesame_session_id';

export function useSession() {
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem(SESSION_KEY) || '';
  });

  const createOrSwitch = useCallback((id: string) => {
    if (id === '__new__') {
      const newId = uuidv4();
      localStorage.setItem(SESSION_KEY, newId);
      setSessionId(newId);
    } else {
      localStorage.setItem(SESSION_KEY, id);
      setSessionId(id);
    }
  }, []);

  // 如果没有 session，创建一个
  const activeId = sessionId || (() => {
    const newId = uuidv4();
    localStorage.setItem(SESSION_KEY, newId);
    setSessionId(newId);
    return newId;
  })();

  return { sessionId: activeId, createOrSwitch };
}
