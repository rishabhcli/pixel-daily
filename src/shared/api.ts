export type PuzzleDto = {
  day: string;
  number: number;
  size: number;
  weekday: string;
  rows: number[][];
  cols: number[][];
};

export type MyResult = { ms: number; mistakes: number; hints: number };

export type StripDay = { day: string; solved: boolean };

export type LeaderEntry = { rank: number; username: string; ms: number; mistakes: number };

export type TodayResponse = {
  type: 'today';
  puzzle: PuzzleDto;
  isToday: boolean;
  loggedIn: boolean;
  username: string | null;
  result: MyResult | null;
  streak: { current: number; best: number };
  strip: StripDay[]; // last 14 days ending today
  solveCount: number;
  histogram: number[]; // bucket counts, see bucketFor() in core.ts
  postId: string | null;
};

export type SubmitRequest = { cells: number[]; ms: number; mistakes: number; hints: number };

export type SubmitResponse = {
  type: 'submit';
  saved: boolean; // false for logged-out players
  improved: boolean;
  result: MyResult;
  rank: number | null; // null when hints were used or logged out
  streak: { current: number; best: number };
  strip: StripDay[];
  solveCount: number;
  histogram: number[];
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  day: string;
  entries: LeaderEntry[];
  me: LeaderEntry | null;
  total: number;
};

export type GalleryItem = {
  day: string;
  number: number;
  size: number;
  solvers: number;
  result: MyResult | null; // null = not solved by this player
};

export type GalleryResponse = {
  type: 'gallery';
  loggedIn: boolean;
  totalSolved: number;
  items: GalleryItem[]; // newest first, includes recent unsolved days
};

export type ShareCommentResponse = { type: 'share-comment'; ok: boolean; message: string };

export type ErrorResponse = { status: 'error'; message: string };
