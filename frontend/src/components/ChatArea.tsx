import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Meeting } from '../lib/types';
import { ChatMessageView, TypingDots } from './ChatMessage';
import { Composer } from './Composer';
import { Markdown } from '../lib/markdown';
import { LogoMark, MenuIcon, SparkIcon, PlayIcon, UploadIcon, ChevronIcon } from './Icons';

interface ChatAreaProps {
  meeting?: Meeting;
  messages: ChatMessage[];
  activeConversationTitle?: string;
  isThinking: boolean;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: () => void;
  onRetry: (messageId: string) => void;
  onNewMeeting: () => void;
  onUpload: () => void;
  activeMeetingChip?: { title: string; isYoutube: boolean };
  onClearMeeting: () => void;
  onPickMeeting: (e?: React.MouseEvent) => void;
  isMobile: boolean;
  onToggleSidebar: () => void;
}

const SUGGESTIONS = [
  { icon: '✨', text: 'Give me a quick summary of this meeting.' },
  { icon: '✔', text: 'What are the action items and who owns them?' },
  { icon: '💡', text: 'List the key decisions made.' },
  { icon: '❓', text: 'What open questions are still unanswered?' },
];

// Concierge prompts shown when no meeting is selected (no conversation is tied
// to a transcript). These introduce the product and guide the user toward
// adding a meeting instead of assuming a transcript is already in context.
const CONCIERGE_SUGGESTIONS = [
  { icon: '✨', text: 'What is Vidora AI and what does it do?' },
  { icon: '📥', text: 'How do I add a YouTube link or upload a recording?' },
  { icon: '💬', text: 'What can I ask about a meeting once it is added?' },
  { icon: '🚀', text: 'Help me get started.' },
];

export function ChatArea({
  meeting,
  messages,
  activeConversationTitle,
  isThinking,
  composerValue,
  onComposerChange,
  onSend,
  onStop,
  onRegenerate,
  onRetry,
  onNewMeeting,
  onUpload,
  activeMeetingChip,
  onClearMeeting,
  onPickMeeting,
  isMobile,
  onToggleSidebar,
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const hasChat = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  // Reset the summary panel each time a different meeting opens.
  useEffect(() => {
    setSummaryOpen(true);
  }, [meeting?.id]);

  return (
    <main className="chat">
      {isMobile && (
        <div className="chat__mobile-header">
          <button className="chat__hamburger" onClick={onToggleSidebar} aria-label="Open sidebar">
            <MenuIcon size={22} />
          </button>

          <div className="chat__mobile-brand">
            <span className="chat__mobile-logo"><LogoMark size={22} /></span>
            <span className="chat__mobile-title">
              {activeConversationTitle ? (
                activeConversationTitle
              ) : meeting ? (
                meeting.title
              ) : (
                <>Vidora AI</>
              )}
            </span>
            {meeting && (
              <span className="chat__mobile-sub">
                {meeting.source && /youtube\.com|youtu\.be/i.test(meeting.source) ? 'YouTube' : 'Uploaded'}
              </span>
            )}
          </div>
        </div>
      )}

      {hasChat ? (
        <div className="chat__thread" ref={scrollRef}>
          <div className="chat__thread-inner">
            {meeting?.summary && (
              <SummaryPanel
                meeting={meeting}
                open={summaryOpen}
                onToggle={() => setSummaryOpen((v) => !v)}
              />
            )}
            {/* Meeting selected but no messages yet: show the empty state + prompts. */}
            {meeting && !hasChat && (
              <div className="chat__empty">
                <p className="chat__empty-title">Ask anything about this meeting</p>
                <p className="chat__empty-sub">Questions are answered from what was actually said.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessageView
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                onCopy={(content) => navigator.clipboard?.writeText(content)}
                onRegenerate={onRegenerate}
                onRetry={() => onRetry(m.id)}
                onStreamingDone={() => {}}
              />
            ))}
            {isThinking && (
              <div className="msg msg--assistant msg--thinking">
                <div className="msg__meta">
                  <span className="msg__avatar msg__avatar--ai"><SparkIcon size={15} /></span>
                  <span className="msg__author">Vidora AI</span>
                </div>
                <div className="msg__body">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      ) : (
        <div className="chat__welcome">
          <div className="welcome__inner">
            <div className="welcome__mark"><LogoMark size={46} /></div>
            <h1 className="welcome__title">
              {activeConversationTitle ? (
                <>{activeConversationTitle}</>
              ) : meeting ? (
                <>Ask anything about <em>"{meeting.title}"</em></>
              ) : (
                <>Turn any video into a <em>conversation</em></>
              )}
            </h1>
            <p className="welcome__sub">
              {meeting
                ? 'Questions are answered from what was actually said.'
                : 'Add a YouTube link or upload a recording. Vidora AI transcribes it, writes a summary, and answers your questions in plain language.'}
            </p>
            <div className="welcome__cta-row">
              <button className="welcome__upload" onClick={onNewMeeting}>
                <PlayIcon size={18} />
                Add a meeting
              </button>
              <button className="welcome__upload welcome__upload--ghost" onClick={onUpload}>
                <UploadIcon size={18} />
                Upload file
              </button>
            </div>
            <div className="welcome__suggestions">
              {(meeting ? SUGGESTIONS : CONCIERGE_SUGGESTIONS).map((s, i) => (
                <button
                  key={i}
                  className="suggestion"
                  onClick={() => {
                    onComposerChange(s.text);
                    onSend();
                  }}
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <span className="suggestion__icon">{s.icon}</span>
                  <span className="suggestion__text">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="chat__composer-wrap">
        <Composer
          value={composerValue}
          onChange={onComposerChange}
          onSubmit={onSend}
          onStop={onStop}
          isBusy={isThinking}
          activeMeeting={activeMeetingChip}
          onClearMeeting={onClearMeeting}
          onPickMeeting={onPickMeeting}
        />
        <p className="chat__footnote">
          {meeting
            ? 'Vidora AI answers from this meeting — grounded in the transcript.'
            : 'Ask Vidora AI anything — or add a meeting to chat about its content.'}
        </p>
      </div>
    </main>
  );
}

// Backend stores insights as Text (often a JSON list serialized to a string).
// The LLM emits each insight as a numbered/markdown block where ONE logical
// item can span several lines (e.g. an action item with Owner + Deadline).
// Group by item boundary so a multi-line item stays intact instead of being
// shredded into one bullet per line.
function groupItems(value: string | string[] | undefined): string[] {
  if (!value) return [];
  let text: string;
  if (Array.isArray(value)) {
    text = value.map((v) => String(v).trim()).filter(Boolean).join('\n');
  } else {
    text = value.trim();
  }
  if (!text) return [];
  // If it looks like a JSON list, parse it and recurse.
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return groupItems(parsed);
    } catch {
      /* fall through to text parsing */
    }
  }
  const ITEM = /^\s*(?:\d+[.)]|[-*•])\s+/;
  const items: string[] = [];
  let cur: string[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (ITEM.test(raw)) {
      if (cur) items.push(cur.join('\n'));
      cur = [raw.replace(ITEM, '').trim()];
    } else if (cur && raw.trim()) {
      // Continuation line (Owner / Deadline / sub-detail) belongs to the item.
      cur.push(raw.trim());
    }
    // Blank lines between items are skipped.
  }
  if (cur) items.push(cur.join('\n'));
  return items.filter(Boolean);
}

function SummaryPanel({
  meeting,
  open,
  onToggle,
}: {
  meeting: Meeting;
  open: boolean;
  onToggle: () => void;
}) {
  const sections = [
    { label: 'Action items', items: groupItems(meeting.action_items) },
    { label: 'Key decisions', items: groupItems(meeting.key_decisions) },
    { label: 'Open questions', items: groupItems(meeting.open_questions) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className={`summary ${open ? 'summary--open' : ''}`}>
      <button className="summary__head" onClick={onToggle} aria-expanded={open}>
        <span className="summary__title">
          <SparkIcon size={15} />
          Meeting summary
        </span>
        <span className="summary__chevron"><ChevronIcon size={16} /></span>
      </button>
      {open && (
        <div className="summary__body">
          {meeting.summary && (
            <div className="summary__lede">
              <Markdown text={meeting.summary} />
            </div>
          )}
          {sections.map((s) => (
            <div className="summary__section" key={s.label}>
              <p className="summary__section-label">{s.label}</p>
              <div className="summary__list">
                {s.items.map((item, i) => (
                  <div className="summary__item" key={i}>
                    <Markdown text={item} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Local import avoids a circular-feeling top import; markdown rendering for the
// summary panel only. Kept at the bottom so the component reads top-down.
