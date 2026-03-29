import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const SESSION_KEY = 'sesame_session_id';

export function useSession(): string {
  const [sessionId] = useState<string>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const newId = uuidv4();
    localStorage.setItem(SESSION_KEY, newId);
    return newId;
  });
  return sessionId;
}
