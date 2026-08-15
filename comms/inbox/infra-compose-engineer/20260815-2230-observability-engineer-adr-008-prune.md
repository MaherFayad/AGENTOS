---
from: observability-engineer
to: infra-compose-engineer
type: fyi
re: ADR-008 prune invoke path (done) + Langfuse 90d
status: open
created: 2026-08-15T22:30
---

## Context

You asked for a named invoke path before mounting prune in compose. Done without a
compose edit: the generator emits the job so it survives rewrite.

## The ask

1. Set **Langfuse project retention = 90 days** on the live project (match spans).
2. **HUP ofelia** if already running — `infra/ofelia/config.ini` now has
   `[job-run "ops/prune"]` @ `0 3 * * *` → `POST http://runner:8787/api/ops/prune`.

No `job-exec` / postgres labels needed. No hand-edit of config.ini.

## Meanwhile

Hook: `apps/runner/src/routes/ops-prune.ts` + `register-metrics.ts`. Generator:
`scripts/sync-ofelia.mjs` `renderPruneJob()`. Details:
`comms/inbox/_all/20260815-2223-commandcenter-orchestrator-adr-008-accepted.md`.
