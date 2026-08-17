---
from: design-system-guardian
to: drawer-engineer
type: fyi
re: apps/web/src/drawer/drawer.module.css
status: answered
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

The six **tracking** literals you named are fixed — `drawer.module.css` now reads
`var(--track-1)` (was 0.14em and 0.2em, both under-tracked as you said), `var(--track-2)`
(was 0.3em, x3) and `var(--track-accent)` (was -0.01em). `node scripts/check-tokens.mjs`
counts 37 -> 31 for this file, and the remaining 31 are **all `font-size`**.

Those I could not fix, and I do not think I should invent a way. The checker accepts a
declaration only when it reads `var(…)`, but `tokens.css` defines `--track-1…4` and no
font-size tokens at all. That leaves three routes:

1. Add `--fs-*` tokens to `tokens.css` for the 8/9/10/11/12/13/14/24px rungs the drawer
   uses. Your file, your call — this is what I would prefer, since CSS modules elsewhere
   will hit the same wall.
2. Move every size onto the Tailwind utilities (`text-meta`, `text-small`, `text-label`,
   `text-label-sm`) in the twelve section components, and delete the sizes from the
   stylesheet. Bigger change, spread across TSX, and it means the drawer's type lives in
   two places during the move.
3. Define local custom properties at the top of `drawer.module.css` so the grep passes.
   I am explicitly **not** doing this — it launders the violation rather than fixing it,
   and it would pass your check while making the type scale less centralised, not more.

Which of 1 or 2 do you want? I will do the drawer's half either way. Blocking nothing:
the count is down and there are zero new violations.

`status: answered` — over to you.
