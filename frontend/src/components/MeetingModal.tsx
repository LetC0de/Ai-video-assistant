import { useCallback, useEffect, useRef, useState } from 'react';
import { processMeeting } from '../lib/api';
import { UploadIcon, XIcon, LinkIcon, FileIcon, CheckIcon, PlayIcon } from './Icons';

interface MeetingModalProps {
  open: boolean;
  onClose: () => void;
  onProcessed: (meetingId: number) => void;
}

type Source = 'url' | 'file';
type Phase = 'idle' | 'processing' | 'done' | 'error';

export function MeetingModal({ open, onClose, onProcessed }: MeetingModalProps) {
  const [source, setSource] = useState<Source>('url');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setSource('url');
      setUrl('');
      setFileName('');
      setFile(null);
      setPhase('idle');
      setProgress(0);
      setError('');
      setDragOver(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'processing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const canSubmit =
    phase === 'idle' &&
    (source === 'url' ? url.trim().length > 0 : file !== null);

  const handleFile = (f: File) => {
    setFile(f);
    setFileName(f.name);
    setError('');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleProcess = useCallback(async () => {
    setPhase('processing');
    setError('');
    setProgress(8);
    // Gentle indeterminate progress while the backend transcribes + indexes.
    const tick = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 6 : p));
    }, 500);
    try {
      const meeting = await processMeeting(
        source === 'url'
          ? { url: url.trim() }
          : { file: file as File }
      );
      window.clearInterval(tick);
      setProgress(100);
      setPhase('done');
      timerRef.current = window.setTimeout(() => onProcessed(meeting.id), 850);
    } catch (e) {
      window.clearInterval(tick);
      setPhase('error');
      setError(e instanceof Error ? e.message : 'Could not process this source.');
    }
  }, [source, url, file, onProcessed]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={phase !== 'processing' ? onClose : undefined}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Add a meeting" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">Add a meeting</h2>
          {phase !== 'processing' && (
            <button className="modal__close" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <>
            <div className="meeting__tabs">
              <button
                className={`meeting__tab ${source === 'url' ? 'meeting__tab--active' : ''}`}
                onClick={() => setSource('url')}
                type="button"
              >
                <LinkIcon size={15} />
                YouTube link
              </button>
              <button
                className={`meeting__tab ${source === 'file' ? 'meeting__tab--active' : ''}`}
                onClick={() => setSource('file')}
                type="button"
              >
                <UploadIcon size={15} />
                Upload file
              </button>
            </div>

            {source === 'url' ? (
              <div className="meeting__url">
                <span className="meeting__url-icon"><LinkIcon size={16} /></span>
                <input
                  className="meeting__url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div
                className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${fileName ? 'dropzone--filled' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="dropzone__icon">
                  {fileName ? <FileIcon size={26} /> : <UploadIcon size={26} />}
                </div>
                {fileName ? (
                  <p className="dropzone__title">{fileName}</p>
                ) : (
                  <>
                    <p className="dropzone__title">Drop a video or audio file</p>
                    <p className="dropzone__sub">or <span className="dropzone__link">browse files</span></p>
                  </>
                )}
                <span className="dropzone__hint">MP4 · MP3 · WAV · M4A · up to 200 MB</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*,audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            <p className="meeting__note">
              <PlayIcon size={13} />
              Vidya transcribes the source, writes a summary, and makes it chat-ready.
            </p>

            <button className="modal__primary meeting__submit" onClick={handleProcess} disabled={!canSubmit}>
              Process {source === 'url' ? 'link' : 'file'}
            </button>
          </>
        )}

        {phase === 'processing' && (
          <div className="upload-status">
            <div className="upload-status__file">
              <span className="upload-status__icon">
                {source === 'url' ? <LinkIcon size={20} /> : <FileIcon size={20} />}
              </span>
              <span className="upload-status__name">
                {source === 'url' ? (url.length > 42 ? url.slice(0, 42) + '…' : url) : fileName}
              </span>
            </div>
            <div className="upload-status__bar">
              <div className="upload-status__fill" style={{ width: `${Math.max(progress, 6)}%` }} />
            </div>
            <p className="upload-status__text">
              {progress < 100 ? 'Transcribing & indexing…' : 'Finishing up…'}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="upload-status">
            <div className="upload-status__done">
              <span className="upload-status__check"><CheckIcon size={22} /></span>
              <p className="upload-status__done-title">Meeting ready</p>
              <p className="upload-status__done-sub">Your summary is written and ready to chat.</p>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="upload-status upload-status--error">
            <div className="upload-status__done">
              <span className="upload-status__check upload-status__check--error">
                <XIcon size={20} />
              </span>
              <p className="upload-status__done-title">Couldn’t process</p>
              <p className="upload-status__done-sub">{error}</p>
            </div>
            <button className="modal__primary" onClick={() => { setPhase('idle'); setError(''); }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
