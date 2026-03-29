import { useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';
import { getUser, clearUser } from '../hooks/useUserContext';
import { clearSession } from '../hooks/useSession';

export function TopBar() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearToken();
    clearUser();
    clearSession();
    navigate('/login');
  };

  const initial = user?.username?.charAt(0).toUpperCase() || '?';

  return (
    <header className="h-12 border-b border-gray-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">✨ Sesame Agent</span>
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user.username}</span>
          <button
            onClick={handleLogout}
            className="h-7 px-3 flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-medium transition-colors"
            title="退出登录"
          >
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {initial}
            </span>
            <span>退出</span>
          </button>
        </div>
      )}
    </header>
  );
}
