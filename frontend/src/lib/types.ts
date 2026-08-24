// Shared API types mirroring the FastAPI backend (meetings system).

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role?: string;
}

export interface RegisterInput {
  name: string;
  username: string;
  password: string;
  email: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

// Lightweight row for the "My Meetings" list.
export interface MeetingSummary {
  id: number;
  title: string;
  source: string;
  created_at: string;
}

// Full stored meeting, returned by GET /meetings/{id}.
export interface Meeting {
  id: number;
  title: string;
  source: string;
  summary: string;
  action_items: string;
  key_decisions: string;
  open_questions: string;
  created_at: string;
}

export interface ProcessMeetingInput {
  url?: string;
  file?: File;
  language?: string;
}

// A chat session owned by the user (Blueprint-style persistent history).
export interface Conversation {
  conversation_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  meetingId?: number | null;
  concierge?: boolean;
  streaming?: boolean;
  error?: boolean;
}
