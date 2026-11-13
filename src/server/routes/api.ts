import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { emojiSummary, gridMatches, utcDay } from '../../shared/core';
import { puzzleForDay } from '../../shared/daily';
import type {
  ErrorResponse,
  GalleryResponse,
  LeaderboardResponse,
  MyResult,
  ShareCommentResponse,
  SubmitRequest,
  SubmitResponse,
  TodayResponse,
} from '../../shared/api';
import {
  currentUsername,
  galleryItems,
  keys,
  rankOf,
  readHistogram,
  readResult,
  readSolveCount,
  readStreak,
  recordSolve,
  requestDay,
  streakView,
  stripFor,
  toDto,
  topEntries,
  writeStreak,
} from '../core/store';

export const api = new Hono();

const fail = (message: string) => ({ status: 'error', message }) satisfies ErrorResponse;

api.get('/today', async (c) => {
  try {
    const day = requestDay();
    const puzzle = puzzleForDay(day);
    const username = await currentUsername();
    const [histogram, solveCount, result, streak, strip] = await Promise.all([
      readHistogram(day, puzzle.size),
      readSolveCount(day),
      username ? readResult(day, username) : Promise.resolve(null),
      username ? readStreak(username) : Promise.resolve({ current: 0, best: 0, last: null }),
      stripFor(username, utcDay()),
    ]);
    return c.json<TodayResponse>({
      type: 'today',
      puzzle: toDto(puzzle),
      isToday: day === utcDay(),
      loggedIn: !!username,
      username,
      result,
      streak: streakView(streak),
      strip,
      solveCount,
      histogram,
      postId: context.postId ?? null,
    });
  } catch (error) {
    console.error('today failed', error);
    return c.json(fail('Could not load the puzzle. Please try again.'), 500);
  }
});

api.post('/submit', async (c) => {
  let body: SubmitRequest;
  try {
    body = await c.req.json<SubmitRequest>();
  } catch {
    return c.json(fail('Bad request'), 400);
  }
  try {
    const day = requestDay();
    const puzzle = puzzleForDay(day);
    // The server compares the submitted grid with its own solution; the client never says what the answer is.
    if (!gridMatches(puzzle.picture.rows, body.cells)) {
      return c.json(fail('That grid does not match the picture. Keep going!'), 422);
    }
    const clamp = (v: unknown, max: number) => Math.min(Math.max(Math.round(Number(v) || 0), 0), max);
    const result: MyResult = {
      ms: clamp(body.ms, 24 * 3600 * 1000),
      mistakes: clamp(body.mistakes, 99),
      hints: clamp(body.hints, puzzle.size * puzzle.size),
    };
    const username = await currentUsername();

    if (!username) {
      const [histogram, solveCount, strip] = await Promise.all([
        readHistogram(day, puzzle.size),
        readSolveCount(day),
        stripFor(null, utcDay()),
      ]);
      return c.json<SubmitResponse>({
        type: 'submit',
        saved: false,
        improved: false,
        result,
        rank: null,
        streak: { current: 0, best: 0 },
        strip,
        solveCount,
        histogram,
      });
    }

    const { improved, stored } = await recordSolve(day, puzzle.size, username, result);
    const streak = await writeStreak(username, day);
    const [histogram, solveCount, rank, strip] = await Promise.all([
      readHistogram(day, puzzle.size),
      readSolveCount(day),
      stored.hints > 0 ? Promise.resolve(null) : rankOf(day, username),
      stripFor(username, utcDay()),
    ]);
    return c.json<SubmitResponse>({
      type: 'submit',
      saved: true,
      improved,
      result: stored,
      rank,
      streak: streakView(streak),
      strip,
      solveCount,
      histogram,
    });
  } catch (error) {
    console.error('submit failed', error);
    return c.json(fail('Could not save your result. Please try again.'), 500);
  }
});

api.get('/leaderboard', async (c) => {
  try {
    const day = requestDay();
    const username = await currentUsername();
    const entries = await topEntries(day, 10);
    let me = entries.find((e) => e.username === username) ?? null;
    if (!me && username) {
      const rank = await rankOf(day, username);
      const mine = await readResult(day, username);
      if (rank && mine && mine.hints === 0) me = { rank, username, ms: mine.ms, mistakes: mine.mistakes };
    }
    const total = await redis.zCard(keys.lb(day));
    return c.json<LeaderboardResponse>({ type: 'leaderboard', day, entries, me, total });
  } catch (error) {
    console.error('leaderboard failed', error);
    return c.json(fail('Could not load the leaderboard.'), 500);
  }
});

api.get('/gallery', async (c) => {
  try {
    const username = await currentUsername();
    const { items, totalSolved } = await galleryItems(username, utcDay());
    return c.json<GalleryResponse>({ type: 'gallery', loggedIn: !!username, totalSolved, items });
  } catch (error) {
    console.error('gallery failed', error);
    return c.json(fail('Could not load the gallery.'), 500);
  }
});

// Optional, explicit user action: post the spoiler-free summary as a comment from the player's own account.
api.post('/share-comment', async (c) => {
  try {
    const username = await currentUsername();
    const postId = context.postId;
    if (!username || !postId) return c.json(fail('Log in to share a comment.'), 401);
    const day = requestDay();
    const puzzle = puzzleForDay(day);
    const [mine, streak] = await Promise.all([readResult(day, username), readStreak(username)]);
    if (!mine) return c.json(fail('Solve the puzzle first.'), 400);
    const text = emojiSummary({
      number: puzzle.number,
      size: puzzle.size,
      ms: mine.ms,
      mistakes: mine.mistakes,
      hints: mine.hints,
      streak: streakView(streak).current,
    });
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<ShareCommentResponse>({ type: 'share-comment', ok: true, message: 'Comment posted' });
  } catch (error) {
    console.error('share-comment failed', error);
    return c.json(fail('Could not post the comment.'), 500);
  }
});
