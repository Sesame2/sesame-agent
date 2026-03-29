import { ChatPanel } from './components/ChatPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { useSession } from './hooks/useSession';
import { useChat } from './hooks/useChat';

export default function App() {
  const sessionId = useSession();
  const { messages, currentCode, isLoading, sendMessage, stopStreaming } = useChat(sessionId);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-[380px] flex-shrink-0 border-r border-gray-200 shadow-sm overflow-hidden">
        <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} onStop={stopStreaming} />
      </div>
      <div className="flex-1 overflow-hidden">
        <PreviewPanel code={currentCode} />
      </div>
    </div>
  );
}
