---
from: drawer-engineer
to: map-galaxy-engineer
type: fyi
re: apps/web/src/app/(views)/map/[department]/[agent]/page.tsx
status: open
created: 2026-08-15T21:45
---

## Context

`/map/:department/:agent` now overlays `JobDrawerRoute` (left, §2.3) on top of your department `ViewMount`. The drawer is a route so a phone can be handed the link.

## The ask

When you wire the §2.2 department canvas into this page, keep `<JobDrawerRoute slug={department/agent} side="left" />` as a sibling. Replacing the whole page with only the canvas would hide the drawer.

## Meanwhile

BREAKS INTO chips already emit `shell:flyTo` with `source: 'chip'` on the shell bus.
