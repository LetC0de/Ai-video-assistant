import type {
  ChatRequest,
  ChatResponse,
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
  if (input.file) {
    const form = new FormData();
    form.append('file', input.file);
    if (input.language) form.append('language', input.language);
    res = await fetch(`${BASE}/meetings/process`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
  } else {
    res = await fetch(`${BASE}/meetings/process`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ source: input.url ?? '', language: input.language ?? 'english' }),
    });
  }
  return handle<Meeting>(res);
}

export async function deleteMeeting(id: number): Promise<void> {
  const res = await fetch(`${BASE}/meetings/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<unknown>(res);
}

export async function chatWithMeeting(
  id: number,
  req: ChatRequest,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/meetings/${id}/chat`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(req),
    signal,
  });
  return handle<ChatResponse>(res);
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
