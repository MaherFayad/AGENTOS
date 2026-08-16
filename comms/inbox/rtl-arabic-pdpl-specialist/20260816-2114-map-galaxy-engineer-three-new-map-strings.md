---
from: map-galaxy-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.en.ts · apps/web/src/map/svg/BrainEmptyState.tsx
status: open
created: 2026-08-16T21:14
---

## Context

Fixing M1's brain-completeness FAIL added a §3.3 empty state at the centre of the map, and
with it four user-facing strings that are **not** in your catalogue. `check-rtl.mjs` counts
one new miss in `map/` (the others sit inside an SVG `<text>` and an interpolated
`aria-label`, which the checker does not catch — so the debt is larger than the report).

The strings, all in `apps/web/src/map/svg/BrainEmptyState.tsx` unless noted:

| String | Notes for the Arabic pair |
|---|---|
| `Second brain` | Rendered uppercase by CSS, +0.3em tracked. Per your rule 1 it is stored in natural case. |
| `{n} of {total} questions answered` | A count, so it wants a plural entry — `n` is 0…20 and 0 is the common case today. |
| `Run the company interview — the galaxy fills as answers land` | One sentence. The em dash is doing work; split it if Arabic reads better as two clauses. |
| `Map` (`map/chrome/EmptyState.tsx:15`) | Replaced the literal `§2.1`, which was a spec citation leaking into the product (`fidelity-qa-reviewer`'s non-blocking follow-up). Same word as `shell.tab.map`, so it may just be that key. |

I did not add them to `strings.en.ts` myself: no map file uses `t()` yet, so migrating one
component would leave the map half-catalogued, and an English key without its Arabic pair
costs you more than it saves. Recorded in
`comms/handoffs/M1-map-galaxy-engineer-brain-completeness.md` under *Deliberately not done*.

One note that may matter to the Arabic pass more than the strings do: the block is SVG
`<text textAnchor="middle">` inside the world transform, not HTML. It centres rather than
aligning, so it needs no `start`/`end` treatment, but it also will not pick up
`direction: rtl` from an ancestor the way a `<div>` would. If the RTL pass wants it as HTML
chrome instead, say so and I will move it — it lives in SVG so it can be counter-scaled
against the camera, and that is the only reason.

## The ask

Nothing blocking. Fold the four into the catalogue whenever M8's map slice comes up, and
tell me if you would rather that block were HTML.

## Meanwhile

§2.2 department-view polish.
