// Expanded game view: plain DOM. Play, Gallery and Leaderboard tabs.
import './index.css';
import { getGallery, getLeaderboard, getToday, shareComment, submit } from './api';
import { Board } from './board';
import { launchConfetti } from './confetti';
import { copyText, openComments, promptLogin, toast } from './host';
import { numLabel, bucketFor, bucketLabels, colorOf, emojiSummary, formatTime, weekday, DAY_NAMES } from '../shared/core';
import { puzzleForDay, type DailyPuzzle } from '../shared/daily';
import type { GalleryResponse, LeaderboardResponse, StripDay, SubmitResponse, TodayResponse } from '../shared/api';
import type { Picture } from '../shared/core';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(label: string, cls = '', onClick?: (e: MouseEvent) => void): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), label);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

const root = document.getElementById('root')!;

type Run = { ms: number; mistakes: number; hints: number };
type Saved = { cells: string; ms: number; mistakes: number; hints: number; solved?: Run };

let today: TodayResponse;
let puzzle: DailyPuzzle;
let board: Board;
let view: 'play' | 'gallery' | 'board' = 'play';
const run: Run = { ms: 0, mistakes: 0, hints: 0 };
let runStart: number | null = null; // performance.now() while the clock is running
let started = false;

const storageKey = () => `pixel-daily:v1:${today.puzzle.day}`;
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(extra?: Partial<Saved>) {
  try {
    const s: Saved = { cells: board.encode(), ms: elapsed(), mistakes: run.mistakes, hints: run.hints, ...extra };
    localStorage.setItem(storageKey(), JSON.stringify(s));
  } catch {
    /* storage unavailable: progress simply is not kept */
  }
}

function elapsed(): number {
  return run.ms + (runStart !== null ? Math.round(performance.now() - runStart) : 0);
}
function startClock() {
  if (runStart === null && !board.solved && !document.hidden) runStart = performance.now();
}
function stopClock() {
  if (runStart !== null) {
    run.ms += Math.round(performance.now() - runStart);
    runStart = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopClock();
  else if (started) startClock();
});

// ---------- shell ----------

const shell = el('div', 'app');
const live = el('div', 'sr-only');
live.setAttribute('aria-live', 'polite');
const headEl = el('div', 'head');
const tabsEl = el('div', 'tabs');
tabsEl.setAttribute('role', 'tablist');
const mainEl = el('div');
mainEl.style.display = 'contents';
shell.append(headEl, tabsEl, mainEl, live);

function announce(text: string) {
  live.textContent = '';
  setTimeout(() => (live.textContent = text), 20);
}

function renderHead() {
  headEl.textContent = '';
  const brand = el('div', 'brand');
  const logo = el('div', 'logo');
  for (let i = 0; i < 9; i++) logo.append(el('i', [0, 4, 5, 7, 8].includes(i) ? 'on' : ''));
  logo.setAttribute('aria-hidden', 'true');
  const t = el('div');
  t.append(el('h1', undefined, `Pixel Daily ${numLabel(today.puzzle.number)}`));
  t.append(el('div', 'sub', `${today.puzzle.weekday} · ${today.puzzle.size}x${today.puzzle.size}${today.isToday ? '' : ' · past puzzle'}`));
  brand.append(logo, t);
  const chips = el('div', 'chips');
  if (today.streak.current > 0) chips.append(el('span', 'chip hot', `Streak ${today.streak.current}`));
  chips.append(el('span', 'chip', `${today.solveCount} solved`));
  headEl.append(brand, chips);
}

function renderTabs() {
  tabsEl.textContent = '';
  const defs: [typeof view, string][] = [
    ['play', 'Play'],
    ['gallery', 'Gallery'],
    ['board', 'Leaderboard'],
  ];
  for (const [id, label] of defs) {
    const b = el('button', 'tab', label);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.id = `tab-${id}`;
    b.setAttribute('aria-selected', String(view === id));
    b.addEventListener('click', () => setView(id));
    tabsEl.append(b);
  }
}

function setView(v: typeof view) {
  view = v;
  renderTabs();
  mainEl.textContent = '';
  if (v === 'play') mainEl.append(playEl);
  else if (v === 'gallery') renderGallery();
  else renderLeaderboard();
  if (v === 'play') fit();
}

// ---------- play view ----------

const playEl = el('div');
playEl.style.display = 'contents';
let stats: { time: HTMLElement; mist: HTMLElement; mistBox: HTMLElement; hint: HTMLElement };
let undoBtn: HTMLButtonElement;
let redoBtn: HTMLButtonElement;
let hintBtn: HTMLButtonElement;
let resetBtn: HTMLButtonElement;
let fillBtn: HTMLButtonElement;
let markBtn: HTMLButtonElement;
let toolbar: HTMLElement;
let nameEl: HTMLElement;
let hintLine: HTMLElement;
let resultSlot: HTMLElement;
let wrap: HTMLElement;

function statBox(label: string, value: string) {
  const s = el('div', 'stat');
  const b = el('b', undefined, value);
  s.append(b, el('span', undefined, label));
  return { s, b };
}

function buildPlay() {
  playEl.textContent = '';
  const sTime = statBox('Time', '0:00');
  const sMist = statBox('Mistakes', '0');
  const sHint = statBox('Hints', '0');
  const status = el('div', 'status');
  status.append(sTime.s, sMist.s, sHint.s);
  stats = { time: sTime.b, mist: sMist.b, mistBox: sMist.s, hint: sHint.b };

  toolbar = el('div', 'toolbar');
  const seg = el('div', 'seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Tool');
  fillBtn = el('button', undefined);
  fillBtn.type = 'button';
  fillBtn.append(el('span', 'sw'), document.createTextNode('Fill'));
  markBtn = el('button', undefined);
  markBtn.type = 'button';
  const xs = el('span', 'xs', '×');
  markBtn.append(xs, document.createTextNode('Mark'));
  fillBtn.addEventListener('click', () => setTool('fill'));
  markBtn.addEventListener('click', () => setTool('mark'));
  seg.append(fillBtn, markBtn);
  undoBtn = btn('Undo', 'ghost', () => board.undo());
  redoBtn = btn('Redo', 'ghost', () => board.redo());
  hintBtn = btn('Hint', 'ghost', () => {
    if (board.hint()) toast('Hint used: this run will not be ranked');
  });
  resetBtn = btn('Reset', 'ghost');
  let resetTimer = 0;
  resetBtn.addEventListener('click', () => {
    if (resetBtn.dataset.sure) {
      window.clearTimeout(resetTimer);
      delete resetBtn.dataset.sure;
      resetBtn.textContent = 'Reset';
      resetBtn.classList.remove('confirm');
      board.reset();
      return;
    }
    resetBtn.dataset.sure = '1';
    resetBtn.textContent = 'Sure?';
    resetBtn.classList.add('confirm');
    resetTimer = window.setTimeout(() => {
      delete resetBtn.dataset.sure;
      resetBtn.textContent = 'Reset';
      resetBtn.classList.remove('confirm');
    }, 2200);
  });
  toolbar.append(seg, undoBtn, redoBtn, hintBtn, resetBtn);

  board = new Board(puzzle, {
    onChange: () => {
      updateStats();
      save();
    },
    onMistake: () => {
      run.mistakes++;
      stats.mistBox.classList.add('bad');
      announce(`Mistake ${run.mistakes}. That cell is not part of the picture.`);
    },
    onHint: () => {
      run.hints++;
    },
    onFirstMove: () => {
      started = true;
      startClock();
    },
    onSolved: () => void onSolved(),
  });

  wrap = el('div', 'board-wrap');
  wrap.append(board.frame);
  nameEl = el('div', 'pic-name');
  hintLine = el(
    'p',
    'hint-line',
    'Tap to fill, drag to paint a run, long-press or right-click to mark. Arrow keys, Space and X also work.'
  );
  resultSlot = el('div');
  resultSlot.style.display = 'contents';
  playEl.append(status, toolbar, wrap, nameEl, hintLine, resultSlot);
  setTool('fill');
  updateStats();
}

function setTool(t: 'fill' | 'mark') {
  board.tool = t;
  fillBtn.setAttribute('aria-pressed', String(t === 'fill'));
  markBtn.setAttribute('aria-pressed', String(t === 'mark'));
}

function updateStats() {
  stats.time.textContent = formatTime(elapsed());
  stats.mist.textContent = String(run.mistakes);
  stats.hint.textContent = String(run.hints);
  undoBtn.disabled = !board.canUndo();
  redoBtn.disabled = !board.canRedo();
  hintBtn.disabled = board.solved;
  resetBtn.disabled = board.solved;
  toolbar.classList.toggle('done', board.solved);
}

setInterval(() => {
  if (runStart !== null && stats) stats.time.textContent = formatTime(elapsed());
}, 250);

function fit() {
  if (!board) return;
  const w = wrap.clientWidth || shell.clientWidth || window.innerWidth;
  board.layout(w);
}
window.addEventListener('resize', fit);

// ---------- solve ----------

async function onSolved() {
  stopClock();
  const finalRun: Run = { ms: Math.max(run.ms, 1), mistakes: run.mistakes, hints: run.hints };
  save({ solved: finalRun });
  updateStats();
  board.reveal(true);
  hintLine.remove();
  announce(`Solved! It was ${puzzle.picture.name}.`);
  window.setTimeout(() => {
    nameEl.textContent = '';
    const s = el('span');
    s.append(document.createTextNode(puzzle.picture.name), el('small', undefined, 'Picture revealed'));
    nameEl.append(s);
    launchConfetti();
  }, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 700 + puzzle.size * 60);
  await sendResult(finalRun);
}

async function sendResult(r: Run) {
  try {
    const res = await submit({ cells: board.filledList(), ms: r.ms, mistakes: r.mistakes, hints: r.hints });
    today = { ...today, streak: res.streak, strip: res.strip, solveCount: res.solveCount, histogram: res.histogram, result: res.saved ? res.result : today.result };
    renderHead();
    renderResultCard(res);
  } catch (e) {
    resultSlot.textContent = '';
    const card = el('div', 'card');
    card.append(el('h2', undefined, 'Solved, but the result did not save'));
    card.append(el('p', 'lead', e instanceof Error ? e.message : 'Network problem.'));
    card.append(btn('Try saving again', 'primary', () => void sendResult(r)));
    resultSlot.append(card);
  }
}

function stat(label: string, value: string, extra = '') {
  const s = el('div', `stat ${extra}`.trim());
  s.append(el('b', undefined, value), el('span', undefined, label));
  return s;
}

function histogramEl(counts: number[], mineMs: number | null): HTMLElement {
  const labels = bucketLabels(puzzle.size);
  const max = Math.max(1, ...counts);
  const mine = mineMs === null ? -1 : bucketIndex(mineMs);
  const h = el('div', 'hist');
  h.setAttribute('role', 'img');
  h.setAttribute('aria-label', `How everyone did: ${counts.map((c, i) => `${labels[i]} ${c}`).join(', ')}`);
  counts.forEach((c, i) => {
    const b = el('div', `bar${i === mine ? ' me' : ''}`);
    if (c > 0) b.append(el('em', undefined, String(c)));
    const bar = el('i');
    bar.style.height = `${Math.max(3, Math.round((c / max) * 58))}px`;
    b.append(bar, el('span', undefined, labels[i]!));
    h.append(b);
  });
  return h;
}

function bucketIndex(ms: number): number {
  return bucketFor(puzzle.size, ms);
}

function stripEl(strip: StripDay[]): HTMLElement {
  const s = el('div', 'strip');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `Last 14 days: ${strip.filter((d) => d.solved).length} solved`);
  strip.forEach((d, i) => {
    const c = el('div', `d${d.solved ? ' on' : ''}${i === strip.length - 1 ? ' today' : ''}`, DAY_NAMES[weekday(d.day)]!.slice(0, 1));
    c.title = d.day;
    s.append(c);
  });
  return s;
}

function renderResultCard(res: SubmitResponse) {
  resultSlot.textContent = '';
  const r = res.result;
  const card = el('div', 'card');
  card.id = 'result-card';
  card.append(el('h2', undefined, res.saved ? (res.improved ? 'Solved! Result saved' : 'Solved again (your best time stands)') : 'Solved!'));
  const g = el('div', 'grid4');
  g.append(stat('Time', formatTime(r.ms)), stat('Mistakes', String(r.mistakes)), stat('Hints', String(r.hints)), stat('Rank', res.rank ? `#${res.rank}` : r.hints > 0 ? 'unranked' : '-'));
  card.append(g);
  if (!res.saved) {
    card.append(el('p', 'lead', 'You are not logged in, so this run is not saved to the leaderboard, your streak or your gallery.'));
    card.append(btn('Log in to save', 'primary', () => promptLogin()));
  } else if (r.hints > 0) {
    card.append(el('p', 'lead', 'You used hints, so this run is saved to your gallery and streak but is not ranked. Time is client-reported.'));
  }
  const chips = el('div', 'chips');
  chips.append(el('span', 'chip hot', `Streak ${res.streak.current}`), el('span', 'chip', `Best ${res.streak.best}`), el('span', 'chip', `${res.solveCount} solved today`));
  card.append(chips);
  card.append(el('div', 'label', 'Last 14 days'), stripEl(res.strip));
  card.append(el('div', 'label', 'How everyone did'), histogramEl(res.histogram, r.ms));

  const nudge = el('div', 'nudge');
  nudge.append(el('b', undefined, 'What is it?'));
  nudge.append(el('p', undefined, 'Tell the comments what you saw in the picture. Describe it, do not name it, so the next solver keeps the surprise.'));
  nudge.append(btn('Go to the comments', 'ghost', () => openComments(today.postId)));
  card.append(nudge);

  const summary = emojiSummary({ number: puzzle.number, size: puzzle.size, ms: r.ms, mistakes: r.mistakes, hints: r.hints, streak: res.streak.current });
  card.append(el('div', 'label', 'Spoiler-free summary'), el('div', 'share-box', summary));
  const actions = el('div', 'row');
  actions.append(
    btn('Copy summary', '', async () => {
      toast((await copyText(summary)) ? 'Copied' : 'Could not copy');
    })
  );
  if (res.saved) {
    const share = btn('Share as comment', '');
    let armed = false;
    share.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        share.textContent = `Post as u/${today.username ?? 'you'}? Tap again`;
        share.classList.add('primary');
        window.setTimeout(() => {
          if (share.disabled) return;
          armed = false;
          share.textContent = 'Share as comment';
          share.classList.remove('primary');
        }, 4000);
        return;
      }
      share.disabled = true;
      try {
        const out = await shareComment();
        share.textContent = 'Comment posted';
        toast(out.message);
      } catch (e) {
        share.disabled = false;
        armed = false;
        share.textContent = 'Share as comment';
        toast(e instanceof Error ? e.message : 'Could not post');
      }
    });
    actions.append(share);
  }
  card.append(actions);
  const nav = el('div', 'row');
  nav.append(btn('My gallery', '', () => setView('gallery')), btn('Leaderboard', '', () => setView('board')));
  card.append(nav);
  resultSlot.append(card);
  card.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

// ---------- gallery ----------

function drawPicture(canvas: HTMLCanvasElement, pic: Picture, px = 8) {
  const n = pic.size;
  canvas.width = n * px;
  canvas.height = n * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const c = colorOf(pic.rows[y]![x]!);
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
}

function renderGallery() {
  const card = el('div', 'card');
  card.append(el('h2', undefined, 'Your gallery'));
  card.append(el('p', 'lead', 'Pictures you have uncovered from past days, with how many people solved each one. Come back daily to fill it.'));
  const holder = el('div');
  holder.append(el('div', 'empty', 'Loading...'));
  card.append(holder);
  mainEl.append(card);
  getGallery()
    .then((g: GalleryResponse) => {
      holder.textContent = '';
      if (!g.loggedIn) {
        holder.append(el('div', 'empty', 'Log in to keep a gallery of the pictures you solve.'));
        holder.append(btn('Log in', 'primary', () => promptLogin()));
        return;
      }
      card.querySelector('h2')!.textContent = `Your gallery (${g.totalSolved} picture${g.totalSolved === 1 ? '' : 's'})`;
      const grid = el('div', 'gallery');
      for (const it of g.items) {
        const p = puzzleForDay(it.day).picture;
        const tile = el('div', `tile${it.result ? '' : ' locked'}`);
        if (it.result) {
          const cv = el('canvas');
          cv.setAttribute('role', 'img');
          cv.setAttribute('aria-label', `${p.name}, solved`);
          drawPicture(cv, p, Math.max(4, Math.floor(96 / p.size)));
          tile.append(cv, el('b', undefined, p.name), el('small', undefined, `${numLabel(it.number)} · ${it.size}x${it.size} · ${formatTime(it.result.ms)}`));
        } else {
          const ph = el('div', 'ph', '?');
          ph.setAttribute('role', 'img');
          ph.setAttribute('aria-label', 'Not solved yet');
          tile.append(ph, el('b', undefined, numLabel(it.number)), el('small', undefined, `${it.size}x${it.size} · not solved`));
        }
        tile.append(el('small', undefined, `${it.solvers} solver${it.solvers === 1 ? '' : 's'}`));
        grid.append(tile);
      }
      holder.append(grid);
      if (!g.items.length) holder.append(el('div', 'empty', 'Nothing here yet. Solve today to start your gallery.'));
    })
    .catch((e) => {
      holder.textContent = '';
      holder.append(el('div', 'empty', e instanceof Error ? e.message : 'Could not load the gallery.'));
    });
}

// ---------- leaderboard ----------

function renderLeaderboard() {
  const card = el('div', 'card');
  card.append(el('h2', undefined, `${numLabel(today.puzzle.number)} leaderboard`));
  card.append(el('p', 'lead', 'Fastest time first, then fewest mistakes. Runs with hints are not ranked. Times are reported by the game client and checked only against the real solution.'));
  const holder = el('div');
  holder.append(el('div', 'empty', 'Loading...'));
  card.append(holder);
  mainEl.append(card);
  getLeaderboard()
    .then((lb: LeaderboardResponse) => {
      holder.textContent = '';
      if (!lb.entries.length) {
        holder.append(el('div', 'empty', 'Nobody has a ranked solve yet. Be the first.'));
        return;
      }
      const ul = el('ul', 'lb');
      const row = (e: { rank: number; username: string; ms: number; mistakes: number }, me: boolean) => {
        const li = el('li', me ? 'me' : '');
        li.append(el('span', 'rk', String(e.rank)), el('span', undefined, `u/${e.username}`), el('span', 't', formatTime(e.ms)), el('span', 'm', `${e.mistakes} miss`));
        return li;
      };
      for (const e of lb.entries) ul.append(row(e, e.username === today.username));
      holder.append(ul);
      if (lb.me && !lb.entries.some((e) => e.username === lb.me!.username)) {
        holder.append(el('div', 'label', 'You'));
        const ul2 = el('ul', 'lb');
        ul2.append(row(lb.me, true));
        holder.append(ul2);
      }
      holder.append(el('p', 'lead', `${lb.total} ranked solver${lb.total === 1 ? '' : 's'}`));
    })
    .catch((e) => {
      holder.textContent = '';
      holder.append(el('div', 'empty', e instanceof Error ? e.message : 'Could not load the leaderboard.'));
    });
}

// ---------- boot ----------

function showError(message: string) {
  root.textContent = '';
  const s = el('div', 'app');
  const c = el('div', 'card');
  c.append(el('h2', undefined, 'Pixel Daily'), el('p', 'lead', message), btn('Try again', 'primary', () => void boot()));
  s.append(c);
  root.append(s);
}

async function boot() {
  try {
    today = await getToday();
  } catch (e) {
    return showError(e instanceof Error ? e.message : 'Could not load today\'s puzzle.');
  }
  puzzle = puzzleForDay(today.puzzle.day);
  if (puzzle.size !== today.puzzle.size || puzzle.clues.rows.join('|') !== today.puzzle.rows.join('|')) {
    return showError('The app needs a refresh: the puzzle on the server and on this device differ.');
  }
  root.textContent = '';
  root.append(shell);
  renderHead();
  buildPlay();
  const saved = load();
  const done: Run | null = today.result ?? saved?.solved ?? null;
  if (done) {
    // Already solved: show the picture and the result card straight away.
    run.ms = done.ms;
    run.mistakes = done.mistakes;
    run.hints = done.hints;
    board.forceSolved();
    updateStats();
    setView('play');
    board.reveal(false);
    hintLine.remove();
    nameEl.textContent = '';
    const s = el('span');
    s.append(document.createTextNode(puzzle.picture.name), el('small', undefined, 'Picture revealed'));
    nameEl.append(s);
    started = true;
    fit();
    void sendResult(done);
    return;
  }
  if (saved) {
    run.ms = saved.ms;
    run.mistakes = saved.mistakes;
    run.hints = saved.hints;
    board.restore(saved.cells);
    stats.mistBox.classList.toggle('bad', run.mistakes > 0);
    updateStats();
  }
  setView('play');
  fit();
  requestAnimationFrame(fit);
}

void boot();
