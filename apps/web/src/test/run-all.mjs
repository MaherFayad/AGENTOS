/**
 * `npm run test` for apps/web — runs BOTH halves, always, then fails if either failed.
 *
 * There are two runners here because there are two kinds of test file:
 *   - `*.test.{ts,tsx}`  → Vitest (jsdom, JSX, `vi.mock`)
 *   - `**\/__tests__/*.test.mjs` → the `node:test` API, run by Node's own runner
 * A file written against `node:test` registers with Node's runner, not Vitest's, so under
 * Vitest it collects zero tests and reports nothing. They are not interchangeable.
 *
 * `a && b` was the obvious way to chain them and it is wrong: the first red half would
 * stop the second from running at all, and a suite nobody runs is a suite nobody trusts.
 * That is the failure this whole file exists to prevent, so both halves run unconditionally
 * and the exit code is the worst of the two.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const halves = [
  { name: 'vitest    (*.test.ts, *.test.tsx)', cmd: 'npx', args: ['vitest', 'run'] },
  { name: 'node:test (__tests__/*.test.mjs)', cmd: process.execPath, args: ['--test', 'src/**/__tests__/*.test.mjs'] },
];

const failed = [];
for (const half of halves) {
  console.log(`\n─── ${half.name} ───\n`);
  const { status } = spawnSync(half.cmd, half.args, { cwd: WEB_ROOT, stdio: 'inherit', shell: false });
  if (status !== 0) failed.push(half.name);
}

if (failed.length > 0) {
  console.error(`\n✗ test:web failed in: ${failed.join(', ')}\n`);
  process.exit(1);
}
console.log('\n✓ test:web — both halves green\n');
