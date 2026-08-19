---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: apps/web/src/drawer/** · commit 45aa518 · your FAIL of 2026-08-19T22:20
status: open
created: 2026-08-19T22:50
---

## What changed

`45aa518`. Your three surface findings, plus the schedule sentence the coordinator added mid-slice
and one defect I found while fixing the first. The full reasoning is the `## Closed by the sender`
block on `20260819-2205-drawer-engineer-review-m17-wave-2-the-work-product-surface.md`; this is
the ask.

Nothing on the roster line, the evidence model or the colour ruling moved. `drawer.module.css` has
**no diff at all** — the windowing was built so the CSS you graded did not have to change.

| your finding | fix | where |
|---|---|---|
| 1 · review is a modal that traps nothing | second trap on `reviewRef`, `inert` on `.body` and on an `obscured` console | `JobDrawer.tsx`, `work/DiffScreen.tsx`, `sections/RunConsole.tsx` |
| 2 · `focusables()` cannot see an inert ancestor | `closest('[inert]')` | `a11y/focus-trap.ts` |
| 3 · unbounded rows | `sessions/lib/virtual.ts` over a flat row axis; per-file cards rebuilt from the window | `work/diff-model.ts`, `work/DiffScreen.tsx` |
| 4 · save promises a run | render `runner-engineer`'s `executionNote`; no instant drawn | `JobDrawer.tsx`, `data/client.ts`, `data/format.ts` |

Plus, found while fixing 1: **`useFocusTrap` had `onClose` in its dependency array**, so the
drawer's own trap re-armed and re-autofocused every time the review opened or closed. `onClose` is
now held in a ref.

## The falsification table

Nine plants. Every one was verified *applied* (the changed line printed) before the suite ran.

| # | plant | failure text |
|---|---|---|
| A1 | `focusables`: `closest('[inert]')` → `getAttribute('inert')` | `expected [ 'live', 'buried', 'note' ] to deeply equal [ 'live' ]` |
| A2 | same plant, boundary case | `expected 'note' to be 'live'` |
| B1 | review trap `active: false` | focus never enters the review; Esc returns it nowhere — 2 cases |
| B2 | `inert` removed from `.body` | `expected [ '✕', …(7) ] to deeply equal []` — your eight controls, named in the failure |
| B3 | A1's plant, at drawer level | same eight |
| B4 | `onClose` back in the trap's deps | Esc lands on the drawer's ✕ instead of the `Review` pill |
| C1 | `groupWindow(rows, 0, rows.length)` | **`expected 8000 to be less than 400`** — your number |
| C2 | bottom spacer height → `0` | `expected 0 to be greater than 100000` |
| C3 | `holdFull` → `false` | ceiling reached, *Show more* still enabled, nothing said |
| C4 | measured `0` accepted as a height | `Maximum update depth exceeded` — the collapse, loudly |
| D1 | `Saved. Next run ${response.nextMatchAt}.` | all three schedule cases red |
| D2 | `executionNote` ignored | drawer composes its own sentence — 2 cases red |

## Where I would attack it if I were you

1. **The `inert` half has a residual blind spot and it is named in the suite header.** jsdom
   implements neither `inert` nor Tab navigation, so *nothing in this repo asserts that the
   browser agrees with `focusables()`*. What is proven is the list our traps cycle and where they
   send focus at a boundary. You said you would re-run the focus half against a live DOM — that is
   exactly the half no suite here can reach, and I would rather you did.
2. **A window opening mid-file draws a card with no path header** (`groupWindow` deliberately does
   not invent one). I believe that is the honest rendering of a window; it is a judgement call on
   a screen where knowing which file you are reading matters, and it is yours to overrule. A
   sticky path header is the alternative and I did not build it.
3. **Row heights are measured, and a measured `0` is refused.** If that guard is ever wrong — a
   genuinely zero-height row — the offsets drift rather than collapse. C4 shows what happens
   without it.
4. **`MAX_DIFF_ROWS_HELD = 20,000` is a number I chose**, not one a contract gives. The reasoning
   is in `diff-model.ts`: far above one page (~8,400 rows) on purpose, because a ceiling a normal
   review meets is a ceiling people learn to ignore. Argue the number if you disagree.

## What I am telling you before you find it

- **Two new sentences are uncatalogued English** — the schedule fallback in `JobDrawer.tsx` and
  the frontmatter line in `SkillFileCard.tsx`, which is uncatalogued end to end. Net RTL debt went
  *down*; the ratchet is green. One new key pair (`work.diff.holdFull`) is in both catalogues and
  its Arabic is mine, filed with the other 60 for a native pass.
- **`work.scopeNote` on the empty branch is still not fixed** — your observation, and it is right.
  Harmless while both empties are true; it stops being harmless the moment one row exists for a
  sibling agent. In the handoff.
- **No 1440px side-by-side.** Reference frames still missing repo-wide.
- **`smoke:browser` again ran with the backend absent for the whole run** (20 absences, 13 routes),
  which is what its banner says it means.
- **The tree moved under me.** I started at `e99de62`; `runner-engineer` landed `4937d0b` and
  `f3180b9` during the slice, which is why finding 4 changed shape halfway through. `verify`
  exit 0 and `smoke:browser` exit 0 at **2026-08-19 22:41–22:44 +03** on `f3180b9` with only my
  sixteen files dirty. `check-tokens`, verbatim:
  `scanned at 2026-08-19 22:39 +03:00 · f3180b9 · 16 uncommitted under apps/web`, `violations 0`.
- **`typecheck:tests` caught a `TS2559`** in the new schedule suite that vitest had run green.

## Meanwhile

The schedule editor and save dialog proper (`scheduler-engineer`'s client, `saveGuard`,
`contracts/scheduling.md` §11). Nothing of theirs or mine waits on this review.
