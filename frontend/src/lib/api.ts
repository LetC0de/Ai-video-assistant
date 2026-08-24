import type {
  Conversation,
  ConversationMessage,
  LoginInput,
  Meeting,
  MeetingSummary,
  ProcessMeetingInput,
  RegisterInput,
  User,
} from './types';

// FastAPI backend URL.
//  - Local dev: leave VITE_API_BASE_URL unset and the Vite dev proxy forwards
//    /api -> :8000 (see vite.config.ts), stripping the /api prefix.
//  - Production: set VITE_API_BASE_URL to the deployed backend URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';
const BASE = API_BASE || '/api';

/** Auth handler installed once by the AuthProvider; called when an API returns 401. */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

let token: string | null = null;
export function setAuthToken(t: string | null) {
  token = t;
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    onUnauthorized?.();
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* keep statusText */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------- Meetings ----------

export async function listMeetings(): Promise<MeetingSummary[]> {
  const res = await fetch(`${BASE}/meetings`, { headers: authHeaders() });
  return handle<MeetingSummary[]>(res);
}

export async function getMeeting(id: number): Promise<Meeting> {
  const res = await fetch(`${BASE}/meetings/${id}`, { headers: authHeaders() });
  return handle<Meeting>(res);
}

// Process a source (YouTube URL or uploaded file). The backend transcribes,
// summarizes, and stores a dedicated Qdrant collection, then returns the full
// meeting record. URLs go as JSON; files go as multipart/form-data.
export async function processMeeting(input: ProcessMeetingInput): Promise<Meeting> {
  let res: Response;
  // Backend's /meetings/process expects multipart/form-data (source + file are
  // Form/File params), so send URLs as form fields too — not JSON.
  const form = new FormData();
  if (input.file) {
    form.append('file', input.file);
  } else {
    form.append('source', input.url ?? '');
  }
  if (input.language) form.append('language', input.language);
  res = await fetch(`${BASE}/meetings/process`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  return handle<Meeting>(res);
}

export async function deleteMeeting(id: number): Promise<void> {
  const res = await fetch(`${BASE}/meetings/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<unknown>(res);
}

// Streaming chat against /chat/query (SSE). Requires a conversationId (the
// persistent session). With meetingId set, retrieves from that meeting's
// transcript; with meetingId null, answers in concierge mode.
export async function chatQuery(
  conversationId: number,
  meetingId: number | null,
  question: string,
  handlers: {
    onDelta?: (delta: string) => void;
    onError?: (message: string) => void;
    onDone?: () => void;
    onTitle?: (title: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/chat/query`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ conversation_id: conversationId, meeting_id: meetingId, question }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep statusText */
    }
    handlers.onError?.(detail || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const evMatch = frame.match(/^event:\s*(.+)$/m);
      const dataMatch = frame.match(/^data:\s*(.+)$/m);
      if (!evMatch || !dataMatch) continue;
      const event = evMatch[1].trim();
      let data: any;
      try {
        data = JSON.parse(dataMatch[1].trim());
      } catch {
        continue;
      }
      if (event === 'token') handlers.onDelta?.(data.delta ?? '');
      else if (event === 'error') handlers.onError?.(data.message ?? 'Something went wrong.');
      else if (event === 'title') handlers.onTitle?.(data.title ?? '');
      else if (event === 'done') handlers.onDone?.();
    }
  }
}

// ---------- Conversations (persistent chat history) ----------

export async function createConversation(title = 'New Chat'): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations/`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  });
  return handle<Conversation>(res);
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations/`, { headers: authHeaders() });
  const data = await handle<{ conversations: Conversation[] }>(res);
  return data.conversations ?? [];
}

export async function getConversationMessages(id: number): Promise<ConversationMessage[]> {
  const res = await fetch(`${BASE}/conversations/${id}/messages`, { headers: authHeaders() });
  const data = await handle<{ conversation_id: number; messages: ConversationMessage[] }>(res);
  return data.messages ?? [];
}

export async function renameConversation(id: number, title: string): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  });
  return handle<Conversation>(res);
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<unknown>(res);
}

// ---------- Auth ----------

export async function login(input: LoginInput): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<{ token: string }>(res);
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const res = await fetch(`${BASE}/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<User>(res);
}

export async function me(): Promise<User> {
  const res = await fetch(`${BASE}/user/is_auth`, { headers: authHeaders() });
  return handle<User>(res);
}
