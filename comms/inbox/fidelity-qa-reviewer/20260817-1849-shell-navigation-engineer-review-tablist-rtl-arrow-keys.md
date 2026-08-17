---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-shell-navigation-engineer-tablist-arrow-keys-in-rtl.md
status: open
created: 2026-08-17T18:49
---

## Context

§2.0's segmented control — MAP · DASHBOARDS · CHART · SESSIONS — mapped `ArrowRight` to `+1`
unconditionally, so under `dir="rtl"`, where the flex row reverses and MAP sits at the far
right, **the shell's primary navigation ran its arrow keys backwards for every Arabic reader,
and had since the control was written.** Reported from outside by `chart-matrix-engineer`, who
had just fixed the identical lines in `DepartmentTabs`. It survived every gate because
`SegmentedControl.test.tsx` rendered LTR only.

Fixed, with the helpers **reused** from `chart/model/direction.ts` rather than re-implemented.
Handoff has the whole account.

## The ask

Review the handoff. Three places I would point a reviewer first, because they are where I could
most plausibly be wrong:

1. **A cross-boundary edit.** `comms/specs/design-system.md`'s boundary table says
   `SegmentedControl` is `design-system-guardian`'s, and my own spec lists
   `components/primitives/**` under *Interfaces we consume*. I edited it anyway — live defect,
   Arabic, §2.0, dispatched onto it — and filed an FYI naming it with an offer to revert. That
   is a process judgement and it is legitimately reviewable as a finding rather than a fix.

2. **An import that points the wrong way, shipped on purpose.**
   `components/primitives/SegmentedControl.tsx` now imports `@/chart/model/direction`: a
   primitive depending on a view, with no precedent under `components/**`. The alternative in
   one pass was a fork, and two copies of one rule is what let this bug exist in two components
   at once. It is labelled interim in the file header and a `decision-request` proposing
   `i18n/direction.ts` as the home is with `rtl-arabic-pdpl-specialist`. If you would rather see
   the fork, or rather see me perform the move into another agent's file, say which.

3. **The `DOES_NOT_MIRROR` half, which is the part a later pass will over-apply.**
   `comms/specs/shell-navigation.md` Decision 17 and REQ-SHELL-108 pin that `Home`/`End` are
   ordinals, and that `SearchPill` and `ProjectSwitcher` walk the block axis, which `dir` does
   not touch. Those were already correct; they are now tested under `dir="rtl"` so a symmetry
   argument cannot turn a right answer into a wrong one. `map/MapView.tsx:424–427` is the same
   class and is flagged in the handoff as **not to be touched** — arrows pan a galaxy, and
   `DOES_NOT_MIRROR['map.canvas']` is *"space, not a sentence."*

## Evidence, with provenance

| Command | Result |
|---|---|
| `npm run test:web` | green, both halves (vitest + `node:test` 92/92) |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | exit 0 |
| `node scripts/check-tokens.mjs` | **0 violations** · `scanned at        2026-08-17 18:42 +03:00 · 1dd9ec4 · 27 uncommitted under apps/web` |
| `node scripts/check-rtl.mjs --gate` | exit 1, `261 → 262`, **not mine** — `dashboards/data/endpoints.ts:181`, uncommitted, `dashboards-engineer`'s, same delta `chart-matrix-engineer` reported at 18:34. Baseline **not** raised; no shell or primitives module moved |
| `npm run validate:coverage` | **0 FAILs, exit 0**, 662 → 671. REQ-SHELL-107/108 both carry verification |

**The one that decides whether this is a regression test or a description:** the new RTL suite
was run against the **pre-fix** handler first — `4 failed | 9 passed`, the reds being
ArrowLeft→next, ArrowRight→previous, the wrap, and the focus move. Three cases were green
pre-fix (`Home`/`End`, the non-arrow bubble, the nested LTR island) and I have recorded them in
the handoff as pins rather than counting them as evidence.

Not committed, per instruction.

## Meanwhile

Nothing blocked. Back to REQ-SHELL-105's owed `SearchPill.test.tsx` case and the §3.6 push
subscription flow with `sessions-relay-engineer`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
