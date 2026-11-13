// Inline splash: vanilla DOM, no catalog, so it paints fast in the feed.
import './index.css';
import { getToday } from './api';
import { expand } from './host';
import { formatTime, numLabel } from '../shared/core';
import type { TodayResponse } from '../shared/api';

const root = document.getElementById('root')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A tiny blank nonogram with the real clue numbers: a silhouette of the puzzle, not a spoiler. */
function preview(t: TodayResponse): HTMLElement {
  const n = t.puzzle.size;
  const maxR = Math.max(...t.puzzle.rows.map((r) => r.length));
  const maxC = Math.max(...t.puzzle.cols.map((c) => c.length));
  const rw = Math.max(1.2, maxR * 0.75);
  const ch = Math.max(1.2, maxC * 0.85);
  const pv = el('div', 'pv');
  pv.setAttribute('role', 'img');
  pv.setAttribute('aria-label', `Preview of today's ${n} by ${n} puzzle clues`);
  const pc = el('div', 'pc');
  pc.style.gridTemplateColumns = `${rw}fr repeat(${n}, 1fr)`;
  pc.style.gridTemplateRows = `${ch}fr repeat(${n}, 1fr)`;
  pc.append(el('div', 'z'));
  for (const c of t.puzzle.cols) {
    const z = el('div', 'z c');
    for (const v of c) z.append(el('span', undefined, String(v)));
    pc.append(z);
  }
  for (let y = 0; y < n; y++) {
    const z = el('div', 'z r');
    for (const v of t.puzzle.rows[y]!) z.append(el('span', undefined, String(v)));
    pc.append(z);
    for (let x = 0; x < n; x++) pc.append(el('div', `z g${(x + y) % 2 ? ' s' : ''}`));
  }
  pv.append(pc, el('div', 'q', '?'));
  const apply = () => {
    const w = pv.clientWidth - 12;
    pv.style.setProperty('--fs', String(Math.max(5, Math.min(11, Math.floor((w / (n + rw)) * 0.62)))));
  };
  requestAnimationFrame(apply);
  return pv;
}

function render(t: TodayResponse) {
  root.textContent = '';
  const wrap = el('div', 'splash');
  const info = el('div', 'info');
  info.append(el('h1', undefined, `Pixel Daily ${numLabel(t.puzzle.number)}`));
  info.append(el('div', 'meta', `${t.puzzle.weekday}'s mystery picture. Solve the ${t.puzzle.size}x${t.puzzle.size} clues to reveal it in colour.`));
  const chips = el('div', 'chips');
  if (t.result) chips.append(el('span', 'chip good', `Solved in ${formatTime(t.result.ms)}`));
  if (t.streak.current > 0) chips.append(el('span', 'chip hot', `${t.streak.current}-day streak`));
  chips.append(el('span', 'chip', `${t.solveCount} solved`));
  info.append(chips);
  const btn = el('button', 'btn primary big', t.result ? 'See your picture' : 'Play');
  btn.type = 'button';
  btn.addEventListener('click', (e) => expand(e));
  info.append(btn);
  if (!t.loggedIn) info.append(el('div', 'meta', 'Log in to save your streak and gallery.'));
  wrap.append(preview(t), info);
  root.append(wrap);
}

function renderFallback() {
  root.textContent = '';
  const wrap = el('div', 'splash');
  const info = el('div', 'info');
  info.append(el('h1', undefined, 'Pixel Daily'));
  info.append(el('div', 'meta', 'A new picture puzzle every day. Fill the grid, reveal the picture.'));
  const btn = el('button', 'btn primary big', 'Play');
  btn.type = 'button';
  btn.addEventListener('click', (e) => expand(e));
  info.append(btn);
  wrap.append(info);
  root.append(wrap);
}

// Immediate paint so the post never looks empty while the API call runs.
renderFallback();
getToday().then(render).catch(() => undefined);
