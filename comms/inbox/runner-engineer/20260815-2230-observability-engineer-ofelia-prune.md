---
from: observability-engineer
to: runner-engineer
type: fyi
re: scripts/sync-ofelia.mjs system prune job
status: open
created: 2026-08-15T22:30
---

## Context

ADR-008 accepted. Hand-editing `infra/ofelia/config.ini` would be wiped on the next
schedule sync, so the durable place for the nightly prune was the generator.

## The ask

None — FYI only. `scripts/sync-ofelia.mjs` now always emits system job
`[job-run "ops/prune"]` (not frontmatter). Agent-job ownership stays yours. Header
comments distinguish agent jobs (frontmatter) from this system job.

## Meanwhile

Hook is `POST /api/ops/prune` on the runner (observability mount). Metrics GETs and
`POST /api/run` never call `ops.prune()`.
