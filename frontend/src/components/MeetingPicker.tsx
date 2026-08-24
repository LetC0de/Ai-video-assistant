import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MeetingSummary } from '../lib/types';
import { LinkIcon, FileIcon, PlusIcon, XIcon, CheckIcon } from './Icons';

interface MeetingPickerProps {
  open: boolean;
  anchor?: HTMLElement | null;
  meetings: MeetingSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onUpload: () => void;
  onClose: () => void;
  isMobile: boolean;
}

const isYoutube = (source?: string) => /youtube\.com|youtu\.be/i.test(source ?? '');

export function MeetingPicker({
  open,
  anchor,
  meetings,
  activeId,
  onSelect,
  onUpload,
  onClose,
  isMobile,
}: MeetingPickerProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Measure the real picker size and place it relative to the anchor.
  // Runs after paint so the dimensions are accurate (no guessing).
  useLayoutEffect(() => {
    if (!open || isMobile || !ref.current) return;

    const el = ref.current;
    const PICKER_W = el.offsetWidth || 300;
    const PICKER_H = el.offsetHeight;
    const MARGIN = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // No anchor (e.g. opened from a suggestion): center the picker.
    if (!anchor) {
      setPos({
        left: Math.max(MARGIN, (vw - PICKER_W) / 2),
        top: Math.max(MARGIN, (vh - PICKER_H) / 2),
      });
      return;
    }

    const r = anchor.getBoundingClientRect();

    // Horizontal: align to the anchor's left edge, clamped to the viewport.
    let left = r.left;
    if (left + PICKER_W > vw - MARGIN) left = vw - PICKER_W - MARGIN;
    if (left < MARGIN) left = MARGIN;

    // Vertical: the + sits near the bottom of the screen, so prefer opening
    // above it. Fall back to below, then centered, when there isn't room.
    let top = r.top - PICKER_H - 8;
    if (top < MARGIN) {
      const below = r.bottom + 8;
      top = vh - MARGIN - PICKER_H >= below ? below : Math.max(MARGIN, (vh - PICKER_H) / 2);
    }

    setPos({ top, left });
  }, [open, anchor, isMobile, meetings]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ready = meetings;
  const style = isMobile ? {} : pos ? { top: pos.top, left: pos.left } : { opacity: 0 };

  const handleUpload = () => {
    onUpload();
    onClose();
  };

  return (
    <>
      {isMobile && (
        <button className="picker__backdrop" onClick={onClose} aria-label="Close menu" />
      )}

      <div className="picker" ref={ref} style={style} role="menu" aria-label="Choose a meeting">
        <div className="picker__head">
          <span className="picker__title">Ask about</span>
          <button className="picker__close" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>

        {/* Option 1 — add a new meeting */}
        <div className="picker__section">
          <button className="picker__upload-row" onClick={handleUpload}>
            <span className="picker__upload-ico"><PlusIcon size={17} /></span>
            <span className="picker__upload-meta">
              <span className="picker__upload-name">Add a meeting</span>
              <span className="picker__upload-sub">Paste a link or upload a file</span>
            </span>
          </button>
        </div>

        {/* Option 2 — already uploaded meetings */}
        <div className="picker__section">
          <div className="picker__subhead">
            <span className="picker__subhead-label">Your meetings</span>
            {ready.length > 0 && <span className="picker__count">{ready.length}</span>}
          </div>

          {ready.length === 0 ? (
            <div className="picker__empty">
              <p>No meetings yet. Add one to start chatting.</p>
            </div>
          ) : (
            <div className="picker__list">
              {ready.map((m) => {
                const youtube = isYoutube(m.source);
                const active = m.id === activeId;
                return (
                  <button
                    key={m.id}
                    className={`picker__item ${active ? 'picker__item--active' : ''}`}
                    onClick={() => { onSelect(m.id); onClose(); }}
                  >
                    <span className={`picker__avatar ${youtube ? 'picker__avatar--yt' : 'picker__avatar--file'}`}>
                      {youtube ? <LinkIcon size={16} /> : <FileIcon size={16} />}
                    </span>
                    <span className="picker__meta">
                      <span className="picker__name">{m.title}</span>
                      <span className="picker__sub">{youtube ? 'YouTube' : 'Uploaded'}</span>
                    </span>
                    {active && <span className="picker__check"><CheckIcon size={15} /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
