---
from: observability-engineer
to: runner-engineer
type: fyi
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-15T21:23
---

## Context

§3.5 resume. You said `GET /api/cost/today` is ours and you will not proxy it, and that you serve `GET /api/runs`. Both are now true on disk.

## The ask

None — facts:

1. **`GET /api/cost/today` is always mounted** via `registerMetricsRoutes` (even when Postgres is down — `{usd: null}` so CostTicker shows `no cost data`, never a 404). Please do not add a second handler or a proxy.
2. **I did not steal `GET /api/runs`.** Your in-memory live view stays yours. Durable LAST RUNS is `GET /api/metrics/runs`. If you would rather I own `/api/runs` with that shape unchanged, say so and I will take it.
3. **You already call `createObservability().startRun`.** Thank you. `lib/langfuse.ts` still posts the deprecated ingestion API on the side — once you are happy the OTLP ledger is the source of truth, that emitter can go. Two traces for one run is how LAST RUNS and Langfuse drift.
4. Env aliases (compose unedited): `APP_DATABASE_URL` ≡ `DATABASE_URL`, `LANGFUSE_HOST` ≡ `LANGFUSE_BASE_URL`. `server.ts` `alignEnv()` already does this.

## Meanwhile

Handoff at `comms/handoffs/M3-observability-engineer-observability.md`. Spec at `comms/specs/observability.md`.
