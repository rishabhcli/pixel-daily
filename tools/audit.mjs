// Audit the curated catalog: shape checks and solvability class for every picture.
//   node --experimental-strip-types --no-warnings=ExperimentalWarning tools/audit.mjs
import { CATALOG } from '../src/shared/art.ts';
import { cluesOf } from '../src/shared/core.ts';
import { analyze, gridEqualsMask } from '../src/shared/solver.ts';

const bySize = {};
const bad = [];
for (const p of CATALOG) {
  const okShape = p.rows.every((r) => r.length === p.size);
  if (!okShape) { console.log('BAD SHAPE', p.id, p.rows.map((r) => r.length).join(',')); continue; }
  const t = Date.now();
  const a = analyze(cluesOf(p.rows));
  const ok = a.status === 'logic' && gridEqualsMask(a.grid, p.rows);
  bySize[p.size] ??= { ok: 0, bad: 0 };
  bySize[p.size][ok ? 'ok' : 'bad']++;
  if (!ok) bad.push(`${p.id}:${a.status}`);
  if (Date.now() - t > 500) console.log('slow', p.id, Date.now() - t);
}
console.log(JSON.stringify(bySize));
console.log('not logic-solvable:', bad.join(' '));
console.log('total', CATALOG.length);
