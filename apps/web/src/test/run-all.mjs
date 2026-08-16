/**
 * `npm run test` for apps/web — runs BOTH halves, always, then fails if either failed.
 *
 * There are two runners here because there are two kinds of test file:
 *   - `*.test.{ts,tsx}`  → Vitest (jsdom, JSX, `vi.mock`)
 *   - `__tests__/*.test.mjs` → the `node:test` API, run by Node's own runner
 * A file written against `node:test` registers with Node's runner, not Vitest's, so under
 * Vitest it collects zero tests and reports nothing. They are not interchangeable.
 *
 * `a && b` was the obvious way to chain them and it is wrong: the first red half would
 * stop the second from running at all, and a suite nobody runs is a suite nobody trusts.
 * That is the failure this whole file exists to prevent, so both halves run unconditionally
 * and the exit code is the worst of the two.
 *
 * -----------------------------------------------------------------------------
 * TWO BUGS THIS FILE ONCE HAD. Both were found on 2026-08-16; both are the same
 * lesson, which is why they are recorded together.
 *
 * 1. IT COULD NOT RUN VITEST ON WINDOWS, AND SAID NOTHING.
 *    The vitest half used to be `spawnSync('npx', ['vitest','run'], { shell: false })`.
 *    On Windows `npx` is `npx.cmd`, and `spawnSync` without a shell cannot execute a
 *    `.cmd` — it returns `status: null` and `error.code: 'ENOENT'`. The old code only
 *    looked at `status !== 0`, so it booked the entire vitest half as FAILED, printed
 *    the section banner, printed nothing under it, and exited 1.
 *
 *    A harness that reports red when the tests are green is worse than one that reports
 *    green when they are red, because it trains everyone to ignore it. Two agents read
 *    that output and drew two different wrong conclusions from it.
 *
 *    Fixed twice over: vitest is now resolved to its real JS entrypoint and run with
 *    `process.execPath` (no shell, no `.cmd`, same on every platform), AND a spawn that
 *    cannot start is now a THIRD outcome — `could not start` — reported separately from
 *    `ran and failed`. Silence was the actual bug. Never let a half exit quietly.
 *
 * 2. THE DEVDEPENDENCIES WERE NOT INSTALLED, AND THAT ALSO LOOKED LIKE A TEST FAILURE.
 *    `vitest`, `jsdom` and `@testing-library/react` are declared in
 *    `apps/web/package.json` but were absent from `node_modules` — a partial or
 *    production install (`npm ci --omit=dev`, or an interrupted one). `npx` then silently
 *    downloaded a *different* vitest into the npx cache, which could not resolve
 *    `vitest/config` from our `vitest.config.ts` and died in config loading.
 *
 *    If you are reading this because the vitest half will not start: run `npm install`
 *    from the repo root first. The preflight below now tells you that explicitly rather
 *    than letting you debug a config error that was never the problem.
 *
 * Owner: fidelity-qa-reviewer.
 * Full account: `comms/handoffs/M1-fidelity-qa-reviewer-review-queue-burndown.md`.
 * -----------------------------------------------------------------------------
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

/**
 * Vitest's own JS entrypoint, not the `.bin` shim.
 *
 * The shim is `vitest` on POSIX and `vitest.cmd` on Windows, and `spawnSync` without a
 * shell can only execute the first. Resolving the package and reading its `bin` field
 * gives a `.mjs` path that `process.execPath` runs identically everywhere — and it works
 * whether npm hoisted the package to the repo root or kept it in the workspace.
 *
 * Returns null when the package is not installed, which is a different problem from a
 * failing test and is reported as one.
 */
function resolveVitestEntry() {
  try {
    const pkgPath = require.resolve('vitest/package.json', { paths: [WEB_ROOT] });
    const pkg = require(pkgPath);
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.vitest;
    if (!bin) return null;
    return join(dirname(pkgPath), bin);
  } catch {
    return null;
  }
}

const vitestEntry = resolveVitestEntry();

const halves = [
  {
    name: 'vitest    (*.test.ts, *.test.tsx)',
    // A null entry is handled below as `could not start`, with a real remedy attached.
    args: vitestEntry ? [vitestEntry, 'run'] : null,
    missing:
      'vitest is declared in apps/web/package.json but is not installed.\n' +
      '     Run `npm install` from the repo root. `jsdom` and `@testing-library/react`\n' +
      '     are almost certainly missing too — they arrive together, and a partial or\n' +
      '     production install (`npm ci --omit=dev`) is the usual cause.',
  },
  {
    name: 'node:test (__tests__/*.test.mjs)',
    args: ['--test', 'src/**/__tests__/*.test.mjs'],
  },
];

/** passed | failed | could-not-start — three outcomes, because two was the bug. */
function runHalf(half) {
  if (half.args === null) return { kind: 'could-not-start', why: half.missing };

  const result = spawnSync(process.execPath, half.args, {
    cwd: WEB_ROOT,
    stdio: 'inherit',
    shell: false,
  });

  // `status === null` means the process never ran — it was killed by a signal, or it never
  // spawned at all. Collapsing that into "non-zero exit" is exactly how this harness went
  // silent before, so each case gets its own sentence.
  if (result.error) {
    return {
      kind: 'could-not-start',
      why: `${result.error.code ?? 'spawn error'} — ${result.error.message}`,
    };
  }
  if (result.status === null) {
    return {
      kind: 'could-not-start',
      why: result.signal
        ? `killed by signal ${result.signal}`
        : 'the process never started and reported no error',
    };
  }
  if (result.status !== 0) return { kind: 'failed', why: `exited ${result.status}` };
  return { kind: 'passed' };
}

const results = [];
for (const half of halves) {
  console.log(`\n─── ${half.name} ───\n`);
  const outcome = runHalf(half);
  if (outcome.kind === 'could-not-start') {
    // Printed here as well as in the summary: this is the case that used to leave a blank
    // section under a banner, and a blank section is what nobody investigates.
    console.error('  !! THIS HALF DID NOT RUN. No test in it passed or failed.\n');
    console.error(`     ${outcome.why}\n`);
  }
  results.push({ half, outcome });
}

// The summary prints on every run, including the all-green one. A harness that is only
// legible when it fails is a harness whose success you are taking on trust.
console.log('\n─── summary ───\n');
const LABEL = {
  passed: 'passed       ',
  failed: 'FAILED       ',
  'could-not-start': 'DID NOT RUN  ',
};
for (const { half, outcome } of results) {
  const why = outcome.why ? `  (${outcome.why.split('\n')[0]})` : '';
  console.log(`  ${LABEL[outcome.kind]}${half.name}${why}`);
}
console.log('');

const didNotRun = results.filter((r) => r.outcome.kind === 'could-not-start');
const failed = results.filter((r) => r.outcome.kind === 'failed');

if (didNotRun.length > 0) {
  // Deliberately a distinct exit code. "The suite is red" and "the suite did not run" are
  // different facts, and CI should be able to tell them apart without parsing prose.
  console.error(
    `✗ test:web — ${didNotRun.length} of ${halves.length} halves DID NOT RUN. This is not a\n` +
      '  test failure: nothing was verified. Fix the harness or the install before you read\n' +
      '  anything else into this run.\n',
  );
  process.exit(2);
}
if (failed.length > 0) {
  console.error(`✗ test:web failed in: ${failed.map((r) => r.half.name).join(', ')}\n`);
  process.exit(1);
}
console.log('✓ test:web — both halves ran, both green\n');
