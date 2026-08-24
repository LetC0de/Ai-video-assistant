import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chatQuery,
  createConversation,
  deleteConversation,
  deleteMeeting,
  getConversationMessages,
  getMeeting,
  listConversations,
  listMeetings,
  renameConversation,
} from './lib/api';
import { useAuth } from './lib/auth';
import type { ChatMessage, Conversation, ConversationMessage, Meeting, MeetingSummary } from './lib/types';
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
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
  const activeConversationTitle =
    conversations.find((c) => c.conversation_id === activeConversationId)?.title;

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

  const refreshConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const list = await listConversations();
      setConversations(list);
      return list;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load conversations.');
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (isBooting || !user) return;
    void refreshMeetings();
    void refreshConversations();
  }, [refreshMeetings, refreshConversations, isBooting, user]);

  // Any switch of the signed-in user clears the previous session's chat state.
  useEffect(() => {
    setGuestView('landing');
    setMessages([]);
    setMeetingDetails({});
    setSelectedId(null);
    setConversations([]);
    setActiveConversationId(null);
    setComposerValue('');
    setIsThinking(false);
    setLoadingConversations(false);
    setLoadingMessages(false);
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

  // Load a conversation's message history from the backend. Aborts any in-flight
  // stream first so a stale callback from the previous chat can't paint into this
  // one. The returned messages are mapped into the UI's ChatMessage shape; the
  // source of truth stays server-side.
  const handleSelectConversation = useCallback(
    async (id: number) => {
      if (id === activeConversationId) {
        if (isMobile) setSidebarOpen(false);
        return;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      setIsThinking(false);

      setActiveConversationId(id);
      setMessages([]);
      setComposerValue('');
      setLoadingMessages(true);
      if (isMobile) setSidebarOpen(false);

      try {
        const history = await getConversationMessages(id);
        // Guard: if the user switched again while we were fetching, drop the
        // stale result so we never overwrite the newly selected conversation.
        setActiveConversationId((current) => {
          if (current === id) {
            setMessages(
              history.map((m: ConversationMessage, i) => ({
                id: `${id}-${i}`,
                role: m.role,
                content: m.content,
                meetingId: null,
                concierge: false,
              }))
            );
          }
          return current;
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not load this conversation.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeConversationId, isMobile]
  );

  const handleNewChat = () => {
    // Abort any active stream and reset to a fresh, empty chat. The conversation
    // thread is created lazily on the first send, so an empty "New chat" doesn't
    // leave a blank row in the sidebar.
    abortRef.current?.abort();
    abortRef.current = null;
    setIsThinking(false);
    setMessages([]);
    setSelectedId(null);
    setActiveConversationId(null);
    setComposerValue('');
    setPickerOpen(false);
    if (isMobile) setSidebarOpen(false);
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
      getMeeting(meetingId)
        .then((m) => setMeetingDetails((prev) => ({ ...prev, [meetingId]: m })))
        .catch(() => {});
    }
  };

  const handleDelete = async (id: number) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await deleteMeeting(id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not delete meeting.');
      void refreshMeetings();
    }
  };

  const handleDeleteConversation = async (id: number) => {
    // Abort a stream if the user deletes the active conversation mid-flight.
    if (id === activeConversationId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsThinking(false);
    }
    setConversations((prev) => prev.filter((c) => c.conversation_id !== id));
    try {
      await deleteConversation(id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not delete conversation.');
      void refreshConversations();
      return;
    }
    if (activeConversationId === id) {
      // Deleting the active chat drops the user into a fresh, empty "New Chat"
      // state rather than jumping to another conversation.
      abortRef.current?.abort();
      abortRef.current = null;
      setIsThinking(false);
      setActiveConversationId(null);
      setMessages([]);
      setSelectedId(null);
    }
  };

  const handleRenameConversation = async (id: number, title: string) => {
    // Optimistically update the sidebar so the rename feels instant, then persist.
    setConversations((prev) =>
      prev.map((c) => (c.conversation_id === id ? { ...c, title } : c))
    );
    try {
      const updated = await renameConversation(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.conversation_id === id ? { ...c, ...updated } : c))
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not rename conversation.');
      void refreshConversations();
    }
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? composerValue).trim();
      if (!text || isThinking) return;

      // Ensure a conversation thread exists for this chat session. Created lazily
      // — only on the first send after "New Chat" or login — so the backend can
      // checkpoint under a known conversation_id.
      let conversationId = activeConversationId;
      if (conversationId === null) {
        try {
          const convo = await createConversation();
          conversationId = convo.conversation_id;
          setActiveConversationId(conversationId);
          // Seed the sidebar entry immediately so the auto-generated title (emitted
          // in the `title` SSE event below) has a row to update.
          setConversations((prev) =>
            prev.some((c) => c.conversation_id === convo.conversation_id)
              ? prev
              : [{ ...convo }, ...prev]
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not start a new conversation.';
          setLoadError(msg);
          return;
        }
      }

      // No meeting selected → concierge mode (chat about Vidora AI itself).
      const meetingId: number | null = activeMeeting ? activeMeeting.id : null;
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        meetingId,
        concierge: meetingId === null,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        meetingId,
        concierge: meetingId === null,
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setComposerValue('');
      setIsThinking(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await chatQuery(
          conversationId,
          meetingId,
          text,
          {
            onDelta: (delta) =>
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m
                )
              ),
            onDone: () =>
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, streaming: false } : m
                )
              ),
            // Backend auto-generates a title from the first question and sends it
            // as a `title` SSE event. Persist it into the sidebar row.
            onTitle: (title) => {
              if (!title) return;
              setConversations((prev) =>
                prev.map((c) =>
                  c.conversation_id === conversationId ? { ...c, title } : c
                )
              );
            },
            onError: (message) =>
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, streaming: false, error: true, content: m.content || message }
                    : m
                )
              ),
          },
          controller.signal
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        const aborted = (e as Error)?.name === 'AbortError';
        if (!aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: msg, error: true, streaming: false }
                : m
            )
          );
        }
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [composerValue, activeMeeting, activeConversationId, isThinking]
  );

  const handleStop = () => {
    abortRef.current?.abort();
    setIsThinking(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === 'assistant' && m.content === ''
          ? { ...m, content: 'Stopped.', streaming: false }
          : m.streaming
            ? { ...m, streaming: false }
            : m
      )
    );
  };

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => m.role === 'user'));
    void handleSend(lastUser.content);
  }, [messages, handleSend]);

  const handleRetry = useCallback(
    (failedId: string) => {
      const idx = messages.findIndex((m) => m.id === failedId);
      if (idx < 0) return;
      const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
      if (!question) return;
      setMessages((prev) => prev.filter((m) => m.id !== failedId));
      void handleSend(question.content);
    },
    [messages, handleSend]
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
        conversations={conversations}
        activeConversationId={activeConversationId}
        loadingConversations={loadingConversations}
        loadingMessages={loadingMessages}
        collapsed={!sidebarOpen}
        onSelect={handleSelect}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onClose={() => setSidebarOpen(false)}
        onExpand={() => setSidebarOpen(true)}
        isMobile={isMobile}
        user={user}
        onLogout={logout}
      />

      <ChatArea
        meeting={activeMeeting ?? undefined}
        messages={messages}
        activeConversationTitle={activeConversationTitle}
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
