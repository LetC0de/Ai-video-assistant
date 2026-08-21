// Each meeting gets a vibrant color identity, picked deterministically from its
// id so a meeting always wears the same hue across sessions.

export interface MeetingColor {
  main: string;   // vibrant body color
  soft: string;   // pale wash background
  ink: string;    // readable dark tone derived from main
}

const PALETTE: MeetingColor[] = [
  { main: '#6d3bff', soft: '#ece4ff', ink: '#4a1fd1' }, // violet
  { main: '#19c3e6', soft: '#d8f5fc', ink: '#0b7e98' }, // cyan
  { main: '#7c5cff', soft: '#ece7ff', ink: '#5236c9' }, // indigo
  { main: '#ff5c8a', soft: '#ffe1ec', ink: '#c42e60' }, // pink
  { main: '#f4a62a', soft: '#fdeccb', ink: '#a86808' }, // amber
  { main: '#2fae6b', soft: '#d6f0e0', ink: '#16713f' }, // kiwi
  { main: '#3b6bff', soft: '#dde6ff', ink: '#1f47c2' }, // blue
  { main: '#e85656', soft: '#fadada', ink: '#a82a2a' }, // poppy
];

export function meetingColor(id: number): MeetingColor {
  return PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

// Initials for a meeting avatar: from the title (since we have no filename).
export function initialsFromTitle(title: string): string {
  const base = title.trim();
  const parts = base.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'MT';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// A short host label derived from the source (YouTube URL or file path).
export function sourceLabel(source: string): string {
  if (/youtube\.com|youtu\.be/i.test(source)) return 'YouTube';
  const m = source.match(/[^/\\]+$/);
  return m ? m[0] : source;
}
