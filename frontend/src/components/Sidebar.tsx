import { useEffect, useRef, useState } from 'react';
import type { Conversation, MeetingSummary, User } from '../lib/types';
import { meetingColor, formatDate, formatTime, initialsFromTitle, sourceLabel } from '../lib/palette';
import {
  LogoMark, NewChatIcon, TrashIcon, ChevronIcon, XIcon, LogoutIcon, UserIcon, PlayIcon, PencilIcon, ChatIcon,
} from './Icons';

interface SidebarProps {
  meetings: MeetingSummary[];
  selectedId: number | null;
  conversations: Conversation[];
  activeConversationId: number | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  collapsed: boolean;
  onSelect: (id: number) => void;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onDelete: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  onRenameConversation: (id: number, title: string) => Promise<void>;
  onClose: () => void;
  onExpand: () => void;
  isMobile: boolean;
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({
  meetings,
  selectedId,
  conversations,
  activeConversationId,
  loadingConversations,
  loadingMessages,
  collapsed,
  onSelect,
  onSelectConversation,
  onNewChat,
  onDelete,
  onDeleteConversation,
  onRenameConversation,
  onClose,
  onExpand,
  isMobile,
  user,
  onLogout,
}: SidebarProps) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  const handleDelete = async (m: MeetingSummary) => {
    if (confirmingId === m.id) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirmingId(null);
      setDeletingId(m.id);
      try {
        await onDelete(m.id);
      } finally {
        setDeletingId(null);
      }
    } else {
      setConfirmingId(m.id);
      confirmTimer.current = window.setTimeout(() => setConfirmingId(null), 3500);
    }
  };

  const [confirmConvoId, setConfirmConvoId] = useState<number | null>(null);
  const [deletingConvoId, setDeletingConvoId] = useState<number | null>(null);
  const convoTimer = useRef<number | null>(null);

  const handleDeleteConversation = async (convo: Conversation) => {
    if (confirmConvoId === convo.conversation_id) {
      if (convoTimer.current) window.clearTimeout(convoTimer.current);
      setConfirmConvoId(null);
      setDeletingConvoId(convo.conversation_id);
      try {
        await onDeleteConversation(convo.conversation_id);
      } finally {
        setDeletingConvoId(null);
      }
    } else {
      setConfirmConvoId(convo.conversation_id);
      convoTimer.current = window.setTimeout(() => setConfirmConvoId(null), 3500);
    }
  };

  // Inline rename: one conversation is in "editing" mode at a time. The title is
  // committed via PATCH /conversations/{id} on Enter / blur, and cancelled on Esc.
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const startRename = (convo: Conversation) => {
    setRenamingId(convo.conversation_id);
    setRenameValue(convo.title);
    setConfirmConvoId(null);
    requestAnimationFrame(() => renameInputRef.current?.select());
  };

  const commitRename = async (id: number) => {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    const target = conversations.find((c) => c.conversation_id === id);
    setRenamingId(null);
    // Skip the round-trip if nothing actually changed.
    if (target && target.title === title) return;
    try {
      await onRenameConversation(id, title);
    } catch {
      /* keep the local title; the failure toast is surfaced by App */
    }
  };

  useEffect(() => () => {
    if (convoTimer.current) window.clearTimeout(convoTimer.current);
  }, []);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <button className="brand" onClick={onNewChat} aria-label="Vidora AI home">
          <span className="brand__mark"><LogoMark size={30} /></span>
          <span className="brand__text">
            <span className="brand__name">Vidora AI</span>
            <span className="brand__tag">chat with any video</span>
          </span>
        </button>

        {isMobile && (
          <button className="sidebar__close" onClick={onClose} aria-label="Close sidebar">
            <XIcon size={20} />
          </button>
        )}

        {!isMobile && !collapsed && (
          <button className="sidebar__collapse" onClick={onClose} aria-label="Collapse sidebar" title="Collapse sidebar">
            <XIcon size={18} />
          </button>
        )}
      </div>

      {!isMobile && collapsed && (
        <div className="sidebar__rail">
          <button className="sidebar__rail-btn sidebar__rail-btn--chat" onClick={onNewChat} aria-label="New chat" title="New chat">
            <NewChatIcon size={18} />
          </button>
          <button className="sidebar__rail-btn sidebar__rail-btn--docs" onClick={onExpand} aria-label="Documents" title="Documents">
            <PlayIcon size={18} />
          </button>
          <div className="sidebar__rail-spacer" />
          <button className="sidebar__rail-btn sidebar__rail-btn--user" onClick={onExpand} aria-label="Account" title="Account">
            <UserIcon size={18} />
          </button>
          <button className="sidebar__rail-btn sidebar__rail-btn--expand" onClick={onExpand} aria-label="Expand sidebar" title="Expand sidebar">
            <ChevronIcon />
          </button>
        </div>
      )}

      <div className="sidebar__body">
        <button className="new-chat" onClick={onNewChat}>
          <NewChatIcon size={17} />
          <span>New chat</span>
        </button>

        <div className="sidebar__section sidebar__section--scroll">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">Documents</span>
            <span className="sidebar__count">{meetings.length}</span>
          </div>

          <div className="doc-list">
            {meetings.length === 0 && (
              <div className="doc-list__empty">
                <p>No documents yet.</p>
                <p>Add a YouTube link or upload a recording to start.</p>
              </div>
            )}

            {meetings.map((m) => {
              const color = meetingColor(m.id);
              const active = m.id === selectedId;
              const isConfirming = confirmingId === m.id;
              const isDeleting = deletingId === m.id;
              return (
                <div key={m.id} className={`meeting-item ${active ? 'meeting-item--active' : ''}`}>
                  <button className="meeting-item__main" onClick={() => onSelect(m.id)}>
                    <span
                      className="meeting-item__avatar"
                      style={{ background: color.soft, color: color.ink }}
                    >
                      {initialsFromTitle(m.title)}
                    </span>
                    <span className="meeting-item__meta">
                      <span className="meeting-item__name">{m.title}</span>
                      <span className="meeting-item__sub">
                        <span className="meeting-item__source">
                          {m.source && /youtube\.com|youtu\.be/i.test(m.source) ? 'YouTube' : sourceLabel(m.source || '')}
                        </span>
                        <span className="meeting-item__sep">·</span>
                        {formatDate(m.created_at)}
                      </span>
                    </span>
                  </button>

                  <button
                    className={`meeting-item__del ${isConfirming ? 'meeting-item__del--confirm' : ''} ${isDeleting ? 'meeting-item__del--busy' : ''}`}
                    onClick={() => handleDelete(m)}
                    disabled={isDeleting}
                    title={isConfirming ? 'Click again to confirm' : 'Delete document'}
                    aria-label={`Delete ${m.title}`}
                  >
                    <TrashIcon size={14} />
                    {isConfirming && <span className="doc-item__confirm">Sure?</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidebar__section sidebar__section--scroll">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">Conversations</span>
            <span className="sidebar__count">{conversations.length}</span>
          </div>

          <div className="convo-list">
            {loadingConversations && (
              <div className="convo-list__loading">Loading conversations…</div>
            )}

            {!loadingConversations && conversations.length === 0 && (
              <div className="doc-list__empty">
                <p>No chats yet.</p>
                <p>Start a new chat to begin a conversation.</p>
              </div>
            )}

            {conversations.map((convo) => {
              const active = convo.conversation_id === activeConversationId;
              const isConfirming = confirmConvoId === convo.conversation_id;
              const isDeleting = deletingConvoId === convo.conversation_id;
              const isRenaming = renamingId === convo.conversation_id;
              return (
                <div
                  key={convo.conversation_id}
                  className={`convo-item ${active ? 'convo-item--active' : ''} ${isRenaming ? 'convo-item--renaming' : ''}`}
                >
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      className="convo-item__rename"
                      value={renameValue}
                      maxLength={200}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(convo.conversation_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(convo.conversation_id);
                        else if (e.key === 'Escape') setRenamingId(null);
                      }}
                      aria-label="Rename conversation"
                    />
                  ) : (
                    <button
                      className="convo-item__main"
                      onClick={() => onSelectConversation(convo.conversation_id)}
                      title={convo.title}
                    >
                      <span className="convo-item__icon">
                        <ChatIcon size={15} />
                      </span>
                      <span className="convo-item__meta">
                        <span className="convo-item__name">{convo.title}</span>
                        <span className="convo-item__sub">{formatTime(convo.updated_at)}</span>
                      </span>
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      className="convo-item__rename-btn"
                      onClick={() => startRename(convo)}
                      title="Rename conversation"
                      aria-label={`Rename ${convo.title}`}
                    >
                      <PencilIcon size={13} />
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      className={`convo-item__del ${isConfirming ? 'convo-item__del--confirm' : ''} ${isDeleting ? 'convo-item__del--busy' : ''}`}
                      onClick={() => handleDeleteConversation(convo)}
                      disabled={isDeleting}
                      title={isConfirming ? 'Click again to confirm' : 'Delete conversation'}
                      aria-label={`Delete ${convo.title}`}
                    >
                      <TrashIcon size={14} />
                      {isConfirming && <span className="doc-item__confirm">Sure?</span>}
                    </button>
                  )}
                  {active && loadingMessages && !isRenaming && (
                    <span className="convo-item__spinner" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sidebar__foot">
        {user && (
          <div className="sidebar__account">
            <button className="account-btn" aria-label="Account menu" title={user.username}>
              <span className="account-btn__avatar">
                {initialsFromTitle(user.name || user.username)}
              </span>
              <span className="account-btn__meta">
                <span className="account-btn__name">{user.name || user.username}</span>
                <span className="account-btn__sub">@{user.username}</span>
              </span>
              <span className="account-btn__role"><UserIcon size={14} /></span>
            </button>
            <button className="account-logout" onClick={onLogout} aria-label="Sign out" title="Sign out">
              <LogoutIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
