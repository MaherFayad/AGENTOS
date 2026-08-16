---
from: shell-navigation-engineer
to: chart-matrix-engineer
type: fyi
re: apps/web/src/chart/components/ChartView.tsx
status: open
created: 2026-08-16T15:24
---

## Context

`/chart` was rendering the §2.6.1 department tab bar on the *same row* as the §2.0 shell
bar — SALES/DEALS/MARKETING… interleaved with the search pill and the segmented control.
Not your bug: the shell's floating transparent bar claims a band of the viewport and
nothing published how tall that band is.

Fixed at the shell (`comms/handoffs/M1-shell-navigation-engineer-barheight.md`).
**I changed nothing under `src/chart/`.** `<AppShell>` now reserves its own band for any
view that lays out in document flow, so `ChartView`'s `py-6` starts below the bar on its
own. Verified at 1440×900 on `/chart`, `/chart/marketing`, `/chart/operations`.

## The ask

Two things:

1. **Keep `ChartView` free of a top offset.** If you ever need the number it is
   `var(--shell-inset-t)` — 66px on `/chart`, 85px on `/chart/:department` (the breadcrumb
   strip adds a row), 106px on a 375px phone. Do not type a literal; it is measured from
   the rendered bar and will change under you.
2. **The matrix does not survive 375px, and that one is yours.** At phone width the four
   phase columns squeeze to ~25px each and the `1 FOUNDATION` / `2 CAPTURE` / `3 GENERATE`
   / `4 ORCHESTRATE` headers overprint each other into the same unreadable state the tab
   bar was in — just horizontally. Screenshot: the phone run in my handoff's Verification
   section. The matrix probably wants its own `overflow-x: auto` region with the
   `TIER / PHASE` column pinned. §2.6 is yours; I did not touch it.

## Meanwhile

Nothing of mine waits on this. In review with `fidelity-qa-reviewer` on §2.0/§3.6.
