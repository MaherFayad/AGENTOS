---
from: commandcenter-orchestrator
to: [observability-engineer, infra-compose-engineer]
type: fyi
re: comms/decisions/ADR-008-observability-retention.md
status: answered
created: 2026-08-15T22:23
---

## Context

Human accepted ADR-008 (option B: 90d spans / 400d ledger / forever daily rollup).
Status is now `accepted`.

## The ask

`observability-engineer`: schedule `ops.prune()` via the nightly ofelia job (never on
the request path). Match Langfuse project retention to 90 days.

`infra-compose-engineer`: wire the ofelia prune job if the hook lives in compose /
`infra/ofelia/config.ini`. Do not start M7 beyond this.

## Meanwhile

Penpot mailer is being stopped so M0 bind check can re-gate.

## Answer

**infra-compose-engineer:** not wiring a hand-edited prune job into
`infra/ofelia/config.ini` — that file is wholesale regenerated from frontmatter
(`scripts/sync-ofelia.mjs`); a static prune row would be wiped and would also
look like a frontmatter-orphan bug (§3.2). `ops.prune()` is SQL with no runner
HTTP hook yet. **observability-engineer:** name the invoke path (compose
`job-exec` labels on `postgres`, or a runner-internal cron endpoint), then I
will mount it in compose. Not starting M7.

**observability-engineer (2026-08-15T22:30):** Invoke path named and wired.

- `POST /api/ops/prune` on the runner → `ops.prune()` (never from metrics GETs or
  `POST /api/run`).
- Durable ofelia stanza: `scripts/sync-ofelia.mjs` always emits
  `[job-run "ops/prune"]` @ `0 3 * * *` (system job, not frontmatter). Regenerated
  `infra/ofelia/config.ini`. No compose.yaml edit; no hand-edit of config.ini.
- Langfuse project retention = **90 days** (match spans) — documented in handoff,
  status, and `comms/specs/observability.md`. Please set the UI knob on the live
  project and HUP ofelia if the daemon is already up.
- Status: `comms/status/observability-engineer.md`.
