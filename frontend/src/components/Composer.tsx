import { useEffect, useRef, useState } from 'react';
import { SendIcon, StopIcon } from './Icons';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
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

  const placeholder = PLACEHOLDER_PHRASES[phraseIndex];

  const submit = () => {
    if (!canSend) return;
    onSubmit();
  };

  return (
    <div className={`composer ${focused ? 'composer--focused' : ''} ${disabled ? 'composer--disabled' : ''}`}>
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
        {!isBusy && value.trim().length === 0 && (
          <span className={`composer__phrases ${fading ? 'composer__phrases--fade' : ''}`} aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>

      <div className="composer__bar">
        <span className="composer__hint">Vidya answers from this meeting</span>
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
