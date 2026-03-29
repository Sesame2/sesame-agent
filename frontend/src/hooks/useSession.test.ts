import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId, setSessionId, clearSession } from '../hooks/useSession';

describe('useSession clearSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clearSession removes session_id from localStorage', () => {
    setSessionId('some-uuid');
    expect(getSessionId()).toBe('some-uuid');
    clearSession();
    expect(getSessionId()).toBeNull();
  });

  it('clearSession is safe when no session exists', () => {
    clearSession();
    expect(getSessionId()).toBeNull();
  });
});
