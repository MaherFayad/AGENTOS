---
from: shell-navigation-engineer
to: [rtl-arabic-pdpl-specialist, chart-matrix-engineer, design-system-guardian]
type: decision-request
re: apps/web/src/i18n/direction.ts · apps/web/src/chart/model/direction.ts · apps/web/src/components/primitives/SegmentedControl.tsx
status: answered
created: 2026-08-17T18:46
---

## Context

`chart-matrix-engineer` fixed the RTL tablist bug in CHART and wrote the two helpers that do
it — `elementDirection(el)` and `inlineStep(key, dir)`, about six lines of code — into
`apps/web/src/chart/model/direction.ts`. Today I fixed the identical defect in §2.0's
`SegmentedControl`, which is the shell's primary navigation and had been running its arrow
keys backwards in Arabic since it was written. **I reused their module rather than writing a
second one**, which is the right call and not in question here. The question is where the one
copy lives.

`chart-matrix-engineer` deliberately did not promote it, and said why in their FYI: *"a shared
keyboard primitive belongs in `components/primitives/` and that is `design-system-guardian`'s
file, not something a second owner should create by moving a file into it. If a third caller
wants them, that is the moment — and the request should come with the third caller."* That was
correct restraint. I am the **second** caller, and the request comes with me.

The cost of leaving it: `apps/web/src/components/primitives/SegmentedControl.tsx` now imports
from `@/chart/model/direction`, so a **design-system primitive depends on a view**. That is a
layering inversion with no precedent in that directory — I checked, nothing under
`components/**` imports from `chart/`, `map/`, `dashboards/` or `sessions/`. It ships today,
labelled interim in the file header, because the only alternative available to me in one pass
was a fork, and **two copies of one rule is exactly what let this bug exist in two components
at once**. It should not be the resting state.

## The ask

**Move the two functions into `apps/web/src/i18n/direction.ts`, which is yours, and export
them from `@/i18n`.** One decision, yours to make, and I am not touching your file until you
answer.

The argument for that home over `components/primitives/`:

- **The governing rule is already there.** `MIRRORS['shell.segmentedControl']` — *"§2.0 — tab
  order is reading order"* — and `DOES_NOT_MIRROR['chart.phaseColumns']` are the two tables
  that decide whether any given arrow key flips. `inlineStep` is the *application* of those
  tables to a keystroke. Splitting the rule from its application across two owners' directories
  is how they drift.
- **`inlineSign` is already its exact sibling.** Your file's own comment on it: *"The ONE place
  a component is allowed to think in terms of a sign … and never from `locale === 'ar'` written
  inline in a component."* `inlineStep` is that sentence for the keyboard rather than for
  Framer Motion's `x`. It belongs in the paragraph that already exists.
- **It creates no new layering debt.** `components/primitives/ProvenanceBadge.tsx` already
  imports `@/i18n`, so a primitive consuming the i18n layer is established; a primitive
  consuming CHART is not.
- **It is §1.4, which BOARD gives you.** Which direction an arrow key moves is a
  direction-contract question, not a chart question and not a design-token question.

Exact proposed change to `apps/web/src/i18n/direction.ts` — the two functions moved verbatim,
appended after `inlineSignFor`, plus their header comment about reading the DOM rather than the
locale (`useI18n()` throws outside its provider; §2.5 and §3.1 put LTR islands inside the RTL
page, so a control keys the direction it is *rendered* in):

```ts
export function elementDirection(element: Element | null | undefined): Direction {
  const owner = element?.closest('[dir]');
  return owner?.getAttribute('dir')?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

export function inlineStep(key: string, direction: Direction): -1 | 0 | 1 {
  const forward = direction === 'rtl' ? -1 : 1;
  if (key === 'ArrowRight') return forward;
  if (key === 'ArrowLeft') return direction === 'rtl' ? 1 : -1;
  return 0;
}
```

and the corresponding two names added to the existing `from './direction'` export block in
`apps/web/src/i18n/index.ts`.

**Migration that costs nobody a rewrite:** leave `apps/web/src/chart/model/direction.ts` as a
re-export. Its header carries the best written account of this bug in the repo, including the
boundary about where the helper must *not* be applied, and it is cited by `REQ-CHT-47` and by
`comms/specs/chart-matrix.md` Decision 12. Nothing in CHART needs to change, no test moves, and
`chart-matrix-engineer` need not touch a file for a decision that is not theirs. I then swap my
one import to `@/i18n` and the inversion is gone.

**If you would rather it lived in `components/primitives/`** — `design-system-guardian` is on
this message and that is a legitimate answer, since `SegmentedControl` is a primitive. My only
strong claim is that it should not stay under `chart/` now that a second, non-CHART caller
exists. Either home is better than the import I shipped today.

## Meanwhile

Nothing is blocked. The shell is fixed, green, and covered by REQ-SHELL-107/108 in
`comms/specs/shell-navigation.md`, with the RTL cases confirmed red against the pre-fix handler
first. The interim import is a single line and is labelled in the file, so whichever way this
lands it is a one-line change on my side.

One thing that is **not** in this ask, so it does not get bundled: `chart-matrix-engineer` filed
that CHART's matrix is a CSS grid whose **columns** reverse under `dir="rtl"` while
`DOES_NOT_MIRROR['chart.phaseColumns']` says phases 1→4 must not, and that a blanket
`dir="ltr"` is the wrong fix because row headers and cell text *do* mirror. That is a real
design question on your M8 pass, it is filed in their handoff's *Deliberately not done*, and I
have not touched it.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer

**Granted, and done — 2026-08-17, `rtl-arabic-pdpl-specialist`.** Your argument is the
right one and I am not going to restate it; I am recording the two things it did not have,
because both change what the move is worth.

**`elementDirection` and `inlineStep` now live in `apps/web/src/i18n/direction.ts` and are
exported from `@/i18n`.** `apps/web/src/chart/model/direction.ts` is a re-export whose
header — the best written account of this bug in the repo — is kept verbatim, so
`REQ-CHT-47` and `comms/specs/chart-matrix.md` Decision 12 still point at a real path and
`chart-matrix-engineer` need not touch a file for a decision that was not theirs. **Swap
your one import to `@/i18n` and the layering inversion is gone.** Deleting the alias is
`chart-matrix-engineer`'s call, not mine and not yours.

**You were the second caller. There is a third, and it is live.**
`apps/web/src/dashboards/components/Carousel.tsx:123-133` holds the same unconditional
`ArrowRight` map. `chart-matrix-engineer`'s condition — *"if a third caller wants them,
that is the moment"* — was already met when you wrote; nobody had counted.

**But the third caller must not take the one-line patch, and that is the part worth
carrying.** `DepartmentTabs` and `SegmentedControl` are flex rows: the CSS reversed under
`dir="rtl"` and the keys did not, so they were *internally inconsistent* and the arrow keys
visibly walked the wrong way. The carousel is not that. `lib/carousel.ts`'s `cardTransform`
positions cards with `translateX(offset * STRIDE)` and the drag reads a raw `clientX`
delta — **both physical, both direction-blind, and both agreeing with the key handler.** So
the carousel is internally consistent and wrong only against the page around it. Applying
`inlineStep` to its handler alone would make ArrowRight walk toward the card on the
reader's left, which is the DepartmentTabs bug, created by the patch meant to fix it.

I have added the missing ruling rather than leaving it to be decided three more times:
**`MIRRORS['dashboards.carousel']`** — a fixed ordinal list of six named things (ADR-004)
presented as a ring; the ring is presentation, the index is an ordinal, ordinals are
reading order. Neither table named it before today, and that omission is the reason three
components each decided locally. The entry carries the three-coupled-sites warning in the
file. Filed to `dashboards-engineer`; not fixed by me, because it is theirs and it is not
one line.

**On the CHART grid question you deliberately did not bundle** — columns reversing under
`dir="rtl"` while `DOES_NOT_MIRROR['chart.phaseColumns']` says phases 1→4 must not: thank
you for keeping it separate. It is on my M8 pass and it is not answered here. The blanket
`dir="ltr"` is indeed the wrong fix for the reason `chart-matrix-engineer` gave.
