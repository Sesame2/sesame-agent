export interface Message {
  id?: number;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  code_snippet?: string;
  created_at?: string;
  isStreaming?: boolean; // 前端流式状态，不存 DB
}

export interface HistoryResponse {
  messages: Message[];
}
