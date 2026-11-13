// Nonogram solver: line solving by exhaustive arrangement masks (lines are at most 15 cells),
// plus a bounded backtracking search used to classify how a puzzle can be solved.
import type { Clues } from './core.ts';

const UNKNOWN = 0;
const FILLED = 1;
const EMPTY = 2;

export type Solved = Uint8Array; // length n*n of UNKNOWN | FILLED | EMPTY (square grids)

/**
 * One line: given clue and current cells, returns the new cells, or null on contradiction.
 * A cell is FILLED when every arrangement fills it and EMPTY when no arrangement does.
 */
export function solveLine(clue: number[], line: ArrayLike<number>): Uint8Array | null {
  const n = line.length;
  const blocks = clue.length === 1 && clue[0] === 0 ? [] : clue;
  let knownFilled = 0;
  let knownEmpty = 0;
  for (let i = 0; i < n; i++) {
    if (line[i] === FILLED) knownFilled |= 1 << i;
    else if (line[i] === EMPTY) knownEmpty |= 1 << i;
  }
  const k = blocks.length;
  const minTail: number[] = new Array(k + 1).fill(0); // min cells needed by blocks b..k-1
  for (let b = k - 1; b >= 0; b--) minTail[b] = blocks[b]! + (b < k - 1 ? 1 : 0) + minTail[b + 1]!;
  let andMask = (1 << n) - 1;
  let orMask = 0;
  let count = 0;
  const rec = (b: number, pos: number, mask: number) => {
    if (b === k) {
      if ((mask & knownEmpty) !== 0 || (knownFilled & ~mask) !== 0) return;
      count++;
      andMask &= mask;
      orMask |= mask;
      return;
    }
    const len = blocks[b]!;
    const last = n - minTail[b]!;
    for (let s = pos; s <= last; s++) {
      // cells pos..s-1 stay empty: none may be known filled
      if (s > pos && (knownFilled & (((1 << s) - 1) & ~((1 << pos) - 1))) !== 0) break;
      const run = ((1 << len) - 1) << s;
      if ((run & knownEmpty) !== 0) continue;
      // gap cell after the block must not be known filled
      if (s + len < n && (knownFilled & (1 << (s + len))) !== 0) continue;
      rec(b + 1, s + len + 1, mask | run);
    }
  };
  rec(0, 0, 0);
  if (count === 0) return null;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (andMask & (1 << i)) out[i] = FILLED;
    else if (!(orMask & (1 << i))) out[i] = EMPTY;
    else out[i] = UNKNOWN;
  }
  return out;
}

/** Repeated row/column line solving. Returns false on contradiction. Mutates `g`. */
export function propagate(clues: Clues, g: Solved, n: number): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < n; y++) {
      const line = g.subarray(y * n, y * n + n);
      const res = solveLine(clues.rows[y]!, line);
      if (!res) return false;
      for (let x = 0; x < n; x++) {
        if (res[x] !== UNKNOWN && line[x] === UNKNOWN) {
          g[y * n + x] = res[x]!;
          changed = true;
        }
      }
    }
    for (let x = 0; x < n; x++) {
      const line = new Uint8Array(n);
      for (let y = 0; y < n; y++) line[y] = g[y * n + x]!;
      const res = solveLine(clues.cols[x]!, line);
      if (!res) return false;
      for (let y = 0; y < n; y++) {
        if (res[y] !== UNKNOWN && line[y] === UNKNOWN) {
          g[y * n + x] = res[y]!;
          changed = true;
        }
      }
    }
  }
  return true;
}

export type Analysis = {
  /** logic: pure line solving finishes it. guess: unique but needs search. multiple: 2+ solutions. none: no solution. unknown: search limit hit. */
  status: 'logic' | 'guess' | 'multiple' | 'none' | 'unknown';
  solutions: number;
  /** The solved grid for logic/guess puzzles (1 = filled). */
  grid: Uint8Array | null;
};

export function analyze(clues: Clues, maxNodes = 20000): Analysis {
  const n = clues.rows.length;
  const g = new Uint8Array(n * n);
  if (!propagate(clues, g, n)) return { status: 'none', solutions: 0, grid: null };
  if (!g.includes(UNKNOWN)) return { status: 'logic', solutions: 1, grid: g };

  let nodes = 0;
  let solutions = 0;
  let first: Uint8Array | null = null;
  let aborted = false;
  const search = (state: Uint8Array) => {
    if (solutions >= 2 || aborted) return;
    if (++nodes > maxNodes) {
      aborted = true;
      return;
    }
    const idx = state.indexOf(UNKNOWN);
    if (idx < 0) {
      solutions++;
      if (!first) first = state.slice();
      return;
    }
    for (const v of [FILLED, EMPTY]) {
      const next = state.slice();
      next[idx] = v;
      if (propagate(clues, next, n)) search(next);
    }
  };
  search(g);
  if (solutions >= 2) return { status: 'multiple', solutions, grid: null };
  if (aborted) return { status: 'unknown', solutions, grid: null };
  if (solutions === 0) return { status: 'none', solutions: 0, grid: null };
  return { status: 'guess', solutions: 1, grid: first };
}

export function isLogicSolvable(clues: Clues): boolean {
  return analyze(clues).status === 'logic';
}

/** Mask of the grid solved by the solver, for comparing against a picture. */
export function gridEqualsMask(grid: Uint8Array | null, rows: string[]): boolean {
  if (!grid) return false;
  const n = rows.length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((grid[y * n + x] === FILLED) !== (rows[y]![x] !== '.')) return false;
  return true;
}
