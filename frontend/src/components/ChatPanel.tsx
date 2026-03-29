import { useRef, useEffect, useState } from 'react';
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSend: (msg: string) => void;
  onStop: () => void;
}

const EXAMPLES = ['做一个番茄钟 ⏱️', '写一个计算器 🔢', '创建一个待办事项 ✅'];

export function ChatPanel({ messages, isLoading, onSend, onStop }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => { if (!input.trim() || isLoading) return; onSend(input.trim()); setInput(''); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="font-semibold text-gray-900 text-sm">✨ Sesame Agent</h1>
        <p className="text-xs text-gray-400 mt-0.5">描述你的想法，AI 为你生成应用</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
            <div className="text-4xl">🪄</div>
            <p className="text-sm font-medium">告诉我你想构建什么</p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => onSend(ex)}
                  className="text-xs text-left px-3 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg border border-gray-200 transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none rounded-xl border border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none px-3 py-2 text-sm text-gray-800 placeholder-gray-400 max-h-32 min-h-[40px]"
            placeholder="描述你想要的应用..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {isLoading ? (
            <button onClick={onStop}
              className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-colors flex-shrink-0">
              ■ 停止
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition-colors flex-shrink-0">
              发送 ↑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
