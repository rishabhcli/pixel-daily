# Pixel Daily

A daily nonogram (picross) for Reddit, built on Devvit Web. Every UTC day the whole community gets the same grid of number clues. Fill the cells that the clues describe and a hidden pixel-art picture fades in, in colour, with its name. Then go to the comments and say what you thought it was, without spoiling it for the next solver.

Built for Reddit's Game of the Day hackathon.

## How to play

- **Fill** a cell by tapping or clicking it. **Drag** to paint a whole run in one stroke (it locks to the row or column you started in).
- **Mark** cells you know are empty with the Mark tool, a right-click, or a long-press on touch screens.
- The numbers beside a row or column are the lengths of its runs of filled cells, in order, with at least one gap between runs. A line's numbers dim once that line is complete.
- A fill that is not part of the picture turns into a red X with a gentle shake and adds a **mistake**. It never stays filled.
- **Hint** fills one correct cell. A run that used hints is saved but is not ranked.
- Undo, Redo and Reset are in the toolbar. The timer starts on your first move and pauses while the tab is hidden.
- Keyboard: arrow keys move, Space or Enter fills (or marks, with the Mark tool), X marks, Backspace clears, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.
- Light and dark themes follow your system. Reduced-motion settings turn off the shake, pop, reveal fade and confetti. It works from about 350px wide up to desktop and makes no external network calls, fonts or image downloads.

When you solve it, the grid cross-fades into the colour picture, its name appears, and a result card shows your time, mistakes, hints, rank, streak, a 14-day calendar strip, a histogram of how everyone did, and a copyable summary that does not spoil the picture. "Share as comment" posts that summary from your own account, only after a second explicit tap.

## Daily content

- The grid size follows the weekday: Mon 5x5, Tue 7x7, Wed 8x8, Thu 10x10, Fri 10x10, Sat 12x12, Sun 15x15.
- Puzzle number is the number of days since 2026-11-16 (Day 1). Dates before launch show as "Preview".
- **Curated catalog:** 79 pictures drawn by hand for this project (animals, food, objects, space and game-style icons, symbols), at sizes 5, 7, 8, 10, 12 and 15. They are written as palette letters plus ASCII rows in `src/shared/art.ts`. Many are drawn as a mirrored half to keep them tidy. No logos, no text.
- **Procedural fallback:** if no curated picture is available for a size (see the 60-day rule below), a mirror-symmetric multicolour glyph is generated from the date seed, with a generated name.
- **Deterministic selection:** a seeded PRNG over an FNV-1a hash of the UTC date picks the picture. The schedule is simulated from launch day forward, so a curated picture never repeats within 60 days, and the client and the server always agree on the puzzle.
- **Uniqueness:** a puzzle is only shipped if its clues can be solved completely by pure line logic (`src/shared/solver.ts`): each line is solved by trying every arrangement of its runs against the known cells, rows and columns are repeated until nothing changes, and a bounded backtracking search classifies anything that line logic cannot finish (unique but needs a guess, several solutions, or none). Pictures that fail are listed in `src/shared/dropped.ts` and excluded from the rotation. Unit tests check every curated picture and 120 consecutive days of puzzles, and generated glyphs for 120 more days. Eight drawn pictures are currently dropped (cat-5, owl-7, tulip-7, bee-8, cherries-8, anchor-8, crab-10, owl-perch-12); the other 71 are in the rotation.

## Leaderboard, streaks, gallery

- **Leaderboard** (Redis sorted set per day): fastest time first, then fewest mistakes. Runs with hints are not ranked. **The time is reported by the game client**, so it can be faked; the server only verifies that the submitted set of filled cells exactly equals its own solution for that day, rejects anything else, and stores each player's best result per day.
- **Day handling:** the server never trusts a client-supplied day. It uses the post's stored day when that is not in the future, otherwise the current UTC day.
- **Streaks:** solving today's puzzle extends your streak when you also solved yesterday's, otherwise it restarts at 1. Solving an older post does not change the streak. A missed day shows as 0.
- **Calendar strip:** the last 14 days with the days you solved filled in.
- **Gallery:** a tab listing pictures from past days that you have solved (stored per user in Redis), with each day's solver count and your time, plus the recent days you have not solved yet as "?" tiles. Pictures are drawn on a canvas with crisp pixels.
- **Histogram:** per-day solve-time buckets (scaled to the grid size), with your bucket highlighted.

## Reddit features used

- Devvit Web custom post with an inline splash (plain DOM, fast) and an expanded game view.
- Scheduler cron at 00:05 UTC posts the daily puzzle. A per-day Redis key makes retries safe.
- `onAppInstall` trigger posts the first puzzle. A moderator menu item creates a post on demand.
- Post titles carry the number, size and a teaser, for example "Pixel Daily #12: a 10x10 mystery picture". Posts have a text fallback for clients that cannot run the app.
- Redis for leaderboards, per-day results, histograms, streaks and galleries.
- `reddit.submitComment` with `runAs: 'USER'` for the optional share button (needs the `SUBMIT_COMMENT` user permission). The app never comments on its own.
- Logged-out players can play; the result card offers a login prompt (`showLoginPrompt`) instead of saving.

## Commands

```sh
export DEVVIT_DISABLE_METRICS=1
npm install --ignore-scripts      # on machines where the esbuild/Vite native binaries cannot run
npm run build                     # esbuild-wasm: dist/client/{splash,game}.html and dist/server/index.cjs
npm run test:types                # tsc, client and server
npm run test:unit                 # node --test over src/**/*.test.ts
npm run test:smoke                # build, then drive the built game in jsdom against the preview server
npm run audit:art                 # per-size report of which pictures are logic-solvable
npm run preview                   # http://127.0.0.1:5291/game.html (add -- --day=2026-12-02 to pick a day, --anon for logged out)
npm run dev                       # devvit playtest <subreddit>
npm run deploy                    # types + unit tests + build + devvit upload
```

The preview server stubs the Devvit API in memory with a few demo players, so it needs no Reddit connection.

## Project layout

```
src/shared/core.ts      dates, seeded PRNG, clues, streaks, scoring, histogram buckets, share text
src/shared/solver.ts    line solver + bounded backtracking classifier
src/shared/art.ts       the hand-drawn picture catalog (and its small text format)
src/shared/dropped.ts   pictures excluded from rotation
src/shared/daily.ts     deterministic schedule, 60-day no-repeat rule, procedural glyph fallback
src/shared/api.ts       request/response types
src/server/             Hono routes (api, menu, scheduler, triggers) and the Redis store
src/client/             splash.ts, game.ts, board.ts, host.ts (Devvit wrappers), index.css
tools/                  build.mjs, preview.mjs, smoke.mjs, audit.mjs
devvit.json             app config
```

## Credits and honesty

Built by Rishabh Bansal with AI coding assistance (Claude Code) and the Devvit documentation. The pixel pictures were drawn for this project. This README makes no claims about players, hours spent or awards. The leaderboard time is client-reported, as described above.

Licensed under BSD-3-Clause (see `LICENSE`).
