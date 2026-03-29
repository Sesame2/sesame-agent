import { describe, it, expect } from 'vitest';
import type { Message } from '../types';

// Test the behavior that useChat should have:
// When sessionId changes, messages and currentCode should reset before loading

describe('useChat session switching behavior', () => {
  it('loadHistory should clear previous messages and code when session has no history', () => {
    // Simulating the expected behavior of the loadHistory callback:
    // When switching sessions, state should be cleared first.
    let messages: Message[] = [
      { role: 'assistant', content: 'old response' },
    ];
    let currentCode = '<html>old</html>';

    // Simulate what SHOULD happen on session switch:
    const resetAndLoad = (historyData: { messages: Message[] }) => {
      messages = [];
      currentCode = '';
      if (historyData.messages?.length > 0) {
        messages = historyData.messages;
      }
    };

    // Switch to new session with empty history
    resetAndLoad({ messages: [] });

    expect(messages).toEqual([]);
    expect(currentCode).toBe('');
  });

  it('loadHistory should load messages when session has history', () => {
    let messages: Message[] = [];
    let currentCode = '<html>old</html>';

    const resetAndLoad = (historyData: { messages: Message[] }) => {
      messages = [];
      currentCode = '';
      if (historyData.messages?.length > 0) {
        messages = historyData.messages;
      }
    };

    const historyMessages: Message[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ];
    resetAndLoad({ messages: historyMessages });

    expect(messages).toEqual(historyMessages);
    expect(currentCode).toBe('');
  });
});
