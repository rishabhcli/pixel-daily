// The interactive nonogram board: rendering, pointer/keyboard input, undo/redo, hints and the reveal.
import { colorOf } from '../shared/core';
import type { DailyPuzzle } from '../shared/daily';

export const EMPTY = 0;
export const FILL = 1;
export const MARK = 2;
export const WRONG = 3; // a fill that was not in the picture: shown as a red X, counts as empty

export type Tool = 'fill' | 'mark';
type Change = { i: number; from: number; to: number };
type Mode = 'fill' | 'erase' | 'mark' | 'unmark';

export type BoardEvents = {
  onChange: () => void;
  onMistake: (i: number) => void;
  onHint: () => void;
  onFirstMove: () => void;
  onSolved: () => void;
};

const LONG_PRESS_MS = 380;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Board {
  readonly n: number;
  readonly cells: Uint8Array;
  readonly sol: boolean[];
  readonly root: HTMLElement;
  readonly frame: HTMLElement;
  tool: Tool = 'fill';
  solved = false;
  private els: HTMLElement[] = [];
  private rowClues: HTMLElement[] = [];
  private colClues: HTMLElement[] = [];
  private undoStack: Change[][] = [];
  private redoStack: Change[][] = [];
  private cursor = 0;
  private started = false;
  private drag: { mode: Mode; axis: 'x' | 'y' | null; startIdx: number; last: number; batch: Change[]; applied: boolean; timer: number; moved: boolean } | null = null;

  constructor(
    private puzzle: DailyPuzzle,
    private ev: BoardEvents
  ) {
    this.n = puzzle.size;
    this.cells = new Uint8Array(this.n * this.n);
    this.sol = puzzle.picture.rows.flatMap((r) => [...r].map((c) => c !== '.'));
    this.frame = el('div', 'board-frame');
    this.root = el('div', 'board');
    this.root.setAttribute('role', 'grid');
    this.root.setAttribute('aria-label', `${this.n} by ${this.n} puzzle grid. Arrow keys move, space fills, X marks.`);
    this.root.style.setProperty('--n', String(this.n));
    this.build();
    this.frame.append(this.root);
    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointercancel', () => this.cancelDrag());
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---------- build ----------

  private build() {
    const n = this.n;
    this.root.append(el('div', 'corner'));
    for (let x = 0; x < n; x++) {
      const c = el('div', 'clue-col' + (x % 5 === 4 && x < n - 1 ? ' guide-r' : ''));
      for (const v of this.puzzle.clues.cols[x]!) c.append(el('span', undefined, String(v)));
      this.colClues.push(c);
      this.root.append(c);
    }
    for (let y = 0; y < n; y++) {
      const r = el('div', 'clue-row');
      for (const v of this.puzzle.clues.rows[y]!) r.append(el('span', undefined, String(v)));
      this.rowClues.push(r);
      this.root.append(r);
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const c = el('div', 'cell');
        c.dataset.i = String(i);
        c.setAttribute('role', 'gridcell');
        c.tabIndex = i === 0 ? 0 : -1;
        if ((x + y) % 2) c.classList.add('alt');
        if (x % 5 === 4 && x < n - 1) c.classList.add('gr');
        if (y % 5 === 4 && y < n - 1) c.classList.add('gb');
        this.els.push(c);
        this.root.append(c);
        this.paint(i);
      }
    }
    this.refreshClues();
  }

  /** Size the cells to fit `avail` pixels of width. */
  layout(avail: number) {
    const maxR = Math.max(...this.puzzle.clues.rows.map((r) => r.length));
    const cs = Math.max(13, Math.min(44, Math.floor((avail - 28) / (this.n + maxR * 0.62 + 0.4))));
    this.root.style.setProperty('--cs', `${cs}px`);
  }

  private label(i: number): string {
    const s = this.cells[i];
    const state = s === FILL ? 'filled' : s === MARK ? 'marked empty' : s === WRONG ? 'wrong, cleared' : 'empty';
    return `Row ${Math.floor(i / this.n) + 1}, column ${(i % this.n) + 1}, ${state}`;
  }

  private paint(i: number) {
    const e = this.els[i]!;
    const s = this.cells[i]!;
    e.classList.toggle('f', s === FILL);
    e.classList.toggle('x', s === MARK);
    e.classList.toggle('w', s === WRONG);
    e.setAttribute('aria-label', this.label(i));
  }

  // ---------- state ----------

  private lineDone(cells: number[]): boolean {
    return cells.every((i) => !this.sol[i] || this.cells[i] === FILL);
  }

  refreshClues() {
    const n = this.n;
    for (let y = 0; y < n; y++) {
      const idx = Array.from({ length: n }, (_, x) => y * n + x);
      this.rowClues[y]!.classList.toggle('done', this.lineDone(idx));
    }
    for (let x = 0; x < n; x++) {
      const idx = Array.from({ length: n }, (_, y) => y * n + x);
      this.colClues[x]!.classList.toggle('done', this.lineDone(idx));
    }
  }

  filledCount(): number {
    let k = 0;
    for (const c of this.cells) if (c === FILL) k++;
    return k;
  }

  filledList(): number[] {
    const out: number[] = [];
    this.cells.forEach((c, i) => c === FILL && out.push(i));
    return out;
  }

  private total = -1;
  private checkSolved() {
    if (this.total < 0) this.total = this.sol.filter(Boolean).length;
    if (this.solved) return;
    if (this.filledCount() === this.total && this.cells.every((c, i) => c !== FILL || this.sol[i])) {
      this.solved = true;
      this.ev.onSolved();
    }
  }

  private set(i: number, to: number, batch: Change[]) {
    const from = this.cells[i]!;
    if (from === to) return;
    this.cells[i] = to;
    batch.push({ i, from, to });
    this.paint(i);
  }

  /** Applies a fill to a cell, turning it into a red X (and a mistake) if it is not in the picture. */
  private fill(i: number, batch: Change[]) {
    if (this.sol[i]) this.set(i, FILL, batch);
    else {
      this.set(i, WRONG, batch);
      this.ev.onMistake(i);
    }
  }

  private commit(batch: Change[]) {
    if (!batch.length) return;
    this.undoStack.push(batch);
    this.redoStack = [];
    this.refreshClues();
    this.ev.onChange();
    this.checkSolved();
  }

  private begin() {
    if (!this.started) {
      this.started = true;
      this.ev.onFirstMove();
    }
  }

  /** What a plain tap on cell i does for the active tool. Returns the mode it started. */
  private startMode(i: number, tool: Tool): Mode {
    const s = this.cells[i]!;
    if (tool === 'fill') return s === FILL ? 'erase' : 'fill';
    return s === MARK ? 'unmark' : 'mark';
  }

  private applyMode(i: number, mode: Mode, batch: Change[]) {
    const s = this.cells[i]!;
    if (s === WRONG) {
      // tapping a wrong X just clears it, with no new penalty
      if (batch.length === 0 || mode === 'erase' || mode === 'unmark') this.set(i, EMPTY, batch);
      return;
    }
    if (mode === 'fill' && (s === EMPTY || s === MARK)) this.fill(i, batch);
    else if (mode === 'erase' && s === FILL) this.set(i, EMPTY, batch);
    else if (mode === 'mark' && s === EMPTY) this.set(i, MARK, batch);
    else if (mode === 'unmark' && s === MARK) this.set(i, EMPTY, batch);
  }

  // ---------- pointer ----------

  private cellFrom(e: Event, x?: number, y?: number): number {
    let t: Element | null = null;
    if (x !== undefined && y !== undefined && typeof document.elementFromPoint === 'function') t = document.elementFromPoint(x, y);
    if (!t) t = e.target as Element | null;
    const c = t?.closest?.('.cell') as HTMLElement | null;
    return c ? Number(c.dataset.i) : -1;
  }

  private onDown(e: PointerEvent) {
    if (this.solved) return;
    const i = this.cellFrom(e);
    if (i < 0) return;
    e.preventDefault();
    try {
      this.root.setPointerCapture?.(e.pointerId);
    } catch {
      /* not capturable (synthetic event) */
    }
    this.focusCell(i);
    const rightClick = e.button === 2;
    const tool: Tool = rightClick ? 'mark' : this.tool;
    const mode = this.startMode(i, tool);
    const d = { mode, axis: null as 'x' | 'y' | null, startIdx: i, last: i, batch: [] as Change[], applied: false, timer: 0, moved: false };
    this.drag = d;
    if (rightClick || e.pointerType === 'mouse') {
      this.begin();
      this.applyMode(i, mode, d.batch);
      d.applied = true;
    } else {
      // touch and pen: wait for a drag, a lift, or a long press (which marks the cell)
      d.timer = window.setTimeout(() => {
        if (!this.drag || this.drag.moved || this.drag.applied) return;
        this.begin();
        this.drag.mode = this.startMode(i, 'mark');
        this.applyMode(i, this.drag.mode, this.drag.batch);
        this.drag.applied = true;
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_MS);
    }
  }

  private onMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || this.solved) return;
    const i = this.cellFrom(e, e.clientX, e.clientY);
    if (i < 0 || i === d.last) return;
    if (!d.applied) {
      window.clearTimeout(d.timer);
      this.begin();
      this.applyMode(d.startIdx, d.mode, d.batch);
      d.applied = true;
    }
    d.moved = true;
    const n = this.n;
    const sx = d.startIdx % n;
    const sy = Math.floor(d.startIdx / n);
    const cx = i % n;
    const cy = Math.floor(i / n);
    if (!d.axis) d.axis = Math.abs(cx - sx) >= Math.abs(cy - sy) ? 'y' : 'x'; // 'y' = along the row
    // keep to the starting row or column
    const ti = d.axis === 'y' ? sy * n + cx : cy * n + sx;
    const from = d.last;
    const step = d.axis === 'y' ? 1 : n;
    const a = Math.min(from, ti);
    const b = Math.max(from, ti);
    for (let k = a; k <= b; k += step) this.applyMode(k, d.mode, d.batch);
    d.last = ti;
    this.focusCell(ti, false);
  }

  private onUp(_e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    window.clearTimeout(d.timer);
    this.drag = null;
    if (!d.applied) {
      this.begin();
      this.applyMode(d.startIdx, d.mode, d.batch);
    }
    this.commit(d.batch);
  }

  private cancelDrag() {
    const d = this.drag;
    if (!d) return;
    window.clearTimeout(d.timer);
    this.drag = null;
    this.commit(d.batch);
  }

  // ---------- keyboard ----------

  private focusCell(i: number, focus = true) {
    this.els[this.cursor]!.tabIndex = -1;
    this.cursor = i;
    const c = this.els[i]!;
    c.tabIndex = 0;
    if (focus) c.focus({ preventScroll: true });
  }

  private onKey(e: KeyboardEvent) {
    if (this.solved) return;
    const n = this.n;
    const x = this.cursor % n;
    const y = Math.floor(this.cursor / n);
    const move = (nx: number, ny: number) => {
      e.preventDefault();
      this.focusCell(Math.min(n - 1, Math.max(0, ny)) * n + Math.min(n - 1, Math.max(0, nx)));
    };
    const key = e.key;
    if (key === 'ArrowLeft') return move(x - 1, y);
    if (key === 'ArrowRight') return move(x + 1, y);
    if (key === 'ArrowUp') return move(x, y - 1);
    if (key === 'ArrowDown') return move(x, y + 1);
    if (key === 'Home') return move(0, y);
    if (key === 'End') return move(n - 1, y);
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    const act = (tool: Tool) => {
      e.preventDefault();
      this.begin();
      const batch: Change[] = [];
      this.applyMode(this.cursor, this.startMode(this.cursor, tool), batch);
      this.commit(batch);
    };
    if (key === ' ' || key === 'Enter') return act(this.tool);
    if (key.toLowerCase() === 'x') return act('mark');
    if (key === 'f' || key === 'F') return act('fill');
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      const batch: Change[] = [];
      if (this.cells[this.cursor] !== EMPTY) this.set(this.cursor, EMPTY, batch);
      this.commit(batch);
    }
  }

  // ---------- actions ----------

  canUndo() {
    return this.undoStack.length > 0 && !this.solved;
  }
  canRedo() {
    return this.redoStack.length > 0 && !this.solved;
  }

  undo() {
    const batch = this.undoStack.pop();
    if (!batch || this.solved) return;
    for (let k = batch.length - 1; k >= 0; k--) {
      const c = batch[k]!;
      this.cells[c.i] = c.from;
      this.paint(c.i);
    }
    this.redoStack.push(batch);
    this.refreshClues();
    this.ev.onChange();
  }

  redo() {
    const batch = this.redoStack.pop();
    if (!batch || this.solved) return;
    for (const c of batch) {
      this.cells[c.i] = c.to;
      this.paint(c.i);
    }
    this.undoStack.push(batch);
    this.refreshClues();
    this.ev.onChange();
    this.checkSolved();
  }

  /** Clears the grid. Time and mistakes keep counting. */
  reset() {
    if (this.solved) return;
    const batch: Change[] = [];
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== EMPTY) this.set(i, EMPTY, batch);
    this.commit(batch);
  }

  /** Fills one correct cell, preferring a cell in the least finished line. */
  hint(): boolean {
    if (this.solved) return false;
    const n = this.n;
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < this.cells.length; i++) {
      if (!this.sol[i] || this.cells[i] === FILL) continue;
      const y = Math.floor(i / n);
      const x = i % n;
      let left = 0;
      for (let k = 0; k < n; k++) {
        if (this.sol[y * n + k] && this.cells[y * n + k] !== FILL) left++;
        if (this.sol[k * n + x] && this.cells[k * n + x] !== FILL) left++;
      }
      const score = 100 - left;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) return false;
    this.begin();
    const batch: Change[] = [];
    this.set(best, FILL, batch);
    this.els[best]!.classList.add('hint');
    this.ev.onHint();
    this.commit(batch);
    return true;
  }

  // ---------- persistence ----------

  encode(): string {
    return Array.from(this.cells).join('');
  }

  restore(code: string) {
    if (code.length !== this.cells.length) return;
    for (let i = 0; i < code.length; i++) {
      const v = Number(code[i]);
      this.cells[i] = v === FILL && !this.sol[i] ? EMPTY : v >= 0 && v <= 3 ? v : 0;
      this.paint(i);
    }
    this.started = this.cells.some((c) => c !== EMPTY);
    this.refreshClues();
    this.checkSolved();
  }

  /** Marks an already-solved game (from the server or local storage) without animation. */
  forceSolved() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = this.sol[i] ? FILL : EMPTY;
      this.paint(i);
    }
    this.solved = true;
    this.refreshClues();
  }

  // ---------- reveal ----------

  /** Cross-fades the grid into the colour picture. */
  reveal(animate: boolean) {
    const n = this.n;
    const rows = this.puzzle.picture.rows;
    for (let i = 0; i < this.els.length; i++) {
      const e = this.els[i]!;
      const x = i % n;
      const y = Math.floor(i / n);
      const col = colorOf(rows[y]![x]!);
      if (col) {
        e.style.setProperty('--pc', col);
        e.classList.add('pic');
      }
      e.style.setProperty('--d', animate ? `${(x + y) * 38}ms` : '0ms');
    }
    this.frame.classList.add('reveal');
    this.root.classList.add('solved');
    this.root.removeAttribute('aria-label');
    this.root.setAttribute('aria-label', `Solved: ${this.puzzle.picture.name}`);
  }
}
