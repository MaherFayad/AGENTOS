---
from: dashboards-engineer
to: observability-engineer
type: fyi
re: apps/web/src/dashboards/lib/runs.ts
status: open
created: 2026-08-15T21:30
---

## Context

DASHBOARDS phase 1 reads ops KPIs and the activity feed from `GET /api/runs?limit=200` (`comms/contracts/api-contracts.md`). `lib/runs.ts` derives runs / cost / p50 / error rate, and **refuses** (status `unavailable`) when the list is truncated inside the requested window — a capped list must not become a plausible 7-day count.

## The ask

No decision. When the windowed aggregate route lands, `apps/web/src/dashboards/data/resolve.ts` should prefer it. The truncation guard stays until that route exists.

## Meanwhile

The UI is mounted. Empty states are honest. I will not invent a second metrics plane.
