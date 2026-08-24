import { useState } from 'react';
import type { ChatMessage } from '../lib/types';
import { Markdown } from '../lib/markdown';
import { CheckIcon, CopyIcon, RegenerateIcon, SparkIcon } from './Icons';

interface ChatMessageProps {
  message: ChatMessage;
  isLast: boolean;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  onRetry?: () => void;
  onStreamingDone?: () => void;
}

export function ChatMessageView({
  message,
  isLast,
  onCopy,
  onRegenerate,
  onRetry,
  onStreamingDone: _onStreamingDone,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const fullShown = !message.streaming;

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'} ${message.error ? 'msg--error' : ''}`}>
      <div className="msg__meta">
        <span className={`msg__avatar ${isUser ? 'msg__avatar--user' : 'msg__avatar--ai'}`}>
          {isUser ? 'You' : <SparkIcon size={15} />}
        </span>
        {!isUser && (
          <span className="msg__author">
            Vidora AI
            {message.concierge && <span className="msg__author-tag">Concierge</span>}
          </span>
        )}
      </div>

      <div className="msg__body">
        {isUser ? (
          <div className="msg__bubble">{message.content}</div>
        ) : (
          <div className="msg__answer">
            <Markdown text={message.content} />

            {message.streaming && !fullShown && (
              <span className="msg__caret" aria-hidden="true" />
            )}

            {message.error && (
              <div className="msg__error-note">Something went wrong while answering. Try again.</div>
            )}
          </div>
        )}
      </div>

      {!isUser && fullShown && !message.streaming && (
        <div className="msg__actions">
          {!message.error && (
            <button className="msg__action" onClick={handleCopy}>
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {message.error ? (
            onRetry && (
              <button className="msg__action msg__action--retry" onClick={onRetry}>
                <RegenerateIcon size={13} />
                Retry
              </button>
            )
          ) : (
            isLast && (
              <button className="msg__action" onClick={onRegenerate}>
                <RegenerateIcon size={13} />
                Regenerate
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function TypingDots({ color }: { color?: string }) {
  const style = color ? { background: color } : undefined;
  return (
    <span className="typing-dots" aria-label="Thinking">
      <span style={style} /><span style={style} /><span style={style} />
    </span>
  );
}
