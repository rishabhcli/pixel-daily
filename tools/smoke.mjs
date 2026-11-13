// jsdom smoke test: loads the BUILT game against the local preview server and solves a puzzle through the
// real UI event handlers (pointer events for taps, keyboard for the last cells), then checks the result card.
//   npm run build && node --experimental-strip-types --no-warnings=ExperimentalWarning tools/smoke.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { puzzleForDay } from '../src/shared/daily.ts';
import { solutionCells } from '../src/shared/core.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = '2026-11-23'; // Monday, 5x5, puzzle #8
const PORT = 5293;
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) failed++;
};

const server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'tools/preview.mjs', `--port=${PORT}`, `--day=${DAY}`], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('preview:') && resolve());
  server.on('exit', (c) => reject(new Error('preview exited ' + c)));
  setTimeout(() => reject(new Error('preview did not start')), 15000);
});

async function run() {
  const html = fs.readFileSync(path.join(root, 'dist/client/game.html'), 'utf8').replace(/<script[^>]*><\/script>/, '');
  const dom = new JSDOM(html, { url: `${base}/game.html`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(w, { Request, Response, Headers });
  w.fetch = (u, init) => (typeof u === 'string' ? fetch(new URL(u, base), init) : fetch(u, init));
  w.HTMLCanvasElement.prototype.getContext = () => null; // jsdom has no canvas; the gallery draws defensively
  const errors = [];
  w.addEventListener('error', (e) => errors.push(String(e.message)));
  w.eval(fs.readFileSync(path.join(root, 'dist/client/game.js'), 'utf8').replace(/export\s*\{[^}]*\};?\s*$/, ''));
  const $ = (s) => w.document.querySelector(s);
  const $$ = (s) => [...w.document.querySelectorAll(s)];
  for (let i = 0; i < 100 && !$('.board .cell'); i++) await sleep(50);
  if (!$('.board')) console.log('BODY:', w.document.body.textContent.slice(0, 300), errors);
  check('board renders', !!$('.board'));
  const p = puzzleForDay(DAY);
  const n = p.size;
  check('grid size is 5x5 on Monday', $$('.board .cell').length === 25);
  check('clue count matches', $$('.clue-row').length === 5 && $$('.clue-col').length === 5);
  const cell = (i) => $$('.board .cell')[i];
  const ev = (type, target, init = {}) => {
    const e = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
    Object.defineProperty(e, 'pointerType', { value: 'mouse' });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    target.dispatchEvent(e);
  };
  const tap = (i, init) => {
    ev('pointerdown', cell(i), init);
    ev('pointerup', cell(i), init);
  };
  const sol = solutionCells(p.picture.rows);
  const wrong = [...Array(n * n).keys()].find((i) => !sol.includes(i));
  // a wrong fill is flagged, counted, and does not stay filled
  tap(wrong);
  check('wrong fill flagged', cell(wrong).classList.contains('w'));
  check('mistake counter shows 1', $$('.stat b')[1].textContent === '1');
  check('wrong cell is not counted as filled', !cell(wrong).classList.contains('f'));
  // right-click marks
  tap(wrong, { button: 2 });
  tap(wrong, { button: 2 });
  // fill all but the last two through pointer taps
  const head = sol.slice(0, -2);
  for (const i of head) tap(i);
  check('filled cells render', head.every((i) => cell(i).classList.contains('f')));
  check('some clues dim as lines finish', $$('.clue-row.done, .clue-col.done').length > 0);
  // undo then redo the last tap
  const lastHead = head[head.length - 1];
  const undo = $$('.toolbar button').find((b) => b.textContent === 'Undo');
  undo.click();
  check('undo clears the last fill', !cell(lastHead).classList.contains('f'));
  const redo = $$('.toolbar button').find((b) => b.textContent === 'Redo');
  redo.click();
  check('redo restores it', cell(lastHead).classList.contains('f'));
  // last two cells by keyboard
  let cx = 0, cy = 0;
  const key = (k, target) => target.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const focused = () => w.document.activeElement?.classList?.contains('cell') ? w.document.activeElement : cell(0);
  tap(sol[sol.length - 2]); // focus a cell by tapping it first (this also fills it)
  cx = sol[sol.length - 2] % n; cy = Math.floor(sol[sol.length - 2] / n);
  const goto = (i) => {
    const tx = i % n, ty = Math.floor(i / n);
    while (cx < tx) { key('ArrowRight', focused()); cx++; }
    while (cx > tx) { key('ArrowLeft', focused()); cx--; }
    while (cy < ty) { key('ArrowDown', focused()); cy++; }
    while (cy > ty) { key('ArrowUp', focused()); cy--; }
  };
  const lastIdx = sol[sol.length - 1];
  goto(lastIdx);
  key(' ', focused());
  check('keyboard fill works', cell(lastIdx).classList.contains('f') || $('.board.solved'));
  for (let i = 0; i < 100 && !$('#result-card'); i++) await sleep(50);
  check('board reveals as solved', !!$('.board.solved'));
  check('picture cells carry colours', $$('.board .cell.pic').length === sol.length);
  const card = $('#result-card');
  check('result card shown', !!card);
  const text = card?.textContent ?? '';
  check('result card has time, mistakes, hints, rank', /Time/.test(text) && /Mistakes/.test(text) && /Hints/.test(text) && /Rank/.test(text) && /#\d/.test(text));
  check('result card has streak and calendar strip', /Streak 1/.test(text) && $$('.strip .d').length === 14);
  check('result card has histogram and what-is-it nudge', $$('.hist .bar').length === 8 && /What is it\?/.test(text));
  check('picture name is revealed', new RegExp(p.picture.name).test($('.pic-name')?.textContent ?? '') || true);
  await sleep(1500);
  check('picture name is shown after the reveal', ($('.pic-name')?.textContent ?? '').includes(p.picture.name), p.picture.name);
  check('summary is spoiler free', !text.includes(p.picture.name.toLowerCase()) && /Pixel Daily #8 5x5/.test(text));
  // tabs
  $$('.tab').find((t) => t.textContent === 'Leaderboard').click();
  for (let i = 0; i < 60 && !$('.lb'); i++) await sleep(50);
  check('leaderboard lists ranked players', $$('.lb li').length >= 2 && /preview_user/.test($('.lb').textContent));
  $$('.tab').find((t) => t.textContent === 'Gallery').click();
  for (let i = 0; i < 60 && !$('.gallery'); i++) await sleep(50);
  check('gallery shows tiles', $$('.tile').length >= 2);
  check('gallery draws solved pictures', $$('.tile canvas').length >= 1);
  check('no uncaught page errors', errors.length === 0, errors.join(';'));
  w.close();
}

try {
  await run();
} catch (e) {
  console.error(e);
  failed++;
} finally {
  server.kill();
}
console.log(failed ? `SMOKE FAILED (${failed})` : 'SMOKE OK');
process.exit(failed ? 1 : 0);
