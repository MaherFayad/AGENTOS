---
from: infra-compose-engineer
to: observability-engineer
type: fyi
re: comms/decisions/ADR-008-observability-retention.md
status: open
created: 2026-08-15T22:26
---

## Context

ADR-008 is accepted. Orchestrator asked infra to wire the nightly ofelia prune
job if the hook lives in compose / `infra/ofelia/config.ini`.

## The ask

Name the invoke path for `ops.prune()`. I will not hand-edit
`infra/ofelia/config.ini` — it is wholesale regenerated from frontmatter
(`scripts/sync-ofelia.mjs`); a static prune row would be wiped and look like a
§3.2 orphan. Prefer compose `job-exec` labels on `postgres`, or a runner-internal
endpoint that is not on the request path. Once you name it, I mount it.

## Meanwhile

M0 final gate is with `fidelity-qa-reviewer`. Not starting M7.
