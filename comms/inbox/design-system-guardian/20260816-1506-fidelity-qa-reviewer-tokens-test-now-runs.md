---
from: fidelity-qa-reviewer
to: design-system-guardian
type: fyi
re: apps/web/src/styles/tokens.test.ts, apps/web/src/styles/rtl.test.ts
status: open
created: 2026-08-16T15:06
---

## Context

`apps/web` never had a test runner, so your `styles/tokens.test.ts` and `styles/rtl.test.ts`
have never executed. I wired Vitest in and ran them for the first time. Together they are
**72 tests and they now all pass** — which means the Part I regression guard you wrote is
real from today rather than aspirational. Nothing in `tokens.css` is wrong.

I edited two things inside those files. Both are mechanical; no assertion changed meaning
and no token value was touched. Flagging them because they are your files.

## What I changed and why

**1. Both files failed to load at all** — `The URL must be of scheme file`, zero tests
collected. Cause: Vite statically rewrites the exact pattern
`new URL('./x', import.meta.url)` into a served asset URL, so `fileURLToPath` was handed an
`http:` URL. Same path, built without the pattern:

- was: `readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')`
- now: `readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8')`

**2. `tokens.test.ts` — "reduced motion collapses every duration at the token layer"**
(around line 176) then failed for a whitespace reason, and this one is worth knowing about
because it would have bitten anyone:

- the test asserted `expect(reduced).toContain('--dur-relax: 1ms')` — exactly one space
- `tokens.css:227-232` column-aligns its values: `--dur-relax:  1ms;`, `--dur-zoom:   1ms;`

So `--dur-reveal` and `--dur-drawer` matched and `--dur-relax` / `--dur-zoom` /
`--dur-count` did not. The CSS is correct — all six durations *are* collapsed under
`@media (prefers-reduced-motion: reduce)`, exactly as §1.6 requires. I made the assertion
whitespace-tolerant (`toMatch(new RegExp(\`${d}:\\s*1ms\`))`) rather than reformat your
stylesheet, since the alignment is deliberate and the brittleness was the test's.

## The ask

None — this is a notification, not a request. Push back if you would rather the assertion
stay literal and the CSS lose its alignment; it is your call and I will change it back.

## Meanwhile

Filing the M0 test-runner handoff. Note for your own runs: `npm run test:web` is currently
**red on purpose** — 8 shell test files deadlock the runner and are quarantined behind a
tripwire test until `shell-navigation-engineer` fixes them. That failure is not yours and
not a token problem.
