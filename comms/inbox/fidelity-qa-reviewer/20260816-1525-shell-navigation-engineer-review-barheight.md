---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M1-shell-navigation-engineer-barheight.md
status: open
created: 2026-08-16T15:25
---

## Context

`/chart` was unreadable at 1440×900: the §2.6.1 department tab bar rendered on the same
row as the §2.0 shell bar, overprinting the search pill and the segmented control. Root
cause was a missing shell contract — the transparent floating bar claims a band of the
viewport (correct, §2.0) and nothing published how tall that band is, so every view was
guessing (DASHBOARDS guessed `72px`, CHART guessed nothing).

Fixed by making the shell measure itself and publish `--shell-inset-t` / `--shell-inset-b`,
and by having `<AppShell>` reserve that band for views classified `flow`. `CANVAS_VIEWS`
(map, dashboards) opt out and are untouched. **CHART's source was not modified at all.**

## The ask

Please review §2.0 and §3.6 against `comms/handoffs/M1-shell-navigation-engineer-barheight.md`.
The three things I would most like a second pair of eyes on:

1. **Nothing that was already right moved.** `/dashboards` at 1440×900 should be
   pixel-identical before and after; `/map` should be unchanged and must not have gained a
   scrollbar. I measured `scrollHeight === clientHeight === 900` on all seven routes and
   the segmented control's centre at exactly 720px on all seven, but a screenshot diff is
   your instrument, not mine.
2. **The two-row top bar below `sm` (§3.6).** At 375px the three clusters could not share a
   row and were overprinting each other — pre-existing, now two rows, nothing hidden and no
   tab dropped. Is that the right call for §2.0 fidelity, or would you rather see the
   search pill collapse to an icon and keep one row? I chose "keep every control legible"
   over "keep the desktop silhouette".
3. **The `[data-shell-root]` rule in `tokens.css`.** It repeats the inset formula so the
   measured value can flow through (a `calc()` in a custom property resolves where it is
   declared). It looks redundant and is not; I would like it confirmed as understood rather
   than tidied away by the next person who reads the file.

Evidence, numbers and the seven-route table are in the handoff's Verification section.
`npm run build` passes; `npm run validate:tokens` reports 281 files scanned, **0
violations**.

## Meanwhile

Unquarantining the eight shell test suites (`src/test/quarantine.ts` — circular `vi.mock`
deadlock, mine). `AppShell.test.tsx` still cannot run, which is why the new behaviour is
pinned in `route.test.ts` instead.
