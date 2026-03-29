import { describe, it, expect, beforeEach } from 'vitest';
import { clearToken, setToken } from '../api/client';
import { clearUser, setUser, getUser } from '../hooks/useUserContext';
import { clearSession, setSessionId, getSessionId } from '../hooks/useSession';

// TopBar logout 组合逻辑的测试
// 验证 logout 时所有状态都被正确清理
describe('logout flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears all auth state (token, user, session)', () => {
    // 模拟已登录状态
    setToken('jwt-token-123');
    setUser({ id: 'user-1', username: 'alice' });
    setSessionId('session-abc');

    // 执行 logout（与 TopBar.handleLogout 一致）
    clearToken();
    clearUser();
    clearSession();

    // 验证所有状态已清除
    expect(localStorage.getItem('sesame_token')).toBeNull();
    expect(getUser()).toBeNull();
    expect(getSessionId()).toBeNull();
  });

  it('logout is safe even when not logged in', () => {
    // 没有 token/user/session，调用不崩溃
    clearToken();
    clearUser();
    clearSession();

    expect(localStorage.getItem('sesame_token')).toBeNull();
    expect(getUser()).toBeNull();
    expect(getSessionId()).toBeNull();
  });
});
