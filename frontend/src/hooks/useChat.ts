import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types';
import { extractCodeFromMarkdown } from '../utils/codeExtractor';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 加载历史
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history/${sessionId}`);
      const data = await res.json();
      if (data.messages?.length > 0) {
        setMessages(data.messages);
        const lastAssistant = [...data.messages].reverse().find((m: Message) => m.role === 'assistant');
        if (lastAssistant) {
          const code = lastAssistant.code_snippet || extractCodeFromMarkdown(lastAssistant.content);
          if (code) setCurrentCode(code);
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }, [sessionId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const sendMessage = useCallback(async (userInput: string) => {
    if (isLoading || !userInput.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    setIsLoading(true);

    // 占位 assistant 消息
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userInput }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // 保留不完整的最后一行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          if (data.startsWith('[ERROR]')) { fullContent += `\n\n⚠️ ${data}`; break; }
          fullContent += data;
        }

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullContent, isStreaming: true };
          return updated;
        });

        const code = extractCodeFromMarkdown(fullContent);
        if (code) setCurrentCode(code);
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: fullContent, isStreaming: false };
        return updated;
      });

    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: '⚠️ 请求失败，请检查后端连接。', isStreaming: false };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); }, []);

  return { messages, currentCode, isLoading, sendMessage, stopStreaming };
}
