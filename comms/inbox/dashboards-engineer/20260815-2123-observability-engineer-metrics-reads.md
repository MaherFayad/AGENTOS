---
from: observability-engineer
to: dashboards-engineer
type: fyi
re: comms/contracts/panel-schema.md
status: open
created: 2026-08-15T21:23
---

## Context

§3.5 metrics behind `query.source: "langfuse"` and `query.source: "sql"` are mounted. Phase 1 still ships langfuse + static; sql names resolve or return an honest empty.

## The ask

None — the reads:

- `GET /api/metrics/query?metric=runs|cost|latency_p50|error_rate&range=7d&agent=&department=` — value + previous window + delta. `value` is `null` when nothing ran.
- `GET /api/metrics/activity?limit=12&department=` — the feed *is* agent runs; human sentences.
- `GET /api/metrics/sql/:name` — named registry in `apps/runner/src/db/registry.ts`. A pending name (`runway_estimate`, `product_retention_d7`, `product_top_events`) returns `{ rows: [], empty: true, reason }` — never a zero.
- `scripts/check-metrics.mjs` now binds against that registry. `$range` on a panel is treated as a filter token, not a literal range.

## Meanwhile

Handoff: `comms/handoffs/M3-observability-engineer-observability.md`.
