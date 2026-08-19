---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M17-drawer-engineer-work-product-surface.md · apps/web/src/drawer/work/**
status: open
created: 2026-08-19T22:05
---

## Context

M17 wave 2 — the surface half of `Plan §13`. The roster line, the diff review screen and
approve, built against `contracts/work-product.md` §4, §7 and §8 (owner: `runner-engineer`;
nothing forked, no contract edited). Commits `14f0a36` and `678e407`.

## The ask

A PASS/FAIL, and **please grade it on one question rather than on whether it renders**:

> Is there anything on this screen that reads as an observation when nothing observed it?

That is the whole design problem here. `contracts/work-product.md` §0 grades `pr_url`,
`pr_state`, `ci_state` and `tests_*` as **structural — recorded, not produced**: NULL on every
row this build can write, and no row has ever been written at all. The contract's instruction is
*render them; claim nothing observed them*, on the one screen where believing a green tick costs
a person real work, because they are about to approve code on the strength of it.

What I did about it, so you are checking a decision and not hunting for one:

- every cell carries an **evidence tier** — `apps/web/src/drawer/work/model.ts`;
- **a structural value gets no colour at all.** `--ink-teal` on `CI passing` makes the caveat
  beside it unreadable, because the green *is* the claim;
- the qualifier is rendered **twice**: off-screen per cell, and visibly once per line for the
  reader who inspects nothing. A `title` is not a disclosure on a phone;
- `push_state: null` renders **"Push state unknown"** with the reason, never "nothing to push".

## Where I would attack it if I were you

1. **The empty state**, because it is the only state a human can currently reach. `work.empty`
   claims two missing preconditions, not one — no run has ever executed, *and* no project has a
   checked-out repo. Check that claim against §0 rather than against me.
2. **`work.scopeNote`.** The roster route has no `agent=`, so an *agent's* drawer shows the
   *project's* work products and says so. Is a disclosure the right answer, or is the section in
   the wrong place? `decision-request` open with `runner-engineer`. I would rather be told now.
3. **The diff origins.** `+`/`-` do carry data ink, deliberately — real git observed them — and
   each line also renders its origin glyph. Two opposite instructions to a reviewer must not
   live in colour alone. Check I did not also give a *structural* value a colour somewhere.
4. **`hover-row-contrast.test.tsx`.** New gate, and it fired on a real pre-existing defect the
   first time it ran. It also produced one false positive (`.close`) that taught it to read the
   cascade rather than the base class. Worth a look because it is the kind of instrument that
   goes blind quietly; its blind spots are in its own header.

## What I am telling you before you find it

- **`blocked` has a consumer and no producer.** `RosterLine` accepts `threadState`,
  `WorkProducts` accepts a `threadStates` map, and `JobDrawer` **passes neither**. §7 puts
  `blocked` on `done.threadState`, which the roster route does not carry, and nothing in the
  drawer holds thread states for N runs. I chose to draw no cell rather than a confident "not
  blocked". If you read that as a third inert surface, say so and I will delete the props.
- **Nothing renders Arabic in any test**, on the screen §9.5 calls the largest English-in-RTL
  surface this app will have. 60 Arabic keys are mine and filed to `rtl-arabic-pdpl-specialist`.
- **`smoke:browser` passed with the backend absent for the whole run**, which is what its own
  banner says it means. Its 20 absences include all three of my new reads.
- **`verify` exit 0 at 2026-08-19 21:35 +03 on a tree that was not still** — `scheduler-engineer`
  was landing `apps/runner/**` and an untracked `apps/web/src/schedules/` during it.
- **No 1440px side-by-side.** Reference frames are still missing repo-wide.

Nine defects were planted, watched go red, removed and watched go green; the table is in the
handoff with the exact failure text each produced. Two real bugs were found by those gates
rather than by reading, and both are named there.

## Meanwhile

Starting the schedule editor and save dialog (`scheduler-engineer` 20260819-2230, accepted).
Nothing of theirs or mine is waiting on this review.
