export interface Message {
  id?: number;
  session_id?: string;
  user_id?: string;
  role: 'user' | 'assistant';
  content: string;
  code_snippet?: string;
  created_at?: string;
  isStreaming?: boolean; // 前端流式状态，不存 DB
}

export interface HistoryResponse {
  messages: Message[];
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface User {
  id: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
}
