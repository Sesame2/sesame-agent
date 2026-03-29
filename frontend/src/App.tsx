import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { useSession } from './hooks/useSession';
import { useSessions } from './hooks/useSessions';
import { useChat } from './hooks/useChat';

function AppShell() {
  const { sessionId, createOrSwitch } = useSession();
  const { messages, currentCode, isLoading, sendMessage, stopStreaming } = useChat(sessionId);
  const { sessions, loading: sessionsLoading, createSession, deleteSession } = useSessions(sessionId, createOrSwitch);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sessions={sessions}
          currentId={sessionId}
          loading={sessionsLoading}
          onSwitch={createOrSwitch}
          onNew={() => createSession()}
          onDelete={deleteSession}
        />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[380px] flex-shrink-0 border-r border-gray-200 shadow-sm overflow-hidden">
            <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} onStop={stopStreaming} />
          </div>
          <div className="flex-1 overflow-hidden">
            <PreviewPanel code={currentCode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
