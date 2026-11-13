// Deterministic daily selection: same UTC date gives the same puzzle on client and server.
import { CATALOG } from './art.ts';
import { DROPPED_IDS } from './dropped.ts';
import {
  EPOCH_DAY,
  addDays,
  cluesOf,
  dayToIndex,
  fnv1a,
  mulberry32,
  puzzleNumber,
  sizeForDay,
  type Clues,
  type Picture,
} from './core.ts';
import { analyze, gridEqualsMask } from './solver.ts';

export const NO_REPEAT_DAYS = 60;

export type DailyPuzzle = {
  day: string;
  number: number;
  size: number;
  picture: Picture;
  clues: Clues;
  source: 'curated' | 'generated';
};

const dropped = new Set(DROPPED_IDS);
export const ROTATION: Picture[] = CATALOG.filter((p) => !dropped.has(p.id));

export function rotationFor(size: number): Picture[] {
  return ROTATION.filter((p) => p.size === size).sort((a, b) => (a.id < b.id ? -1 : 1));
}

// ---------- procedural glyphs ----------

const COLOR_SETS = [
  ['r', 'o', 'y'],
  ['b', 'c', 'w'],
  ['p', 'm', 'w'],
  ['g', 'd', 'y'],
  ['v', 'b', 'c'],
  ['m', 'p', 'v'],
  ['o', 'n', 't'],
  ['k', 'a', 's'],
  ['c', 'g', 'w'],
  ['r', 'm', 'h'],
];
const ADJ = ['Cosmic', 'Sleepy', 'Cheeky', 'Glimmering', 'Tiny', 'Wandering', 'Neon', 'Midnight', 'Sunny', 'Frosty', 'Wobbly', 'Lucky', 'Velvet', 'Electric', 'Gentle', 'Stormy'];
const NOUN = ['Totem', 'Beetle', 'Lantern', 'Moth', 'Idol', 'Charm', 'Sprite', 'Emblem', 'Crest', 'Mask', 'Comet', 'Relic', 'Crystal', 'Moth', 'Badge', 'Critter'];

function glyphAttempt(day: string, size: number, attempt: number): Picture {
  const rng = mulberry32(fnv1a(`pixel-daily|glyph|${day}|${size}|${attempt}`));
  const hw = Math.ceil(size / 2);
  const colors = COLOR_SETS[Math.floor(rng() * COLOR_SETS.length)]!;
  const density = 0.55 + rng() * 0.12;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    const half: string[] = [];
    for (let x = 0; x < hw; x++) {
      // slightly denser toward the centre so glyphs read as one shape
      const cx = (hw - 1 - x) / hw;
      const cy = Math.abs(y - (size - 1) / 2) / (size / 2);
      const p = density + 0.18 * (1 - Math.max(cx, cy)) - 0.12 * Math.max(cx, cy);
      if (rng() < p) {
        const band = Math.min(colors.length - 1, Math.floor((cx * 0.5 + cy * 0.5 + rng() * 0.35) * colors.length));
        half.push(colors[band]!);
      } else half.push('.');
    }
    const left = half.join('');
    const right = [...left].reverse().slice(size % 2 === 1 ? 1 : 0).join('');
    rows.push(left + right);
  }
  const name = `${ADJ[Math.floor(rng() * ADJ.length)]} ${NOUN[Math.floor(rng() * NOUN.length)]}`;
  return { id: `glyph-${day}`, name, size, rows };
}

/** Mirror-symmetric multicolour glyph for a date; always logic-solvable. */
export function glyphForDay(day: string, size: number = sizeForDay(day)): Picture {
  const area = size * size;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const p = glyphAttempt(day, size, attempt);
    const filled = p.rows.join('').replace(/\./g, '').length;
    if (filled < area * 0.4 || filled > area * 0.8) continue;
    const m = p.rows.map((r) => [...r].map((c) => c !== '.'));
    if (m.some((r) => !r.some(Boolean))) continue;
    let colsOk = true;
    for (let x = 0; x < size && colsOk; x++) if (!m.some((r) => r[x])) colsOk = false;
    if (!colsOk) continue;
    const clues = cluesOf(p.rows);
    const a = analyze(clues, 2000);
    if (a.status === 'logic' && gridEqualsMask(a.grid, p.rows)) return p;
  }
  // Practically unreachable: a fully filled square is always logic-solvable.
  const rows = Array.from({ length: size }, () => 'o'.repeat(size));
  return { id: `glyph-${day}`, name: 'Golden Block', size, rows };
}

// ---------- schedule ----------

const cache = new Map<string, DailyPuzzle>();
let lastUsed = new Map<string, number>(); // picture id -> day index
let scheduleThrough = -Infinity; // last day index simulated
let scheduleBase = 0;
const picks = new Map<number, string | null>(); // day index -> picture id (null = generated)

function resetSchedule() {
  lastUsed = new Map();
  picks.clear();
  scheduleBase = dayToIndex(EPOCH_DAY);
  scheduleThrough = scheduleBase - 1;
}
resetSchedule();

function pickFor(dayIdx: number): string | null {
  const day = new Date(dayIdx * 86400000).toISOString().slice(0, 10);
  const size = sizeForDay(day);
  const pool = rotationFor(size).filter((p) => {
    const last = lastUsed.get(p.id);
    return last === undefined || dayIdx - last >= NO_REPEAT_DAYS;
  });
  if (!pool.length) return null;
  const rng = mulberry32(fnv1a(`pixel-daily|pick|${day}`));
  return pool[Math.floor(rng() * pool.length)]!.id;
}

function advanceTo(dayIdx: number) {
  while (scheduleThrough < dayIdx) {
    const next = scheduleThrough + 1;
    const id = pickFor(next);
    picks.set(next, id);
    if (id) lastUsed.set(id, next);
    scheduleThrough = next;
  }
}

/** The puzzle for a UTC date. Days before launch always get a generated glyph. */
export function puzzleForDay(day: string): DailyPuzzle {
  const hit = cache.get(day);
  if (hit) return hit;
  const idx = dayToIndex(day);
  const size = sizeForDay(day);
  let picture: Picture | null = null;
  let source: DailyPuzzle['source'] = 'generated';
  if (idx >= scheduleBase) {
    advanceTo(idx);
    const id = picks.get(idx);
    const found = id ? ROTATION.find((p) => p.id === id) : undefined;
    if (found) {
      picture = found;
      source = 'curated';
    }
  }
  if (!picture) picture = glyphForDay(day, size);
  const out: DailyPuzzle = { day, number: puzzleNumber(day), size, picture, clues: cluesOf(picture.rows), source };
  if (cache.size > 400) cache.clear();
  cache.set(day, out);
  return out;
}

/** Last N day strings ending at `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
