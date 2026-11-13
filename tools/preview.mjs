// Local preview: serves dist/client and stubs the Devvit API in memory (no Reddit needed).
//   node tools/preview.mjs [--port=5291] [--day=YYYY-MM-DD] [--anon] [--no-seed]
// Open http://127.0.0.1:5291/game.html (expanded game) or /splash.html (feed card).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAY_NAMES, addDays, bucketFor, emojiSummary, gridMatches, nextStreak, scoreOf, utcDay, visibleStreak, weekday,
} from '../src/shared/core.ts';
import { lastDays, puzzleForDay } from '../src/shared/daily.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist', 'client');
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const port = Number(arg('port') ?? 5291);
// --day=YYYY-MM-DD also pretends it is that UTC day, so streaks and the calendar strip line up.
const day = arg('day') ?? utcDay();
const today = day;
const anon = process.argv.includes('--anon');
const me = 'preview_user';

const results = new Map(); // day -> Map(user -> {ms,mistakes,hints})
const resultsFor = (d) => results.get(d) ?? results.set(d, new Map()).get(d);
let streak = { current: 0, best: 0, last: null };

if (!process.argv.includes('--no-seed')) {
  // Demo-only players so the leaderboard, histogram and gallery have something to show locally.
  for (const d of lastDays(today, 14)) {
    const size = puzzleForDay(d).size;
    const base = size * size * 900;
    const m = resultsFor(d);
    m.set('demo_ada', { ms: base, mistakes: 0, hints: 0 });
    m.set('demo_linus', { ms: Math.round(base * 1.4), mistakes: 2, hints: 0 });
    m.set('demo_grace', { ms: Math.round(base * 2.2), mistakes: 1, hints: 0 });
    m.set('demo_ken', { ms: Math.round(base * 3.1), mistakes: 4, hints: 1 });
    m.set('demo_margaret', { ms: Math.round(base * 0.8), mistakes: 1, hints: 0 });
  }
  // The preview player has already solved a few earlier days so the gallery and calendar strip show up.
  for (const back of [1, 2, 3, 5, 6, 8]) {
    const d = addDays(today, -back);
    if (d >= '2026-11-16') resultsFor(d).set(me, { ms: puzzleForDay(d).size * 9000, mistakes: back % 3, hints: 0 });
  }
}

const histogram = (d) => {
  const size = puzzleForDay(d).size;
  const h = new Array(8).fill(0);
  for (const r of resultsFor(d).values()) h[bucketFor(size, r.ms)]++;
  return h;
};
const ranked = (d) =>
  [...resultsFor(d).entries()]
    .filter(([, r]) => r.hints === 0)
    .sort((a, b) => scoreOf(a[1].ms, a[1].mistakes) - scoreOf(b[1].ms, b[1].mistakes))
    .map(([username, r], i) => ({ rank: i + 1, username, ms: r.ms, mistakes: r.mistakes }));
const sv = () => ({ current: visibleStreak(streak, today), best: streak.best });
const strip = () => lastDays(today, 14).map((d) => ({ day: d, solved: !anon && resultsFor(d).has(me) }));
const dto = (p) => ({ day: p.day, number: p.number, size: p.size, weekday: DAY_NAMES[weekday(p.day)], rows: p.clues.rows, cols: p.clues.cols });
const better = (a, b) => (a.hints > 0) !== (b.hints > 0) ? a.hints === 0 : scoreOf(a.ms, a.mistakes) < scoreOf(b.ms, b.mistakes);

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const puzzle = puzzleForDay(day);
  if (url.pathname === '/api/today') {
    return json(res, 200, {
      type: 'today', puzzle: dto(puzzle), isToday: day === today, loggedIn: !anon, username: anon ? null : me,
      result: anon ? null : (resultsFor(day).get(me) ?? null), streak: anon ? { current: 0, best: 0 } : sv(),
      strip: strip(), solveCount: resultsFor(day).size, histogram: histogram(day), postId: 't3_preview',
    });
  }
  if (url.pathname === '/api/leaderboard') {
    const entries = ranked(day);
    return json(res, 200, { type: 'leaderboard', day, entries: entries.slice(0, 10), me: anon ? null : (entries.find((e) => e.username === me) ?? null), total: entries.length });
  }
  if (url.pathname === '/api/gallery') {
    const days = new Set(lastDays(today, 14).filter((d) => d >= '2026-11-16'));
    if (!anon) for (const [d, m] of results) if (m.has(me)) days.add(d);
    const items = [...days].sort().reverse().map((d) => {
      const p = puzzleForDay(d);
      return { day: d, number: p.number, size: p.size, solvers: resultsFor(d).size, result: anon ? null : (resultsFor(d).get(me) ?? null) };
    });
    return json(res, 200, { type: 'gallery', loggedIn: !anon, totalSolved: items.filter((i) => i.result).length, items });
  }
  if (url.pathname === '/api/submit' && req.method === 'POST') {
    let raw = '';
    for await (const c of req) raw += c;
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, 400, { status: 'error', message: 'Bad request' }); }
    if (!gridMatches(puzzle.picture.rows, body.cells)) return json(res, 422, { status: 'error', message: 'That grid does not match the picture. Keep going!' });
    const clamp = (v, max) => Math.min(Math.max(Math.round(Number(v) || 0), 0), max);
    const result = { ms: clamp(body.ms, 86400000), mistakes: clamp(body.mistakes, 99), hints: clamp(body.hints, 225) };
    if (anon) {
      return json(res, 200, { type: 'submit', saved: false, improved: false, result, rank: null, streak: { current: 0, best: 0 }, strip: strip(), solveCount: resultsFor(day).size, histogram: histogram(day) });
    }
    const m = resultsFor(day);
    const prev = m.get(me);
    const improved = !prev || better(result, prev);
    if (improved) m.set(me, result);
    streak = nextStreak(streak, day, today);
    const mine = m.get(me);
    const rank = mine.hints > 0 ? null : (ranked(day).find((e) => e.username === me)?.rank ?? null);
    return json(res, 200, { type: 'submit', saved: true, improved: !!improved, result: mine, rank, streak: sv(), strip: strip(), solveCount: m.size, histogram: histogram(day) });
  }
  if (url.pathname === '/api/share-comment' && req.method === 'POST') {
    const mine = resultsFor(day).get(me);
    if (!mine) return json(res, 400, { status: 'error', message: 'Solve the puzzle first.' });
    console.log('[preview] would post comment:\n' + emojiSummary({ number: puzzle.number, size: puzzle.size, ...mine, streak: sv().current }));
    return json(res, 200, { type: 'share-comment', ok: true, message: 'Comment posted (preview stub)' });
  }
  if (url.pathname === '/__reset' && req.method === 'POST') {
    resultsFor(day).delete(me);
    streak = { current: 0, best: 0, last: null };
    return json(res, 200, { ok: true });
  }
  // static
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/splash.html';
  const file = path.join(dir, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  const p = puzzleForDay(day);
  console.log(`Pixel Daily preview: http://127.0.0.1:${port}/game.html  (splash: /splash.html)`);
  console.log(`puzzle ${day} #${p.number} ${p.size}x${p.size} "${p.picture.name}" (${p.source}), ${anon ? 'logged out' : 'logged in as ' + me}`);
});
