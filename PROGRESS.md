# Pixel Daily build progress

- [x] Scaffold converted from React/Vite template to esbuild-wasm build (tools copied from gridlock-daily)
- [x] src/shared: core, solver, art (79 hand-drawn pictures), daily (deterministic schedule, glyph fallback), dropped list
- [x] Server: Hono routes (today, submit, leaderboard, gallery, share-comment, menu, scheduler, trigger) and Redis store
- [x] Client: splash (plain DOM clue-grid silhouette), game (board, tabs, result card, gallery, leaderboard), CSS light/dark
- [x] Preview server (127.0.0.1:5291) and jsdom smoke test
- [x] Unit tests (15), tsc client and server clean, build OK
- [x] devvit playtest r/pixel_daily_dev proved upload and install (URL: https://www.reddit.com/r/pixel_daily_dev/?playtest=pixel-daily, v0.0.1.1)
- [x] README

node_modules was installed once with `npm install --ignore-scripts` (plus jsdom as a devDependency); never deleted.

## Curated pictures dropped for ambiguity (not solvable by pure line logic)
cat-5 (guess needed), owl-7 (multiple solutions), tulip-7 (guess), bee-8 (guess), cherries-8 (guess), anchor-8 (guess), crab-10 (multiple), owl-perch-12 (guess).
They stay drawn in src/shared/art.ts and are listed in src/shared/dropped.ts; a test keeps the list honest.

## Verified after the build lane
- Browser QA of the local preview at 350px and 390px (5x5 and 15x15) and a real-mouse solve of the 5x5.
- Real Reddit run on r/pixel_daily_dev (test subreddit, private; dr-admin-approve is not installed there yet): the install post and a moderator-menu post render, the 10x10 puzzle was solved end to end with real clicks inside the Reddit webview, the server saved the result (rank, streak, histogram) and the gallery shows the picture.
- Found and fixed during that run: the gallery tile showed a negative number ("#-2") for pre-launch dates; it now uses the same label as the title ("Preview").

## Not verified
Server routes for the scheduler cron and the runAs-user share comment were not exercised on Reddit. Nobody other than the author has played it.
