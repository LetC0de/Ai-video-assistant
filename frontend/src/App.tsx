import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatWithMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
} from './lib/api';
import { useAuth } from './lib/auth';
import type { ChatMessage, Meeting, MeetingSummary } from './lib/types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { MeetingModal } from './components/MeetingModal';
import { MeetingPicker } from './components/MeetingPicker';
import { AuthScreen } from './components/AuthScreen';
import { Landing } from './components/Landing';
import { LogoMark } from './components/Icons';
import './App.css';
import './components/Sidebar.css';
import './components/ChatArea.css';
import './components/MeetingModal.css';
import './components/MeetingPicker.css';
import './components/AuthScreen.css';
import './components/Landing.css';

type GuestView = 'landing' | 'login' | 'register';

export default function App() {
  const { user, isBooting, logout } = useAuth();
  const [guestView, setGuestView] = useState<GuestView>('landing');
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [meetingDetails, setMeetingDetails] = useState<Record<number, Meeting>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messagesByMeeting, setMessagesByMeeting] = useState<Record<number, ChatMessage[]>>({});
  const [composerValue, setComposerValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingSource, setMeetingSource] = useState<'url' | 'file'>('url');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 860 : false
  );
  const abortRef = useRef<AbortController | null>(null);

  const activeMeeting = selectedId !== null ? meetingDetails[selectedId] ?? null : null;
  const activeMessages = selectedId !== null ? messagesByMeeting[selectedId] ?? [] : [];

  // Track viewport width for mobile mode
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isMobile]);

  const refreshMeetings = useCallback(async () => {
    try {
      const list = await listMeetings();
      setMeetings(list);
      setLoadError('');
      return list;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load meetings.');
      return [];
    }
  }, []);

  useEffect(() => {
    if (isBooting || !user) return;
    void refreshMeetings();
  }, [refreshMeetings, isBooting, user]);

  // Any switch of the signed-in user clears the previous session's chat state.
  useEffect(() => {
    setGuestView('landing');
    setMessagesByMeeting({});
    setMeetingDetails({});
    setSelectedId(null);
    setComposerValue('');
    setIsThinking(false);
    setMeetingOpen(false);
    setLoadError('');
    abortRef.current?.abort();
    abortRef.current = null;
  }, [user?.id]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setComposerValue('');
    if (isMobile) setSidebarOpen(false);
    // Fetch the full record (summary + insights) the first time we open it.
    if (!meetingDetails[id]) {
      getMeeting(id)
        .then((m) => setMeetingDetails((prev) => ({ ...prev, [id]: m })))
        .catch(() => {});
    }
  };

  const handleNewMeeting = (source: 'url' | 'file' = 'url') => {
    setMeetingSource(source);
    setMeetingOpen(true);
    if (isMobile) setSidebarOpen(false);
  };

  const handleProcessed = async (meetingId: number) => {
    setMeetingOpen(false);
    const list = await refreshMeetings();
    const created = list.find((m) => m.id === meetingId);
    if (created) {
      setSelectedId(created.id);
      setMessagesByMeeting((prev) => ({ ...prev, [created.id]: [] }));
      // The newly created row only has summary fields; fetch the full record
      // (with the written summary/insights) so the panel can render.
      getMeeting(meetingId)
        .then((m) => setMeetingDetails((prev) => ({ ...prev, [meetingId]: m })))
        .catch(() => {});
    }
  };

  const handleDelete = async (id: number) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setMessagesByMeeting((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    try {
      await deleteMeeting(id);
      setMessagesByMeeting((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not delete meeting.');
      void refreshMeetings();
    }
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? composerValue).trim();
      if (!text || isThinking || !activeMeeting) return;

      const meetingId = activeMeeting.id;
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      };

      setMessagesByMeeting((prev) => ({
        ...prev,
        [meetingId]: [...(prev[meetingId] ?? []), userMsg, assistantMsg],
      }));
      setComposerValue('');
      setIsThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await chatWithMeeting(meetingId, { question: text }, controller.signal);
        setMessagesByMeeting((prev) => ({
          ...prev,
          [meetingId]: (prev[meetingId] ?? []).map((m) =>
            m.id === assistantMsg.id ? { ...m, content: res.answer } : m
          ),
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        const aborted = (e as Error)?.name === 'AbortError';
        setMessagesByMeeting((prev) => ({
          ...prev,
          [meetingId]: (prev[meetingId] ?? []).map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: aborted ? m.content : msg,
                  error: !aborted,
                }
              : m
          ),
        }));
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [composerValue, activeMeeting, isThinking]
  );

  const handleStop = () => {
    abortRef.current?.abort();
    setIsThinking(false);
    setMessagesByMeeting((prev) => {
      if (selectedId === null) return prev;
      return {
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.role === 'assistant' && m.content === '' ? { ...m, content: 'Stopped.' } : m
        ),
      };
    });
  };

  const handleRegenerate = useCallback(() => {
    const thread = activeMessages;
    const lastUser = [...thread].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessagesByMeeting((prev) => {
      if (selectedId === null) return prev;
      return { ...prev, [selectedId]: prev[selectedId].filter((m) => m.role === 'user') };
    });
    void handleSend(lastUser.content);
  }, [activeMessages, handleSend, selectedId]);

  const handleRetry = useCallback(
    (failedId: string) => {
      if (selectedId === null) return;
      const thread = messagesByMeeting[selectedId] ?? [];
      const idx = thread.findIndex((m) => m.id === failedId);
      if (idx < 0) return;
      const question = [...thread.slice(0, idx)].reverse().find((m) => m.role === 'user');
      if (!question) return;
      setMessagesByMeeting((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).filter((m) => m.id !== failedId),
      }));
      void handleSend(question.content);
    },
    [messagesByMeeting, selectedId, handleSend]
  );

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  const openPicker = (anchor?: HTMLElement | null) => {
    const attachBtn = anchor ?? document.querySelector<HTMLElement>('.composer__attach');
    setPickerAnchor(attachBtn ?? null);
    setPickerOpen(true);
  };

  if (isBooting) {
    return (
      <div className="app app--boot">
        <div className="app-bg" aria-hidden="true">
          <div className="blob blob--violet" />
          <div className="blob blob--spark" />
          <div className="blob blob--indigo" />
          <div className="grain" />
        </div>
        <div className="boot">
          <span className="boot__mark"><LogoMark size={44} /></span>
          <span className="boot__bar"><span className="boot__bar-fill" /></span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (guestView === 'landing') {
      return (
        <Landing
          onLogin={() => setGuestView('login')}
          onRegister={() => setGuestView('register')}
        />
      );
    }
    return (
      <AuthScreen initialMode={guestView} onBack={() => setGuestView('landing')} />
    );
  }

  return (
    <div className="app">
      <div className="app-bg" aria-hidden="true">
        <div className="blob blob--violet" />
        <div className="blob blob--spark" />
        <div className="blob blob--indigo" />
        <div className="grain" />
      </div>

      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay sidebar-overlay--visible"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        meetings={meetings}
        selectedId={selectedId}
        collapsed={!sidebarOpen}
        onSelect={handleSelect}
        onNewMeeting={() => handleNewMeeting('url')}
        onDelete={handleDelete}
        onClose={() => setSidebarOpen(false)}
        onExpand={() => setSidebarOpen(true)}
        isMobile={isMobile}
        user={user}
        onLogout={logout}
      />

      <ChatArea
        meeting={activeMeeting ?? undefined}
        messages={activeMessages}
        isThinking={isThinking}
        composerValue={composerValue}
        onComposerChange={setComposerValue}
        onSend={() => void handleSend()}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        onRetry={handleRetry}
        onNewMeeting={() => handleNewMeeting('url')}
        onUpload={() => handleNewMeeting('file')}
        activeMeetingChip={
          activeMeeting
            ? {
                title: activeMeeting.title,
                isYoutube: /youtube\.com|youtu\.be/i.test(activeMeeting.source ?? ''),
              }
            : undefined
        }
        onClearMeeting={() => setSelectedId(null)}
        onPickMeeting={(e) => openPicker(e?.currentTarget as HTMLElement | null)}
        isMobile={isMobile}
        onToggleSidebar={toggleSidebar}
      />

      {loadError && (
        <div className="toast toast--error">
          {loadError} — please try again.
        </div>
      )}

      <MeetingModal
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        onProcessed={handleProcessed}
        defaultSource={meetingSource}
      />

      <MeetingPicker
        open={pickerOpen}
        anchor={pickerAnchor}
        meetings={meetings}
        activeId={selectedId}
        onSelect={handleSelect}
        onUpload={() => handleNewMeeting('file')}
        onClose={() => setPickerOpen(false)}
        isMobile={isMobile}
      />
    </div>
  );
}
