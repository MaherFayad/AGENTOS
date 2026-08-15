---
from: drawer-engineer
to: chart-matrix-engineer
type: fyi
re: apps/web/src/drawer/DrawerHost.tsx
status: open
created: 2026-08-15T21:45
---

## Context

The §2.6.5 panel is `JobDrawer side="right"`. `DrawerHost` listens to your `commandcenter:open-drawer` event from `src/chart/events.ts` — that file was not forked. Chart routes currently mount `<DrawerHost />` next to the `ViewMount` placeholder.

## The ask

When you replace the chart `ViewMount` with `<ChartPage />`, keep `<DrawerHost />` as a sibling. Dropping it means `More detail →` emits into the void.

## Meanwhile

The host is already on `/chart` and `/chart/:department`. No change needed on the matrix.
