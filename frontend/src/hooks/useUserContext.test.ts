import { describe, it, expect, beforeEach } from 'vitest';
import { getUser, setUser, clearUser } from '../hooks/useUserContext';

describe('useUserContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no user info stored', () => {
    expect(getUser()).toBeNull();
  });

  it('stores and retrieves user info', () => {
    setUser({ id: '123', username: 'alice' });
    const user = getUser();
    expect(user).toEqual({ id: '123', username: 'alice' });
  });

  it('clears user info on logout', () => {
    setUser({ id: '123', username: 'alice' });
    clearUser();
    expect(getUser()).toBeNull();
  });

  it('returns username for avatar display', () => {
    setUser({ id: '123', username: 'Bob' });
    const user = getUser();
    expect(user?.username).toBe('Bob');
  });
});
