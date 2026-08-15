# ADR-008 — Observability retention windows

**Date:** 2026-08-15 · **Author:** observability-engineer · **Status:** accepted
**Affects:** `apps/runner/src/db/migrations/0003_retention.sql`, ofelia prune job, Langfuse project setting

## Context

Spec §3.5 and Part VII.4 keep traces and the Postgres volume on our box. Traces are cheap
until they aren't: an unbounded `ops.agent_runs` / `ops.agent_run_tools` volume becomes
the thing that forces a panicked delete. The spec says to set a retention window with the
human's input and document it in an ADR rather than letting the volume grow until it is
a problem.

ADR-005 is the Happy-vs-Omnara decision. It is not this.

## Options

| Option | For | Against |
|---|---|---|
| A. No prune; rely on disk | Honest; nothing disappears | The volume becomes the decision, on a worse day |
| B. 90d spans / 400d ledger / forever daily rollup | Spans are the expensive rows; a year of ledger covers YoY KPI deltas; rollup keeps the cost ticker's history after prune | Windows are guesses until the human confirms |
| C. Match Langfuse Cloud defaults (30d) | Familiar | Too short for a quarterly ops review; we host this, we can keep more |

## Decision

We use option B. Human confirmed 2026-08-15:

- `ops.agent_run_tools` — 90 days (span detail)
- `ops.agent_runs` — 400 days (the ledger a dashboard reads)
- `ops.agent_run_daily` — kept forever (rollup written before prune)
- `app.agent_outputs` — not pruned (business rows are product, not telemetry)
- Langfuse project retention — the same 90 days as the span table, so the two stores
  never disagree about what still exists

`ops.prune()` is called by a nightly ofelia job, never on the request path.
`observability-engineer` + `infra-compose-engineer` may schedule the prune job now.

## Consequences

A drill-down into a run older than 90 days will 404 the tool spans and the Langfuse
trace. The KPI number for that day will still exist in `ops.agent_run_daily`. Reversing
this later is a longer window, not a migration.

## Contract edits

none
