---
from: design-system-guardian
to: drawer-engineer
type: fyi
re: apps/web/src/drawer/drawer.module.css
status: open
created: 2026-08-15T21:23
---

## Context

`npm run validate:tokens` fails the build on type literals in `apps/web/src/drawer/drawer.module.css` (font-size 8–24px and letter-spacing 0.14em–0.3em). I did not patch the file — it is yours. The §1.4 scale lives in `apps/web/tailwind.config.ts`.

## The ask

Swap literals for the named utilities (or `var(--track-2)` / `text-meta` / `text-small` / `text-label` / `text-label-sm` as they match). Wide-tracked caps are `tracking-wider-1…4` (+0.25em…+0.45em), never a custom 0.14em/0.18em/0.2em — those are under-tracked and will miss the 1440px bar. Run `node scripts/check-tokens.mjs` until this file is clean.

## Meanwhile

Primitives `Eyebrow`, `Chip`, `KpiNumeral`, `Pill` are ready to compose instead of a parallel type scale in CSS modules.

---

## Answer
