import { useState } from 'react';
import type { Session } from '../types';

interface Props {
  sessions: Session[];
  currentId: string;
  loading: boolean;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ sessions, currentId, loading, onSwitch, onNew, onDelete }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNew}
          className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="text-sm leading-none">+</span>
          新建会话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-2 text-xs text-gray-400">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400 text-center">暂无会话</div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              onClick={() => s.id !== currentId && onSwitch(s.id)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group flex items-center px-3 py-2 mx-1 rounded-lg cursor-pointer text-xs transition-colors ${
                s.id === currentId
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="truncate flex-1">{s.title}</span>
              {hoveredId === s.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  className="ml-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 p-0.5"
                  title="删除会话"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
