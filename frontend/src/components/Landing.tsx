import { useEffect, useRef, useState } from 'react';
import {
  LogoMark, SparkIcon, FileIcon, UploadIcon, CheckIcon, PlusIcon, LinkIcon, PlayIcon,
} from './Icons';
import './Landing.css';

export interface LandingProps {
  onLogin: () => void;     // open auth in login mode
  onRegister: () => void;  // open auth in register mode
}

const FEATURES = [
  {
    icon: 'chat',
    title: 'Chat with the transcript',
    body: 'Ask anything about a video or meeting in plain language and Vidya answers from what was actually said — no scrubbing for the moment.',
  },
  {
    icon: 'bolt',
    title: 'Transcribed in seconds',
    body: 'Paste a YouTube link or drop in a recording and Vidya transcribes, summarizes, and indexes it automatically. Start asking moments later.',
  },
  {
    icon: 'lock',
    title: 'Private to you',
    body: 'Your videos and meetings are scoped to your account and used only to answer you. Nothing leaves your workspace, nothing trains on your files.',
  },
];

const STEPS = [
  {
    icon: 'upload',
    title: 'Add a source',
    body: 'Paste a YouTube URL or upload a video / audio file. Vidya pulls the transcript and reads it for you.',
  },
  {
    icon: 'process',
    title: 'Summarize',
    body: 'Vidya turns the transcript into a clean summary, with action items, decisions, and open questions.',
  },
  {
    icon: 'answer',
    title: 'Chat',
    body: 'Ask follow-ups in plain language and get answers drawn straight from the conversation.',
  },
];

// Source types Vidya accepts, each with a recognizable accent color.
const FORMATS = [
  { label: 'YouTube', color: '#e5484d' },
  { label: 'MP4', color: '#6d3bff' },
  { label: 'MP3', color: '#19c3e6' },
  { label: 'WAV', color: '#ff5c8a' },
  { label: 'M4A', color: '#2fae6b' },
];

function FeatureIcon({ name }: { name: string }) {
  if (name === 'lock') {
    return (
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="3" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  }
  if (name === 'bolt') return <SparkIcon size={19} />;
  if (name === 'chat') return (
    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
  return <FileIcon size={19} />;
}

function StepIcon({ name }: { name: string }) {
  if (name === 'upload') {
    // Either a YouTube link or a file upload — show the link mark.
    return <LinkIcon size={18} />;
  }
  if (name === 'answer') return <CheckIcon size={18} />;
  if (name === 'process') return <SparkIcon size={18} />;
  return <UploadIcon size={18} />;
}

// The mock answer that types itself on page load.
const MOCK_ANSWER =
  'The team agreed to ship the onboarding redesign by the 14th, and Priya will own the rollout. The main open risk is the analytics migration; they deferred a final call until the load test lands.';

export function Landing({ onLogin, onRegister }: LandingProps) {
  const [typed, setTyped] = useState('');
  const [mockReady, setMockReady] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const delay = window.setTimeout(() => setMockReady(true), 600);
    return () => window.clearTimeout(delay);
  }, []);

  useEffect(() => {
    if (!mockReady) return;
    let i = 0;
    timerRef.current = window.setTimeout(() => {
      const step = () => {
        i += 2;
        if (i < MOCK_ANSWER.length) {
          setTyped(MOCK_ANSWER.slice(0, i));
          timerRef.current = window.setTimeout(step, 18);
        } else {
          setTyped(MOCK_ANSWER);
        }
      };
      step();
    }, 400);
    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [mockReady]);

  // Reveal-on-scroll
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      {/* ---------- Nav ---------- */}
      <header className="landing__nav">
        <div className="landing__nav-inner">
          <a className="landing__brand" href="#top" aria-label="Vidya home">
            <LogoMark size={26} />
            <span className="landing__brand-name">Vidya</span>
          </a>

          <nav className="landing__nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </nav>

          <div className="landing__nav-cta">
            <button className="landing__nav-login" type="button" onClick={onLogin}>
              Log in
            </button>
            <button className="landing__nav-join" type="button" onClick={onRegister}>
              Get started
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="landing__hero">
          <div className="landing__hero-inner">
            <div className="hero__copy">
              <p className="eyebrow">Video &amp; meeting intelligence</p>

              <h1 className="hero__title">
                Chat with any video.
                <span className="hero__title-line">Meetings, talks, and <em>everything said.</em></span>
              </h1>

              <p className="hero__sub">
                Vidya is a retrieval-augmented assistant for video and audio: drop in a YouTube link
                or a recording, and it transcribes, summarizes, and answers questions in plain
                language — straight from what was said.
              </p>

              <div className="hero__cta">
                <button className="btn btn--primary" type="button" onClick={onRegister}>
                  Get started
                </button>
                <button className="btn btn--ghost" type="button" onClick={onLogin}>
                  Log in
                </button>
              </div>

              <p className="hero__trust">
                YouTube or upload&nbsp;&nbsp;·&nbsp;&nbsp;Private to your account&nbsp;&nbsp;·&nbsp;&nbsp;Free to start
              </p>
            </div>

            {/* Product example with a typewriter effect. A video card that
                "plays", a user question, and the typed answer. */}
            <figure className="hero__mock" aria-label="Vidya example: a question and its answer from a video.">
              <div className="mock__bar">
                <div className="mock__tabs">
                  <span className="mock__tab mock__tab--active">
                    <PlayIcon size={15} />
                    <span className="mock__tab-name">Product_sync</span>
                    <span className="mock__tab-chip">YouTube</span>
                  </span>
                  <span className="mock__tab mock__tab--add" aria-hidden="true">
                    <PlusIcon size={14} />
                  </span>
                </div>
                <span className="mock__meta">transcribed · indexed</span>
              </div>

              <div className="mock__video" aria-hidden="true">
                <span className="mock__play"><PlayIcon size={22} /></span>
                <span className="mock__video-badge">28:14</span>
                <span className="mock__video-eq">
                  <i /><i /><i /><i /><i />
                </span>
              </div>

              <div className="mock__thread">
                <div className="mock__msg mock__msg--user">
                  What did we decide about the launch?
                </div>
                <div className="mock__msg mock__msg--ai">
                  <span className="mock__avatar"><LogoMark size={18} /></span>
                  <div className="mock__bubble">
                    <p>
                      <strong>Launch by the 14th</strong> — {typed}
                      {typed.length < MOCK_ANSWER.length && (
                        <span className="mock__caret" aria-hidden="true" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* ---------- Formats: a continuously scrolling marquee ---------- */}
        <section className="landing__formats" aria-label="Supported sources">
          <span className="landing__formats-label">Works with</span>
          <div className="landing__marquee">
            <div className="landing__marquee-track">
              {[...FORMATS, ...FORMATS].map((f, i) => (
                <span
                  className="landing__format"
                  key={`${f.label}-${i}`}
                  aria-hidden={i >= FORMATS.length}
                >
                  <i style={{ background: f.color }} aria-hidden="true" />
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="landing__section" id="features">
          <div className="landing__section-head" data-reveal>
            <p className="eyebrow">Features</p>
            <h2 className="landing__title">Understand any video — without rewatching it.</h2>
            <p className="landing__lede">
              Vidya is built on retrieval-augmented generation: your recordings stay yours, and every
              answer is drawn from the words actually spoken in the source.
            </p>
          </div>

          <div className="features__grid">
            {FEATURES.map((f, i) => (
              <article className="feature-card" key={f.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}>
                <span className="feature-card__icon">
                  <FeatureIcon name={f.icon} />
                </span>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__body">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing__section landing__section--alt" id="how">
          <div className="landing__section-head" data-reveal>
            <p className="eyebrow">How it works</p>
            <h2 className="landing__title">From link to answer, in three steps.</h2>
          </div>

          <div className="how__grid">
            {STEPS.map((s, i) => (
              <div className="how__step" key={s.title} data-reveal style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}>
                <span className="how__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="how__icon"><StepIcon name={s.icon} /></span>
                <h3 className="how__title">{s.title}</h3>
                <p className="how__body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="landing__cta">
          <div className="landing__cta-inner" data-reveal>
            <p className="eyebrow landing__cta-eyebrow">Vidya</p>
            <h2 className="landing__cta-title">Start chatting with your videos.</h2>
            <p className="landing__cta-sub">Create a free account and get answers from any meeting in under a minute.</p>
            <button className="btn btn--primary landing__cta-btn" type="button" onClick={onRegister}>
              Get started — it&rsquo;s free
            </button>
            <p className="landing__cta-alt">
              Already have an account?{' '}
              <button type="button" onClick={onLogin}>Log in</button>
            </p>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="landing__foot">
        <span className="landing__foot-brand"><LogoMark size={20} /> Vidya</span>
        <span className="landing__foot-tag">Chat with any video.</span>
      </footer>
    </div>
  );
}
