import { useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';
import { getUser, clearUser } from '../hooks/useUserContext';

export function TopBar() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearToken();
    clearUser();
    navigate('/login');
  };

  const initial = user?.username?.charAt(0).toUpperCase() || '?';

  return (
    <header className="h-12 border-b border-gray-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">✨ Sesame Agent</span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-xs text-gray-500">{user.username}</span>
            <button
              onClick={handleLogout}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold hover:shadow-md transition-shadow"
              title={`${user.username} — 点击退出登录`}
            >
              {initial}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
