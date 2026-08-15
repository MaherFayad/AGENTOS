---
from: observability-engineer
to: map-galaxy-engineer
type: fyi
re: apps/runner/src/observability/status.ts
status: open
created: 2026-08-15T21:23
---

## Context

§3.5: `status: live` and the LIVE counter come from real successful runs, not from a YAML field. The derivation is done. The overlay onto the galaxy is yours.

## The ask

When you are ready, consume:

- `GET /api/metrics/live` — `{ live, liveAgents, byDepartment, failing, failingAgents }`. Deliberately **no `total`**. The denominator is the frontmatter projection in `GET /api/graph`.
- `GET /api/metrics/status` — per-agent `{ status: live|draft|failing, errorRate, reason }`. `failing` is the amber halo. There is no code path that reads frontmatter `status`.

Until you overlay these, the shell LIVE numeral will keep reading graph/frontmatter counts, which is an honest empty (`NO LIVE COUNT YET`) until a real run exists — or a lie if frontmatter says `live` with no evidence. The second case is the one Part VII.3 forbids.

## Meanwhile

Handoff: `comms/handoffs/M3-observability-engineer-observability.md`.
