# Pixel Daily (Devvit Web)

A daily nonogram for Reddit. Plain DOM client (no React, no Vite), Hono server, Redis.

- `src/shared`: dates and PRNG (`core.ts`), nonogram solver (`solver.ts`), the 79 hand-drawn pictures (`art.ts`), the deterministic daily schedule and procedural glyph fallback (`daily.ts`), `dropped.ts` (pictures that are not logic-solvable), API types.
- `src/server`: Hono routes (`/api/*`, `/internal/*`) and Redis store.
- `src/client`: `splash.ts` (inline feed card), `game.ts` + `board.ts` (expanded game), `index.css`.
- `tools`: `build.mjs` (esbuild-wasm), `preview.mjs` (local stub API), `smoke.mjs` (jsdom), `audit.mjs` (picture audit).

Rules: every shipped puzzle must be solvable by pure line logic (tests enforce it); client and server must pick the same puzzle for a UTC day; never trust the client for the day or the answer.
