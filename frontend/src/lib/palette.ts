// Each meeting gets a vibrant color identity, picked deterministically from its
// id so a meeting always wears the same hue across sessions.

export interface MeetingColor {
  main: string;   // vibrant body color
  soft: string;   // pale wash background
  ink: string;    // readable dark tone derived from main
}

const PALETTE: MeetingColor[] = [
  { main: '#e07a5f', soft: '#f6e0d8', ink: '#b14e36' }, // terracotta
  { main: '#81b29a', soft: '#dceae2', ink: '#4f8068' }, // sage
  { main: '#e0a82e', soft: '#f7eccb', ink: '#a8790f' }, // honey
  { main: '#c98a4b', soft: '#f5e6d2', ink: '#9a6422' }, // ochre
  { main: '#8ba35a', soft: '#e9efd6', ink: '#5f7a38' }, // olive
  { main: '#6fa98b', soft: '#dceae2', ink: '#3f7c60' }, // pine-green
  { main: '#d98c5f', soft: '#f7e3d6', ink: '#a85f36' }, // clay
  { main: '#b5853f', soft: '#f3e7cd', ink: '#855c1f' }, // bronze
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
