import { context, redis, reddit } from '@devvit/web/server';
import {
  DAY_NAMES,
  addDays,
  bucketFor,
  dayTitle,
  fromScore,
  isDayString,
  nextStreak,
  numLabel,
  scoreOf,
  utcDay,
  visibleStreak,
  weekday,
  type Streak,
} from '../../shared/core';
import { lastDays, puzzleForDay, type DailyPuzzle } from '../../shared/daily';
import type { GalleryItem, LeaderEntry, MyResult, PuzzleDto, StripDay } from '../../shared/api';

const DAY = 60 * 60 * 24;
const TTL_DAY = DAY * 400;

export const keys = {
  lb: (day: string) => `pd:lb:${day}`,
  res: (day: string) => `pd:res:${day}`,
  hist: (day: string) => `pd:hist:${day}`,
  solves: (day: string) => `pd:solves:${day}`,
  streak: (user: string) => `pd:streak:${user}`,
  gallery: (user: string) => `pd:gal:${user}`,
  posted: (day: string) => `pd:posted:${day}`,
};

export function toDto(p: DailyPuzzle): PuzzleDto {
  return {
    day: p.day,
    number: p.number,
    size: p.size,
    weekday: DAY_NAMES[weekday(p.day)]!,
    rows: p.clues.rows,
    cols: p.clues.cols,
  };
}

/** The day this request is about: the post's own day when known and not in the future, otherwise today (UTC). */
export function requestDay(): string {
  const pd = (context as unknown as { postData?: { day?: unknown } }).postData;
  if (pd && isDayString(pd.day) && pd.day <= utcDay()) return pd.day;
  return utcDay();
}

export async function currentUsername(): Promise<string | null> {
  if (!context.userId) return null;
  try {
    return (await reddit.getCurrentUsername()) ?? null;
  } catch {
    return null;
  }
}

export async function readStreak(user: string): Promise<Streak> {
  const raw = await redis.get(keys.streak(user));
  if (!raw) return { current: 0, best: 0, last: null };
  try {
    const s = JSON.parse(raw) as Streak;
    return { current: s.current | 0, best: s.best | 0, last: s.last ?? null };
  } catch {
    return { current: 0, best: 0, last: null };
  }
}

export function streakView(s: Streak) {
  return { current: visibleStreak(s, utcDay()), best: s.best };
}

export async function writeStreak(user: string, day: string): Promise<Streak> {
  const prev = await readStreak(user);
  const next = nextStreak(prev, day, utcDay());
  if (next !== prev) await redis.set(keys.streak(user), JSON.stringify(next));
  return next;
}

function parseResult(raw: string | undefined): MyResult | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as MyResult;
    return { ms: r.ms | 0, mistakes: r.mistakes | 0, hints: r.hints | 0 };
  } catch {
    return null;
  }
}

export async function readResult(day: string, user: string): Promise<MyResult | null> {
  return parseResult(await redis.hGet(keys.res(day), user));
}

export async function readHistogram(day: string, size: number): Promise<number[]> {
  const h = await redis.hGetAll(keys.hist(day));
  const out = new Array(8).fill(0) as number[];
  for (const [k, v] of Object.entries(h ?? {})) {
    const i = parseInt(k, 10);
    if (i >= 0 && i < out.length) out[i] = Math.max(0, parseInt(v, 10) || 0);
  }
  void size;
  return out;
}

export async function readSolveCount(day: string): Promise<number> {
  const v = await redis.get(keys.solves(day));
  return v ? parseInt(v, 10) || 0 : 0;
}

/** Hints beat nothing; then no hints beats hints, then faster, then fewer mistakes. */
export function isBetter(a: MyResult, than: MyResult): boolean {
  if ((a.hints > 0) !== (than.hints > 0)) return a.hints === 0;
  return scoreOf(a.ms, a.mistakes) < scoreOf(than.ms, than.mistakes);
}

export async function rankOf(day: string, user: string): Promise<number | null> {
  const r = await redis.zRank(keys.lb(day), user);
  return r === undefined ? null : r + 1;
}

export async function topEntries(day: string, n = 10): Promise<LeaderEntry[]> {
  const rows = await redis.zRange(keys.lb(day), 0, n - 1, { by: 'rank' });
  return rows.map((r, i) => ({ rank: i + 1, username: r.member, ...fromScore(r.score) }));
}

/** Records a verified solve. Returns whether the stored best improved. */
export async function recordSolve(
  day: string,
  size: number,
  user: string,
  result: MyResult
): Promise<{ improved: boolean; stored: MyResult }> {
  const previous = await readResult(day, user);
  let improved = false;
  let stored = result;
  if (!previous) {
    improved = true;
    await redis.hSet(keys.res(day), { [user]: JSON.stringify(result) });
    await redis.incrBy(keys.solves(day), 1);
    await redis.hIncrBy(keys.hist(day), String(bucketFor(size, result.ms)), 1);
  } else if (isBetter(result, previous)) {
    improved = true;
    await redis.hSet(keys.res(day), { [user]: JSON.stringify(result) });
    await redis.hIncrBy(keys.hist(day), String(bucketFor(size, previous.ms)), -1);
    await redis.hIncrBy(keys.hist(day), String(bucketFor(size, result.ms)), 1);
  } else {
    stored = previous;
  }
  if (improved) {
    if (stored.hints === 0) await redis.zAdd(keys.lb(day), { member: user, score: scoreOf(stored.ms, stored.mistakes) });
    else await redis.zRem(keys.lb(day), [user]);
    await redis.hSet(keys.gallery(user), { [day]: JSON.stringify(stored) });
  }
  for (const k of [keys.res(day), keys.hist(day), keys.solves(day), keys.lb(day)]) await redis.expire(k, TTL_DAY);
  await redis.expire(keys.gallery(user), TTL_DAY);
  return { improved, stored };
}

export async function readGalleryMap(user: string): Promise<Map<string, MyResult>> {
  const all = await redis.hGetAll(keys.gallery(user));
  const out = new Map<string, MyResult>();
  for (const [d, raw] of Object.entries(all ?? {})) {
    const r = parseResult(raw);
    if (r && isDayString(d)) out.set(d, r);
  }
  return out;
}

export async function stripFor(user: string | null, today: string): Promise<StripDay[]> {
  const days = lastDays(today, 14);
  const solved = user ? await readGalleryMap(user) : new Map<string, MyResult>();
  return days.map((day) => ({ day, solved: solved.has(day) }));
}

export async function galleryItems(user: string | null, today: string): Promise<{ items: GalleryItem[]; totalSolved: number }> {
  const solved = user ? await readGalleryMap(user) : new Map<string, MyResult>();
  const days = new Set<string>(lastDays(today, 14).filter((d) => d >= '2026-11-16'));
  for (const d of solved.keys()) if (d <= today) days.add(d);
  const sorted = [...days].sort().reverse().slice(0, 90);
  const items: GalleryItem[] = [];
  for (const day of sorted) {
    const p = puzzleForDay(day);
    items.push({ day, number: p.number, size: p.size, solvers: await readSolveCount(day), result: solved.get(day) ?? null });
  }
  return { items, totalSolved: solved.size };
}

export async function dailyPostExists(day: string): Promise<string | undefined> {
  return redis.get(keys.posted(day));
}

/** Creates the custom post for a day unless one exists already (the Redis guard makes cron retries safe). */
export async function createDailyPost(day: string, force = false) {
  const existing = await dailyPostExists(day);
  if (existing && !force) return { created: false as const, postId: existing };
  const p = puzzleForDay(day);
  const post = await reddit.submitCustomPost({
    title: dayTitle(p.number, p.size),
    entry: 'default',
    postData: { day },
    textFallback: {
      text:
        `Pixel Daily ${numLabel(p.number)} (${day}): a ${p.size}x${p.size} nonogram. Fill the grid using the number clues and a hidden pixel-art picture appears in colour. ` +
        `Open this post in the Reddit app or on new reddit to play. Everyone gets the same puzzle each UTC day. Tell the comments what you think it is, without spoilers.`,
    },
  });
  await redis.set(keys.posted(day), post.id);
  await redis.expire(keys.posted(day), TTL_DAY);
  return { created: true as const, postId: post.id };
}

export { addDays };
