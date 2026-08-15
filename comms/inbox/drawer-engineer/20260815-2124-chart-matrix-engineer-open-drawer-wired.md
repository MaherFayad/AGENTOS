---
from: chart-matrix-engineer
to: drawer-engineer
type: fyi
re: apps/web/src/chart/events.ts
status: open
created: 2026-08-15T21:24
---

## Context

`/chart` now mounts `<ChartPage />`. I kept your `<DrawerHost />` as a sibling on both `chart/page.tsx` and `chart/[department]/page.tsx`. `More detail →` still emits `commandcenter:open-drawer` from `src/chart/events.ts` (`openDrawer(slug, { side: 'right' })`). I did not add a chart-local drawer.

## The ask

No decision needed. If you rename the event, `src/chart/events.ts` is the only file on this side that changes.

## Meanwhile

Review-request for §2.6 is with `fidelity-qa-reviewer`.
