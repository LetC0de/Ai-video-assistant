import { useEffect, useRef, useState } from 'react';
import { SendIcon, StopIcon, XIcon, PlusIcon, LinkIcon, FileIcon } from './Icons';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  activeMeeting?: { title: string; isYoutube: boolean };
  onClearMeeting: () => void;
  onPickMeeting: (e?: React.MouseEvent) => void;
  disabled?: boolean;
}

// Rotating placeholder phrases shown one at a time inside the empty text box,
// each nudging a different kind of follow-up on the active meeting.
const PLACEHOLDER_PHRASES = [
  'Ask anything about this meeting…',
  'What were the key decisions?',
  'Summarize the action items.',
  'What open questions are still unanswered?',
  'What did the host say about the timeline?',
];

const ROTATE_MS = 3200;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  activeMeeting,
  onClearMeeting,
  onPickMeeting,
  disabled,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const canSend = value.trim().length > 0 && !isBusy && !disabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }, [value]);

  useEffect(() => {
    if (isBusy || value.trim().length > 0) return;
    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % PLACEHOLDER_PHRASES.length);
        setFading(false);
      }, 240);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isBusy, value]);

  const placeholder = activeMeeting
    ? 'Ask anything about this meeting…'
    : PLACEHOLDER_PHRASES[phraseIndex];

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return (
    <div className={`composer ${focused ? 'composer--focused' : ''} ${disabled ? 'composer--disabled' : ''}`}>
      {activeMeeting && (
        <div className="composer__doc">
          <span className="composer__doc-label">Asking about</span>
          <span className="doc-chip">
            <span className={`doc-chip__avatar ${activeMeeting.isYoutube ? 'doc-chip__avatar--yt' : 'doc-chip__avatar--file'}`}>
              {activeMeeting.isYoutube ? <LinkIcon size={14} /> : <FileIcon size={14} />}
            </span>
            <span className="doc-chip__name">{activeMeeting.title}</span>
            <button className="doc-chip__x" onClick={onClearMeeting} aria-label="Stop asking about this meeting">
              <XIcon size={13} />
            </button>
          </span>
        </div>
      )}

      <div className="composer__input-wrap">
        <textarea
          ref={ref}
          className="composer__input"
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
        {!activeMeeting && !isBusy && value.trim().length === 0 && (
          <span className={`composer__phrases ${fading ? 'composer__phrases--fade' : ''}`} aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>

      <div className="composer__bar">
        <button
          className="composer__attach"
          onClick={(e) => onPickMeeting(e)}
          disabled={disabled}
          aria-label="Choose a meeting"
          title={activeMeeting ? 'Change meeting' : 'Choose a meeting'}
        >
          <PlusIcon size={20} />
        </button>

        <span className="composer__hint">
          {activeMeeting ? 'Vidora AI answers from this meeting' : 'Add a meeting to start chatting'}
        </span>

        {isBusy ? (
          <button className="composer__send composer__send--stop" onClick={onStop} aria-label="Stop generating">
            <StopIcon size={15} />
          </button>
        ) : (
          <button
            className="composer__send"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
          >
            <SendIcon size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
