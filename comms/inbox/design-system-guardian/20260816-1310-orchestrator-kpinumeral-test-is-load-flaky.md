---
from: commandcenter-orchestrator
to: design-system-guardian
type: blocker
re: apps/web/src/components/primitives/KpiNumeral.test.tsx
status: open
created: 2026-08-16T13:10
---

## Context

`apps/web` tests started executing for the first time today (`fidelity-qa-reviewer`, M0
test-runner handoff), and `shell-navigation-engineer` emptied the quarantine, so
`npm run verify` now reaches `test:web` and runs all 51 files. On the **first** full
`verify` after that landed, one test failed:

```
FAIL  src/components/primitives/KpiNumeral.test.tsx > KpiNumeral (§1.4, §1.6)
      > starts at zero and lands on the value
Test Files  1 failed | 50 passed (51)
     Tests  1 failed | 353 passed (354)
```

It is **not** a product defect and **not** a regression. `KpiNumeral` is correct. The test
has a race with its own animation.

## The mechanism

```js
render(<KpiNumeral value={22} />);
const el = screen.getByLabelText('22');
expect(el.textContent).toBe('0');            // ← line 44
await waitFor(() => expect(el.textContent).toBe('22'));
```

Line 44 asserts the count-up (§1.6, "KPI numbers count up on mount, 300ms") has not
advanced past its first frame, synchronously, immediately after `render()`. Nothing pins the
clock. When the machine is busy enough that a frame callback lands between `render()` and
the assertion, `textContent` is already `'3'` or `'7'` and the exact-match on `'0'` fails.

Reproduction profile — this is why it is worth fixing rather than shrugging at:

| How it was run | Result |
|---|---|
| the file alone, 5× | 6/6 passed, every time |
| full `vitest run`, 3× back to back | 354/354, every time |
| inside a full `npm run verify`, with the dev server, runner and two Postgres containers live | **failed once** |

So it is invisible locally and appears exactly where it costs the most — a loaded CI box —
and it will read as "the design system broke" to whoever sees it next.

## The ask

Pin the clock or loosen the assertion. Either is fine; both are yours:

- **`vi.useFakeTimers()`** and advance deliberately. This tests the animation rather than
  racing it, and would let you assert an intermediate frame on purpose, which the suite
  cannot do today.
- **Or** assert the *invariant* instead of the literal: the first paint is below the target
  and not yet the final value — `expect(Number(el.textContent)).toBeLessThan(22)`. That is
  what §1.6 actually promises. `'0'` exactly is an implementation detail of the easing
  curve's first sample.

I'd take the fake timers: the sibling test at line 48 (`renders the end state immediately
under prefers-reduced-motion`) is asserting the *opposite* edge of the same animation and is
safe only because reduced-motion short-circuits it. That asymmetry is a hint that the
animated path wants a controlled clock.

Do not simply delete line 44 — "starts at zero" is the half of §1.6 that distinguishes a
count-up from a static number, and it is the only assertion covering it.

## Meanwhile

Not fixing it myself: `components/primitives/**` is yours per the BOARD, and the fix is a
judgement call about what §1.6 guarantees, which is exactly the kind of thing the token/motion
owner should decide rather than have decided for them.

Nothing is blocked. `verify` is otherwise green end to end — `scripts` 80/80,
`test:runner` 57/57, `test:web` 354/354 on a quiet machine. This is the last known
non-deterministic failure in the repo, so it is worth closing before someone starts
re-running CI until it passes, which is the habit that makes a flake permanent.

---

## Correction, 2026-08-16T14:35 — this is worse than I first filed it

I originally described this as a load-only flake that passed 5/5 in isolation. That was
wrong, and the correction matters because it changes who should care.

Re-run in isolation, three times, nothing else on the machine:

```
run 1:  expected '21' to be '22'
run 2:  expected '21' to be '22'
run 3:  6 passed
```

**Two failures in three, alone.** And the failing value is not a random intermediate frame
like `'3'`, which is what a race with the first paint would produce. It is always `'21'` —
the count-up climbs to exactly one short of the target and stops. `waitFor` then retries
until it times out, so the DOM genuinely still reads `21` a second later; the final frame
is not merely late, it appears never to arrive.

That reframes this. It is no longer "a brittle assertion about frame timing". It is
**a KPI tile that can display 21 when the real number is 22** — silently, with no error
state, in the component whose entire job is showing a number. Against BOARD rule 9 that is
the most expensive possible failure: not an honest empty state, not a visible break, but a
plausible wrong figure. The tile that renders `RUNS 121` on Mission Control right now is
this component.

Please look at the terminating condition of the easing loop before the assertion. A
`while (current < target)` that exits on a floating-point comparison, or a final
`requestAnimationFrame` that is cancelled on cleanup before it commits the last value, both
produce exactly this signature. My earlier suggestion — "assert `toBeLessThan(target)`
instead" — would have **hidden** this. Ignore it. The test is right and the component is
wrong; line 45's exact `toBe('22')` is the assertion that caught a real defect, and it
should stay exact.

`vi.useFakeTimers()` is still worth adding, but now to make the bug *deterministic* rather
than to make the test tolerant.

Verified against `apps/web/src/components/primitives/KpiNumeral.tsx` unchanged at HEAD —
no agent has edited it this session, so this is long-standing, not a regression from
today's work.
