import { useEffect, useState } from 'react';
import './ThemeSwitcher.css';

export type ThemeName = 'porcelain' | 'sakura' | 'forest';

const THEMES: { name: ThemeName; label: string; swatch: string }[] = [
  { name: 'porcelain', label: 'Porcelain', swatch: '#30afff' },
  { name: 'sakura', label: 'Sakura', swatch: '#ffbe91' },
  { name: 'forest', label: 'Forest', swatch: '#546b41' },
];

const STORAGE_KEY = 'vidya-theme';

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  if (theme === 'porcelain') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeName>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeName) || 'porcelain'
  );

  useEffect(() => {
    applyTheme(current);
  }, [current]);

  const pick = (theme: ThemeName) => {
    setCurrent(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    setOpen(false);
  };

  return (
    <div className="theme-switch">
      <button
        type="button"
        className="theme-switch__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change color theme"
        title="Change color theme"
        style={{ background: 'var(--surface)' }}
      >
        <span className="theme-switch__dot" style={{ background: THEMES.find((t) => t.name === current)?.swatch }} />
        <span className="theme-switch__label">{THEMES.find((t) => t.name === current)?.label}</span>
        <span className="theme-switch__chev" aria-hidden="true">▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="theme-switch__scrim"
            aria-label="Close theme menu"
            onClick={() => setOpen(false)}
          />
          <div className="theme-switch__menu" role="menu">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t.name}
                role="menuitemradio"
                aria-checked={t.name === current}
                className={`theme-switch__item${t.name === current ? ' is-active' : ''}`}
                onClick={() => pick(t.name)}
              >
                <span className="theme-switch__swatch" style={{ background: t.swatch }} />
                <span>{t.label}</span>
                {t.name === current && <span className="theme-switch__check" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
