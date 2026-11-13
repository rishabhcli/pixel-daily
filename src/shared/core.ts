// Dates, PRNG, clues, streaks, histogram buckets and share text. No catalog here, so the splash stays tiny.

export const EPOCH_DAY = '2026-11-16'; // Pixel Daily #1
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Grid size by weekday (index 0 = Sunday). */
export const SIZE_BY_WEEKDAY = [15, 5, 7, 8, 10, 10, 12];

// ---------- dates ----------

export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function isDayString(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

export function dayToIndex(day: string): number {
  return Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
}

export function addDays(day: string, n: number): string {
  return new Date((dayToIndex(day) + n) * 86400000).toISOString().slice(0, 10);
}

/** Days since 2026-11-16, which is Day 1. Earlier dates count down from 0. */
export function puzzleNumber(day: string): number {
  return dayToIndex(day) - dayToIndex(EPOCH_DAY) + 1;
}

export function weekday(day: string): number {
  return new Date(day + 'T00:00:00Z').getUTCDay();
}

export function sizeForDay(day: string): number {
  return SIZE_BY_WEEKDAY[weekday(day)]!;
}

// ---------- PRNG ----------

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- pictures and clues ----------

/** A solved picture: `rows[y][x]` is a palette key, '.' means empty. */
export type Picture = {
  id: string;
  name: string;
  size: number;
  rows: string[];
};

export type Clues = { rows: number[][]; cols: number[][] };

export function maskOf(rows: string[]): boolean[][] {
  return rows.map((r) => [...r].map((ch) => ch !== '.'));
}

export function lineClue(cells: boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const c of cells) {
    if (c) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

export function cluesOf(rows: string[]): Clues {
  const m = maskOf(rows);
  const n = rows.length;
  const w = rows[0]?.length ?? 0;
  const rowC = m.map((r) => lineClue(r));
  const colC: number[][] = [];
  for (let x = 0; x < w; x++) colC.push(lineClue(Array.from({ length: n }, (_, y) => m[y]![x]!)));
  return { rows: rowC, cols: colC };
}

/** Sorted flat indices (y * size + x) of the filled cells. */
export function solutionCells(rows: string[]): number[] {
  const out: number[] = [];
  const n = rows.length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rows[y]![x] !== '.') out.push(y * n + x);
  return out;
}

/** True when `cells` is exactly the picture's filled set (order and duplicates ignored). */
export function gridMatches(rows: string[], cells: unknown): boolean {
  if (!Array.isArray(cells)) return false;
  const n = rows.length;
  const want = new Set(solutionCells(rows));
  const got = new Set<number>();
  for (const c of cells) {
    if (!Number.isInteger(c) || (c as number) < 0 || (c as number) >= n * n) return false;
    got.add(c as number);
  }
  if (got.size !== want.size) return false;
  for (const c of want) if (!got.has(c)) return false;
  return true;
}

// ---------- palette ----------

export const PALETTE: Record<string, string> = {
  r: '#e5484d', // red
  o: '#f5902c', // orange
  y: '#f7c93b', // yellow
  g: '#46b868', // green
  d: '#1f7a45', // dark green
  b: '#3b82f6', // blue
  v: '#2b3f8f', // navy
  c: '#35c9d8', // cyan
  p: '#8b5cf6', // purple
  m: '#ee5fa7', // pink
  w: '#f8f6f0', // white
  k: '#232433', // near black
  n: '#9a6334', // brown
  u: '#5e3a1e', // dark brown
  t: '#e9c99a', // tan
  s: '#aab4c3', // light grey
  a: '#5a6577', // slate
  h: '#f7c4a5', // peach
};

export function colorOf(key: string): string | null {
  return key === '.' ? null : (PALETTE[key] ?? '#888888');
}

// ---------- streaks ----------

export type Streak = { current: number; best: number; last: string | null };

/** Streak after solving `day` (UTC). Past-day solves never change the streak. */
export function nextStreak(prev: Streak, day: string, today: string): Streak {
  if (day !== today) return prev;
  if (prev.last === day) return prev;
  const current = prev.last === addDays(day, -1) ? prev.current + 1 : 1;
  return { current, best: Math.max(prev.best, current), last: day };
}

/** The streak a player should see on a given day (a missed day shows 0). */
export function visibleStreak(s: Streak, today: string): number {
  if (!s.last) return 0;
  return s.last === today || s.last === addDays(today, -1) ? s.current : 0;
}

// ---------- scoring, histogram ----------

/** Lower is better: time first, then mistakes. */
export function scoreOf(ms: number, mistakes: number): number {
  return Math.min(Math.max(Math.round(ms), 0), 99_999_999) * 100 + Math.min(Math.max(Math.round(mistakes), 0), 99);
}

export function fromScore(score: number): { ms: number; mistakes: number } {
  const ms = Math.floor(score / 100);
  return { ms, mistakes: Math.round(score - ms * 100) };
}

const BUCKET_BASE_SECONDS = [15, 30, 60, 120, 240, 480, 900];

/** Upper edges (seconds) of the time buckets; the last bucket is open-ended. Scales with grid area. */
export function bucketEdges(size: number): number[] {
  const f = (size * size) / 25;
  return BUCKET_BASE_SECONDS.map((s) => Math.round(s * f));
}

export function bucketFor(size: number, ms: number): number {
  const sec = ms / 1000;
  const edges = bucketEdges(size);
  for (let i = 0; i < edges.length; i++) if (sec < edges[i]!) return i;
  return edges.length;
}

export function formatDuration(sec: number): string {
  if (sec < 90) return `${sec}s`;
  const m = Math.round(sec / 60);
  return m < 90 ? `${m}m` : `${Math.round(m / 60)}h`;
}

export function bucketLabels(size: number): string[] {
  const e = bucketEdges(size);
  const out = [`<${formatDuration(e[0]!)}`];
  for (let i = 1; i < e.length; i++) out.push(`${formatDuration(e[i - 1]!)}+`);
  out.push(`${formatDuration(e[e.length - 1]!)}+`);
  return out;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Non-spoiler summary: nothing about the picture, only how the run went. */
export function emojiSummary(p: {
  number: number;
  size: number;
  ms: number;
  mistakes: number;
  hints: number;
  streak: number;
}): string {
  const bar = '🟩'.repeat(Math.max(0, p.size - Math.min(p.mistakes, p.size))) + '🟥'.repeat(Math.min(p.mistakes, p.size));
  const parts = [`Pixel Daily ${numLabel(p.number)} ${p.size}x${p.size}`, `⏱ ${formatTime(p.ms)}`, `❌ ${p.mistakes}`, `💡 ${p.hints}`];
  if (p.streak > 1) parts.push(`🔥 ${p.streak}`);
  return `${parts.join(' · ')}\n${bar}`;
}

/** '#12', or 'Preview' for dates before launch (puzzle numbers start at Day 1). */
export function numLabel(number: number): string {
  return number >= 1 ? `#${number}` : 'Preview';
}

export function dayTitle(number: number, size: number): string {
  return `Pixel Daily ${numLabel(number)}: a ${size}x${size} mystery picture`;
}
