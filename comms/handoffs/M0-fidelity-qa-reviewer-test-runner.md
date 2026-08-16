---
agent: fidelity-qa-reviewer
milestone: M0
spec: PART VI (acceptance), Part V (no component library — runner choice)
created: 2026-08-16T15:06
status: ready-for-review
---

# M0 — apps/web had 56 test files and no test runner

`apps/web` contained 56 `*.test.*` files. `apps/web/package.json` had no `test` script and
neither vitest nor jest in `devDependencies`. Root `npm run test:web` resolved through
`npm run test --workspace=apps/web --if-present` to a **silent no-op**, so `npm run verify`
reported green while all 56 files sat dead on disk.

This is the most dangerous thing I have found in this repo. Every one of those files reads
as evidence of coverage in a diff and in a handoff, and none of it was real. Several
handoffs in `comms/handoffs/` cite `apps/web` tests in their Verification section; those
citations were unbacked until today.

Nobody wrote a bad test on purpose. `vitest.config.ts` already existed and was correct in
shape, and `src/test/setup.ts` was already written against `vitest` + `@testing-library/react`
— the intent was unambiguous. The dependency install and the one-line `test` script were
simply never done, and `--if-present` made the omission invisible.

## What exists now

- `apps/web/package.json` — `vitest`, `jsdom`, `@testing-library/react` in
  `devDependencies`; `"test": "node src/test/run-all.mjs"`, plus `test:vitest` and
  `test:node` for running one half directly.
- `apps/web/vitest.config.ts` — added the `@/` → `./src` alias (31 source files import
  `@/map/...`, `@/drawer/...`; nothing resolved without it) and an `exclude` fed from the
  quarantine list. Kept the existing `esbuild.jsx: 'automatic'`, jsdom, and setup file, and
  kept the author's decision to skip `@vitejs/plugin-react` — esbuild transforms JSX fine
  and tests do not need fast-refresh.
- `apps/web/src/test/run-all.mjs` — runs both halves unconditionally, exits non-zero if
  either failed.
- `apps/web/src/test/quarantine.ts` — the 8 files excluded from collection, with owner and
  root cause.
- `apps/web/src/test/quarantine.test.ts` — the tripwire; fails while that list is non-empty.
- `package.json` (root) — `verify` now ends `&& npm run test:web`, and `test:web` lost its
  `--if-present`.

## How to use it

```bash
npm run test:web              # both halves, from the repo root
npm run test:vitest --workspace=apps/web   # *.test.ts / *.test.tsx only
npm run test:node   --workspace=apps/web   # __tests__/*.test.mjs only
```

**Two runners, on purpose.** 49 files are `*.test.{ts,tsx}` written against Vitest. 7 are
`__tests__/*.test.mjs` written against the `node:test` API. These are not interchangeable:
a `node:test` file imported by Vitest registers with Node's runner, collects zero tests, and
reports nothing — it would look like a passing empty file. Node 24's type stripping lets
`node --test` import the `.ts` modules they depend on directly, so both halves run as their
authors wrote them and neither was rewritten to suit the other.

`src/test/run-all.mjs` exists because `vitest run && node --test ...` is wrong: the first
red half stops the second from running at all. With the tripwire currently red, `&&` would
have left the 93 `node:test` assertions unverified — the exact rot this work removes.

## Contracts touched

None. No file in `comms/contracts/` changed, and no product source changed.

## The honest baseline

First-ever execution. Numbers are settled — re-run after three other agents finished
editing, and one transient failure disappeared on re-run (below).

| Half | Files | Tests |
|---|---|---|
| Vitest, passing | 42 | 312 |
| Vitest, failing | 1 | 1 — `quarantine.test.ts`, red by design |
| `node:test` (`.mjs`) | 7 | 93, all passing |
| **Hang — never collected** | **8** | **0** |

Against the original 56 files: **48 execute and pass, 8 have never run a single assertion.**

(The Vitest file count is 43 rather than 42 because two files are new: my
`quarantine.test.ts`, and `src/drawer/data/client.test.ts`, which `drawer-engineer` added
while I was running.)

## Triage of the failures

**Bucket A — real bug (routed, unfixed): the 8 shell tests.** `AppShell`,
`BreadcrumbStrip`, `ConnectionStatus`, `CostTicker`, `HelpSheet`, `SearchPill`, `ViewTabs`,
`ZoomControls` — all `.test.tsx` under `src/components/shell/`. Each declares
`vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock())`.
`test-harness.tsx:5` imports `./ShellContext`, and `ShellContext.tsx:12` imports
`usePathname` from `next/navigation` — the module being mocked. Resolving the mock awaits
`test-harness`, which is mid-evaluation awaiting the mock. Neither settles; the worker
deadlocks at import time, before collection, so no `testTimeout` catches it. I reproduced
the mechanism standalone with a 4-file minimal case, so this is not specific to these
components. `route.test.ts` is the only shell test that avoids the harness and it passes
15/15. Owner per BOARD: `shell-navigation-engineer` (§2.0). Routed
`comms/inbox/shell-navigation-engineer/20260816-1506-fidelity-qa-reviewer-shell-tests-deadlock.md`,
with the suggested fix (move the mock factories' data into a leaf module that imports
nothing from `ShellContext`/`ui`).

**Bucket B — stale test (fixed): `src/styles/tokens.test.ts`, `src/styles/rtl.test.ts`.**
Both failed to load — `The URL must be of scheme file`, zero tests collected. Vite
statically rewrites the exact pattern `new URL('./x', import.meta.url)` into a served asset
URL, so `fileURLToPath` received an `http:` URL. Rebuilt the same path as
`join(dirname(fileURLToPath(import.meta.url)), 'x')`. They then ran 72 tests with one
failure: the reduced-motion assertion used a whitespace-exact
`toContain('--dur-relax: 1ms')` while `tokens.css:227-232` column-aligns its values, so 2 of
the 5 tokens matched and 3 did not. **The CSS is correct** — every duration is collapsed
under `@media (prefers-reduced-motion: reduce)` per §1.6 — so I made the assertion
whitespace-tolerant rather than reformat the stylesheet. 72/72 now pass. Notified
`design-system-guardian`; no token value was touched.

**Bucket C — transient, not a defect: `src/drawer/run/transport.test.ts`.** Failed once
with `TransportError: Lost the connection to a run that is still going` while
`drawer-engineer` was mid-edit on `transport.ts`. Passes 1/1 on re-run, and a controlled
probe of the same code path succeeded both times. Recorded so nobody chases it.

**Not mine, but it blocks the gate: `scripts/__tests__/repo-conformance.test.mjs:127`.**
`npm run verify` never reaches `test:web` (or `test:runner`) because it stops earlier at
`npm run test`: "no secret material is committed or referenced in comms/" fails on
`comms/handoffs/M0-infra-compose-engineer-dataplane-up.md`, which contains the literal
`export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"`. That is a variable reference, not
key material, but the scanner's `ANTHROPIC_API_KEY\s*=\s*\S+` alternation cannot tell them
apart. Pre-existing, 78/79 otherwise green. Routed to `infra-compose-engineer` as a blocker;
I did not edit another agent's handoff.

## Deliberately not done

1. **Did not fix the 8 shell tests.** `components/shell/**` belongs to
   `shell-navigation-engineer`, who was actively editing `AppShell.tsx`, `SearchPill.tsx`
   and `TopBar.tsx` during my run. Fixing them would have made me the author of work I am
   the gate for, and would have collided.
2. **Did not empty the quarantine list to make the suite green.** `npm run test:web` is red
   right now and should stay red until those 8 files run. A green suite that silently skips
   8 files is the same failure I was sent to remove, one layer down.
3. **Did not touch `comms/handoffs/M0-infra-compose-engineer-dataplane-up.md`** to clear the
   secret scanner, even though `comms/handoffs/` is inside my boundary. A handoff is a
   record; quietly rewriting another agent's record is worse than a red build.
4. **Did not add `@testing-library/jest-dom`.** Grepped for its matchers
   (`toBeInTheDocument`, `toHaveAttribute`, …) — zero uses across all 56 files. The
   component tests assert through `getAttribute` and `react-dom/server`. An unused
   dependency in a repo whose Part V rule is "no component library" needs a reason, and
   there isn't one.
5. **Did not add coverage thresholds, a CI job, or a watch script.** The task was to make
   the tests run and report honestly. Coverage gates on a suite whose real number was
   unknown an hour ago would be a fabricated bar.
6. **Did not convert the 7 `.mjs` suites to Vitest.** They pass 93/93 as written. Rewriting
   working tests to unify the runner is churn, and would put me inside
   `sessions-relay-engineer`'s and `dashboards-engineer`'s files for no behavioural gain.
7. **`tsconfig.json` still excludes every test file from `tsc --noEmit`** (`**/*.test.ts`,
   `**/*.test.tsx`, `src/test/**`). So the 56 files are executed now but still not
   type-checked — a renamed export would fail at runtime rather than at typecheck. I left it
   alone because changing it will surface a fresh wave of type errors across five agents'
   live files, which is a separate piece of work that needs its own owner and its own
   milestone. **Flagging it as the next thing someone should pick up.**
8. **No fidelity review in this handoff.** No 1440px screenshot, no token grep, no motion
   timing, no a11y pass. This is infrastructure work so that my Part VI reviews can cite
   something real; it is not itself a Part VI verdict. The review queue in
   `comms/inbox/fidelity-qa-reviewer/` is untouched and still owes answers.
9. **BOARD not flipped.** Nothing here advances a milestone.

## Verification

`npm run test:web` — both halves execute:

```
─── vitest    (*.test.ts, *.test.tsx) ───
 Test Files  1 failed | 42 passed (43)
      Tests  1 failed | 312 passed (313)
─── node:test (__tests__/*.test.mjs) ───
ℹ tests 93   ℹ pass 93   ℹ fail 0
✗ test:web failed in: vitest    (*.test.ts, *.test.tsx)
EXIT=1
```

The single failure is the tripwire, verbatim:

```
FAIL src/test/quarantine.test.ts > quarantined test files > the quarantine list is empty
AssertionError: 8 test file(s) are excluded from this run and are NOT being verified by
anything. This suite is red by design until they are fixed and removed from
src/test/quarantine.ts.
  shell-navigation-engineer owns 8 excluded file(s): …
```

Baseline evidence, per file, before any fix: 49 `.ts/.tsx` files run individually under a
45s watchdog → 38 PASS, 3 FAIL, 8 HANG, 235 passing assertions. The 3 FAIL resolved to
2 stale (fixed, now 72/72) and 1 transient (passes on re-run).

`npm run typecheck` → clean across all three workspaces (`src/test/**` and `*.test.*` are
excluded by `tsconfig.json`, so the new files do not enter it).

`npm run test:runner` → 57/57 pass. `npm run verify` → stops at
`scripts/__tests__/repo-conformance.test.mjs` (78/79), which is why the last two links of
the chain were verified out of band.

## Next agent

`shell-navigation-engineer` — read
`comms/inbox/shell-navigation-engineer/20260816-1506-fidelity-qa-reviewer-shell-tests-deadlock.md`
first, then `apps/web/src/components/shell/test-harness.tsx:5` and `ShellContext.tsx:12`.
Fixing those 8 files and deleting the entry from `apps/web/src/test/quarantine.ts` turns
`npm run test:web` green.

`infra-compose-engineer` — the secret-scanner line, so `verify` can reach the end of its
own chain.

Then whoever owns item 7 above: test files are still outside `tsc`.
