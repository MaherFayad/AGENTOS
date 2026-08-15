---
agent: observability-engineer
milestone: M3
spec: §3.5
created: 2026-08-15T21:23
status: ready-for-review
---

# M3 — Observability plane (§3.5)

## What exists now

- `apps/runner/src/observability/` — instrumentation, OTLP Langfuse sink, redaction, pricing, activity sentences, derived `live`/`failing`/`draft`
- `apps/runner/src/db/` — run ledger, agent_outputs, named-query registry, retention (`ops.prune` via ofelia)
- `apps/runner/src/routes/metrics.ts` — `handleMetricsRequest`
- `apps/runner/src/routes/register-metrics.ts` — Fastify mount
- `apps/runner/src/index.ts` / `apps/runner/src/server.ts` / `apps/runner/src/routes/api.ts` — `registerMetricsRoutes` mounts `GET /api/cost/today` + `POST /api/ops/prune`
- `apps/web/src/components/shell/CostTicker.tsx` — already consumes `{usd}`; we did not edit it
- `scripts/check-metrics.mjs` — panel names must resolve; no raw SQL in `panels/`
- `comms/specs/observability.md` — claims **§3.5 only**
- `comms/decisions/ADR-008-observability-retention.md` — **accepted** (option B)
- **2026-08-15T22:14 fidelity FAIL fix:** `cost_by_agent` uses `sum(cost_usd)::float8 AS value` (null for unpriced groups); no `coalesce(..., 0)` in `registry.ts` or leftover `queries.ts`
- **2026-08-15T22:30 ADR-008 prune:** `POST /api/ops/prune` + `scripts/sync-ofelia.mjs` always emits `[job-run "ops/prune"]` @ `0 3 * * *` → `ops.prune()`. Langfuse project retention = **90 days** (match spans; operator sets in Langfuse UI)

## How to use it

```ts
import { createObservability } from './observability/index.ts';
const obs = await createObservability(); // reads APP_DATABASE_URL / DATABASE_URL
const trace = obs.startRun({ agent, department, inputs, trigger: 'manual' });
sse.send('start', { runId: trace.runId, agent, traceUrl: trace.traceUrl });
const record = await trace.finish({ status: 'ok', artifacts });
```

Cost ticker: `GET /api/cost/today` → `{ usd: number | null, runs, unpricedRuns, timezone, asOf }`.
`usd: null` until a priced run exists today. CostTicker already renders that as `no cost data`.

Env (compose names, which we do not edit): `APP_DATABASE_URL`, `LANGFUSE_HOST`,
`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`. Aliases `DATABASE_URL` / `LANGFUSE_BASE_URL`
also work. Missing Postgres does not crash the runner.

## Contracts touched

- `comms/contracts/api-contracts.md` — consumed; `GET /api/cost/today` is ours; `GET /api/runs` left to `runner-engineer`
- `comms/contracts/panel-schema.md` — consumed; `langfuse` metrics + named `sql`
- `packages/contracts/src/api.ts` — `COST_TICKER_ROUTE` already documented; not edited
- Compose / Langfuse image pins — **not touched**

## Deliberately not done

- **`GET /api/runs`.** Runner owns the in-memory live view. Durable history is
  `GET /api/metrics/runs`. Coordinated by message, not stolen.
- **A second Langfuse emitter.** Runner still has `lib/langfuse.ts` (deprecated ingestion
  API) alongside `obs.startRun`. They should drop the old one when ready.
- **LIVE overlay on `GET /api/graph`.** `/api/metrics/live` and `/api/metrics/status` exist;
  map/shell still read frontmatter `status` until they consume these.
- **Ledger status vocabulary vs SSE `denied` / `canceled`.** Joint change with runner.
- **Compose, volume encryption, Caddy `/traces`, Langfuse image pin.** Infra.
- **`LANGFUSE_PROJECT_ID` in compose.** Trace URLs currently use `default`.
- **Langfuse UI retention knob.** Documented as 90 days (ADR-008); infra/operator sets
  the project setting on the live instance — not an env we invent.
- **Collapsing the leftover `NAMED_QUERIES` copy in `db/queries.ts`.** HTTP reads `registry.ts`.

## Verification

- `tsx --test` on `apps/runner/src/observability/__tests__/*` (instrument, metrics, redaction, status, ops-prune)
- `node --test scripts/__tests__/sync-ofelia.test.mjs` — prune job always emitted
- `node scripts/sync-ofelia.mjs` — regenerated `infra/ofelia/config.ini` with `[job-run "ops/prune"]`
- `node scripts/check-metrics.mjs`
- `node scripts/check-spec-coverage.mjs` (this spec claims §3.5)
- CostTicker tests (owned by shell) already assert `no cost data` when `{usd}` is missing

## Next agent

- `runner-engineer` — do not proxy `/api/cost/today`; keep `/api/runs`; drop `lib/langfuse.ts` when OTLP is enough
- `map-galaxy-engineer` — overlay `/api/metrics/status` onto node halos; LIVE numerator from `/api/metrics/live`
- `dashboards-engineer` — `GET /api/metrics/query` and `/api/metrics/activity` for `query.source: "langfuse"`
- `fidelity-qa-reviewer` — empty-state review of the ticker (`no cost data`) once a browser can hit the runner
- Human — accept or revise ADR-008 → **accepted 2026-08-15**; prune wired
- `infra-compose-engineer` — set Langfuse project retention to **90 days**; HUP ofelia
  after pulling the regenerated `infra/ofelia/config.ini` if the daemon is already up
- `runner-engineer` — FYI: `scripts/sync-ofelia.mjs` now always emits system job
  `ops/prune` (not frontmatter); agent-job ownership unchanged
