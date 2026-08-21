import { useEffect, useRef, useState } from 'react';
import type { MeetingSummary, User } from '../lib/types';
import { meetingColor, formatDate, initialsFromTitle, sourceLabel } from '../lib/palette';
import {
  LogoMark, PlusIcon, TrashIcon, ChevronIcon, XIcon, LogoutIcon, UserIcon, PlayIcon,
} from './Icons';

interface SidebarProps {
  meetings: MeetingSummary[];
  selectedId: number | null;
  collapsed: boolean;
  onSelect: (id: number) => void;
  onNewMeeting: () => void;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
  onExpand: () => void;
  isMobile: boolean;
  user: User | null;
  onLogout: () => void;
}

export function Sidebar({
  meetings,
  selectedId,
  collapsed,
  onSelect,
  onNewMeeting,
  onDelete,
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

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__head">
        <button className="brand" onClick={onClose} aria-label="Vidya home">
          <span className="brand__mark"><LogoMark size={30} /></span>
          <span className="brand__text">
            <span className="brand__name">Vidya</span>
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
          <button className="sidebar__rail-btn sidebar__rail-btn--chat" onClick={onNewMeeting} aria-label="New meeting" title="New meeting">
            <PlusIcon size={18} />
          </button>
          <button className="sidebar__rail-btn sidebar__rail-btn--docs" onClick={onExpand} aria-label="Meetings" title="Meetings">
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
        <button className="new-chat" onClick={onNewMeeting}>
          <PlusIcon size={17} />
          <span>New meeting</span>
        </button>

        <div className="sidebar__section sidebar__section--scroll">
          <div className="sidebar__section-head">
            <span className="sidebar__section-title">My meetings</span>
            <span className="sidebar__count">{meetings.length}</span>
          </div>

          <div className="doc-list">
            {meetings.length === 0 && (
              <div className="doc-list__empty">
                <p>No meetings yet.</p>
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
                    title={isConfirming ? 'Click again to confirm' : 'Delete meeting'}
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
