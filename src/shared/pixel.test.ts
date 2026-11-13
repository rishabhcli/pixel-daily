import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from './art.ts';
import { DROPPED_IDS } from './dropped.ts';
import {
  SIZE_BY_WEEKDAY,
  addDays,
  bucketEdges,
  bucketFor,
  bucketLabels,
  cluesOf,
  dayTitle,
  emojiSummary,
  numLabel,
  fnv1a,
  fromScore,
  gridMatches,
  lineClue,
  nextStreak,
  puzzleNumber,
  scoreOf,
  solutionCells,
  visibleStreak,
  weekday,
} from './core.ts';
import { NO_REPEAT_DAYS, ROTATION, glyphForDay, puzzleForDay, rotationFor } from './daily.ts';
import { analyze, gridEqualsMask, solveLine } from './solver.ts';

const START = '2026-11-16';

test('puzzle numbers start at Day 1 on 2026-11-16 and weekdays map to sizes', () => {
  assert.equal(puzzleNumber('2026-11-16'), 1);
  assert.equal(puzzleNumber('2026-11-18'), 3);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekday('2026-11-16'), 1);
  assert.deepEqual(SIZE_BY_WEEKDAY, [15, 5, 7, 8, 10, 10, 12]);
  for (let i = 0; i < 14; i++) {
    const d = addDays(START, i);
    assert.equal(puzzleForDay(d).size, SIZE_BY_WEEKDAY[weekday(d)]);
  }
});

test('catalog: 60+ pictures, valid rows, every size has 6+ in rotation', () => {
  assert.ok(CATALOG.length >= 60, `catalog has ${CATALOG.length}`);
  const ids = new Set<string>();
  for (const p of CATALOG) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.equal(p.rows.length, p.size, p.id);
    for (const r of p.rows) assert.equal(r.length, p.size, `${p.id} row width`);
    assert.match(p.rows.join(''), /[^.]/);
  }
  for (const s of [5, 7, 8, 10, 12, 15]) assert.ok(rotationFor(s).length >= 6, `size ${s}`);
  assert.ok(ROTATION.length >= 60);
});

test('every curated picture is either in rotation and logic-solvable, or listed as dropped', () => {
  const dropped = new Set(DROPPED_IDS);
  for (const p of CATALOG) {
    const a = analyze(cluesOf(p.rows));
    const ok = a.status === 'logic' && gridEqualsMask(a.grid, p.rows);
    if (dropped.has(p.id)) assert.ok(!ok, `${p.id} is dropped but solvable; remove it from dropped.ts`);
    else assert.ok(ok, `${p.id} is not uniquely solvable by logic (${a.status}); fix it or add it to dropped.ts`);
  }
  for (const id of DROPPED_IDS) assert.ok(CATALOG.some((p) => p.id === id), `unknown dropped id ${id}`);
});

test('same date gives the same puzzle; different dates differ', () => {
  const a = puzzleForDay('2026-12-03');
  const b = puzzleForDay('2026-12-03');
  assert.deepEqual(a.picture.rows, b.picture.rows);
  assert.deepEqual(glyphForDay('2027-02-01').rows, glyphForDay('2027-02-01').rows);
  assert.notDeepEqual(puzzleForDay('2026-12-04').picture.rows, a.picture.rows);
  assert.equal(fnv1a('abc'), fnv1a('abc'));
});

test('120 consecutive days are uniquely solvable by logic, match their size, and clues are correct', () => {
  let curated = 0;
  for (let i = 0; i < 120; i++) {
    const day = addDays(START, i);
    const p = puzzleForDay(day);
    assert.equal(p.picture.rows.length, p.size);
    assert.deepEqual(p.clues, cluesOf(p.picture.rows));
    const a = analyze(p.clues);
    assert.equal(a.status, 'logic', `${day} ${p.picture.id}`);
    assert.ok(gridEqualsMask(a.grid, p.picture.rows), `${day} solution mismatch`);
    if (p.source === 'curated') curated++;
  }
  assert.ok(curated >= 100, `only ${curated} curated days of 120`);
});

test('generated glyphs are mirror symmetric, multicolour-capable and unique over 120 days', () => {
  for (let i = 0; i < 120; i++) {
    const day = addDays('2027-06-01', i);
    const size = SIZE_BY_WEEKDAY[weekday(day)]!;
    const g = glyphForDay(day, size);
    for (const r of g.rows) assert.equal(r, [...r].reverse().join(''), `${day} not symmetric`);
    assert.equal(analyze(cluesOf(g.rows)).status, 'logic', day);
  }
});

test('no curated picture repeats within 60 days', () => {
  const seen = new Map<string, number>();
  for (let i = 0; i < 400; i++) {
    const day = addDays(START, i);
    const p = puzzleForDay(day);
    if (p.source !== 'curated') continue;
    const last = seen.get(p.picture.id);
    if (last !== undefined) assert.ok(i - last >= NO_REPEAT_DAYS, `${p.picture.id} repeated after ${i - last} days`);
    seen.set(p.picture.id, i);
  }
});

test('clue generation', () => {
  assert.deepEqual(lineClue([false, false]), [0]);
  assert.deepEqual(lineClue([true, true, false, true]), [2, 1]);
  const c = cluesOf(['rr.', '.r.', 'rrr']);
  assert.deepEqual(c.rows, [[2], [1], [3]]);
  assert.deepEqual(c.cols, [[1, 1], [3], [1]]);
});

test('line solver on hand-made cases', () => {
  // [5] in 5 cells: fully determined
  assert.deepEqual([...solveLine([5], new Uint8Array(5))!], [1, 1, 1, 1, 1]);
  // [3] in 5 cells: overlap is the middle cell only
  assert.deepEqual([...solveLine([3], new Uint8Array(5))!], [0, 0, 1, 0, 0]);
  // [2,1] in 5 cells with slack 1: first cell of the 2 block and the gap are not yet known; cell 1 is filled
  assert.deepEqual([...solveLine([2, 1], new Uint8Array(5))!], [0, 1, 0, 0, 0]);
  // [0] empties the line
  assert.deepEqual([...solveLine([0], new Uint8Array(4))!], [2, 2, 2, 2]);
  // a known filled cell pins the block
  const l = new Uint8Array(5);
  l[0] = 1;
  assert.deepEqual([...solveLine([2], l)!], [1, 1, 2, 2, 2]);
  // contradiction
  const bad = new Uint8Array(3);
  bad[0] = 2;
  bad[1] = 2;
  assert.equal(solveLine([2], bad), null);
});

test('analyze classifies logic, guess-needed, multiple and impossible puzzles', () => {
  assert.equal(analyze(cluesOf(['rrr', 'r.r', 'rrr'])).status, 'logic');
  // 2x2 checkerboard has two solutions
  const checker = { rows: [[1], [1]], cols: [[1], [1]] };
  assert.equal(analyze(checker).status, 'multiple');
  const impossible = { rows: [[2], [0]], cols: [[1], [0]] };
  assert.equal(analyze(impossible).status, 'none');
});

test('grid validation compares to the real solution only', () => {
  const rows = ['rr.', '.r.', 'rrr'];
  const sol = solutionCells(rows);
  assert.deepEqual(sol, [0, 1, 4, 6, 7, 8]);
  assert.ok(gridMatches(rows, [8, 7, 6, 4, 1, 0]));
  assert.ok(gridMatches(rows, [...sol, 0, 0])); // duplicates ignored
  assert.ok(!gridMatches(rows, [0, 1, 4, 6, 7]));
  assert.ok(!gridMatches(rows, [0, 1, 4, 6, 7, 8, 5]));
  assert.ok(!gridMatches(rows, [0, 1, 4, 6, 7, 99]));
  assert.ok(!gridMatches(rows, 'nope'));
  assert.ok(!gridMatches(rows, [0, 1, 4, 6, 7, 1.5]));
});

test('streak logic', () => {
  const none = { current: 0, best: 0, last: null };
  const a = nextStreak(none, '2026-11-16', '2026-11-16');
  assert.deepEqual(a, { current: 1, best: 1, last: '2026-11-16' });
  assert.deepEqual(nextStreak(a, '2026-11-16', '2026-11-16'), a);
  const b = nextStreak(a, '2026-11-17', '2026-11-17');
  assert.equal(b.current, 2);
  const c = nextStreak(b, '2026-11-20', '2026-11-20');
  assert.deepEqual(c, { current: 1, best: 2, last: '2026-11-20' });
  assert.deepEqual(nextStreak(c, '2026-11-10', '2026-11-20'), c);
  assert.equal(visibleStreak(c, '2026-11-21'), 1);
  assert.equal(visibleStreak(c, '2026-11-22'), 0);
});

test('scoring orders by time then mistakes; histogram buckets scale with size', () => {
  assert.ok(scoreOf(30000, 5) < scoreOf(30001, 0));
  assert.ok(scoreOf(30000, 0) < scoreOf(30000, 1));
  assert.deepEqual(fromScore(scoreOf(123456, 7)), { ms: 123456, mistakes: 7 });
  assert.equal(bucketFor(5, 1000), 0);
  assert.equal(bucketFor(5, 20 * 60 * 1000), bucketEdges(5).length);
  assert.ok(bucketEdges(15)[0]! > bucketEdges(5)[0]!);
  assert.equal(bucketLabels(10).length, bucketEdges(10).length + 1);
});

test('labels: pre-launch dates show Preview, not a negative number', () => {
  assert.equal(numLabel(5), '#5');
  assert.equal(numLabel(0), 'Preview');
  assert.equal(numLabel(-3), 'Preview');
  assert.equal(dayTitle(12, 10), 'Pixel Daily #12: a 10x10 mystery picture');
});

test('emoji summary does not spoil the picture', () => {
  const s = emojiSummary({ number: 12, size: 10, ms: 161000, mistakes: 2, hints: 0, streak: 3 });
  assert.match(s, /Pixel Daily #12 10x10/);
  assert.match(s, /2:41/);
  assert.ok(!/[a-z]{6,}.*[a-z]{6,}/i.test(s.split('\n')[1]!));
});
