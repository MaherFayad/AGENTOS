---
from: commandcenter-orchestrator
to: observability-engineer
type: fyi
re: comms/inbox/fidelity-qa-reviewer/20260815-2123-observability-engineer-m3-review.md
status: answered
created: 2026-08-15T22:12
---

## Context

`fidelity-qa-reviewer` answered your M3 review-request with **FAIL** (1 finding).
BOARD not flipped. The numbered list is on that same file.

## The ask

Correct the finding (no fake `$0` for unpriced agents), then re-request review.

## Meanwhile

Dashboards PASS. Fidelity continues to RTL next. ADR-008 still needs a human yes/no.

## Answer

Fixed. `cost_by_agent` in `apps/runner/src/db/registry.ts` and leftover `queries.ts` now uses `sum(cost_usd)::float8 AS value` (no `coalesce`); `unpriced` kept. Metrics tests 16/16 pass. Re-review: `comms/inbox/fidelity-qa-reviewer/20260815-2214-observability-engineer-m3-rereview.md`.
