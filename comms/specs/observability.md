# Spec — Observability (§3.5)

> The implementation spec for the Langfuse / cost / LAST RUNS / metrics slice of
> `skilltree-clone-spec.md`. Checked by `npm run validate:coverage`.

## Owner

`observability-engineer`

## Spec sections covered

§3.5

## Boundaries

Cited from this spec but **not** claimed — these mentions must not live under Spec
sections covered or the coverage checker steals another agent's section:

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §2.0 | `shell-navigation-engineer` | `GET /api/cost/today` and `GET /api/metrics/live` (the numbers) | CostTicker, LIVE numeral, chrome |
| §2.2 | `map-galaxy-engineer` | per-department live numerator and derived `failing` status | galaxy nodes, halos, graph payload |
| §2.3 | `drawer-engineer` | durable run rows + `traceUrl` + tool spans | LAST RUNS UI; they consume `GET /api/runs` |
| §2.5 | `dashboards-engineer` | `query.source: "langfuse"` metrics, activity feed API, named SQL | carousel, widgets, `panels/*.json` |
| §3.2 | `runner-engineer` | `createObservability().startRun` — one trace per run | SSE, allowlist, `GET /api/runs` (live view) |
| §3.4 | `agent-library-curator` | error-rate evidence that *feeds* `agent-auditor` | the auditor agent, the committed `status` field |
| PART V | `infra-compose-engineer` | refuse cloud Langfuse sinks; read `APP_DATABASE_URL` / `LANGFUSE_HOST` | compose, image pins, volume placement, Caddy `/traces` |
| PART VII | `rtl-arabic-pdpl-specialist` | redaction at instrumentation, before a trace is written | PDPL policy, COMPANY.md inheritance, backup encryption |

`GET /api/runs` is **not** this spec. `runner-engineer` serves the in-memory live view.
Durable history is `GET /api/metrics/runs`. Two owners of one number is how LAST RUNS
starts lying.

Compose / Langfuse image pins are **not** this spec. Infra owns `infra/`.

## Decisions

1. **The Postgres ledger is what every rendered number reads.** Langfuse holds the
   narrative trace for drill-down. A Langfuse outage degrades the trace link, not the
   ticker, the LIVE counter, or a KPI tile. (Standing rule 9, Part VII.3.)
2. **`status: live` is derived from successful runs**, never from a hand-edited
   frontmatter field. `deriveStatus` has no input for a declared status.
3. **`GET /api/cost/today` returns `usd: null` when nothing priced today.** CostTicker
   already renders that as `no cost data`. `$0.00 today` is only a real priced zero.
4. **Env names follow compose, which we do not edit.** `APP_DATABASE_URL` and
   `LANGFUSE_HOST` are accepted as aliases of `DATABASE_URL` / `LANGFUSE_BASE_URL`.
5. **Retention windows are [ADR-008](../decisions/ADR-008-observability-retention.md)
   (proposed).** 90d spans / 400d ledger / forever daily rollup, pending the human.
6. **Cloud Langfuse regions are refused at sink construction.** Part VII.4 is a flag,
   not boilerplate.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-OBS-01 | §3.5 | One runner invocation opens one Langfuse trace (agent, department, redacted inputs, model, tokens, cost, duration, outcome) | `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-02 | §3.5 | One tool call is one span under that trace, so a drawer row can deep-link | `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-03 | §3.5 | Traces ship OTLP/HTTP to self-hosted Langfuse; no SDK, no SaaS sink | `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-04 | §3.5 | A hosted Langfuse Cloud hostname is refused at construction | `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-05 | §3.5 | A Langfuse outage does not fail the run or drop the ledger row | `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-06 | §3.5 | PII is redacted at instrumentation, before the sink and before Postgres | `apps/runner/src/observability/redact.ts` · `apps/runner/src/observability/redaction-rules.ts` | `apps/runner/src/observability/__tests__/redaction.test.ts` |
| REQ-OBS-07 | §3.5 | Cost prefers the SDK figure, else published rates, else `null` / `unpriced` — never a guessed rate | `apps/runner/src/observability/pricing.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-08 | §3.5 | `GET /api/cost/today` is mounted on the runner and returns `{usd}` for the shell ticker | `apps/runner/src/routes/metrics.ts` · `apps/runner/src/routes/register-metrics.ts` · `apps/runner/src/routes/api.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-09 | §3.5 | Until a real priced run exists today, `usd` is `null` (CostTicker: `no cost data`) — never a plausible `$0.00` | `apps/runner/src/db/queries.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-10 | §3.5 | Metrics `runs`, `cost`, `latency_p50`, `error_rate` are filterable by agent / department / range, with a previous-window delta | `apps/runner/src/db/queries.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-11 | §3.5 | Activity feed is agent runs: timestamped two-line human sentences, not log lines | `apps/runner/src/observability/activity.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` · `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-12 | §3.5 | LIVE numerator counts only agents with a successful run; no invented denominator | `apps/runner/src/observability/status.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/status.test.ts` · `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-13 | §3.5 | Sustained error rate (≥25% of last 20 runs, min 3) derives `failing`; never reads frontmatter `status` | `apps/runner/src/observability/status.ts` | `apps/runner/src/observability/__tests__/status.test.ts` |
| REQ-OBS-14 | §3.5 | Business widgets read named, parameterised SQL only; a panel file cannot carry raw SQL | `apps/runner/src/db/registry.ts` · `apps/runner/src/routes/metrics.ts` · `scripts/check-metrics.mjs` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-15 | §3.5 | Run ledger + tool spans + agent_outputs schemas exist; cost provenance is a CHECK constraint | `apps/runner/src/db/migrations/0001_ops_run_ledger.sql` · `apps/runner/src/db/migrations/0002_app_agent_outputs.sql` | `scripts/check-metrics.mjs` |
| REQ-OBS-16 | §3.5 | Retention is documented (90d spans / 400d ledger / forever rollup) and not scheduled until the human accepts ADR-008 | `apps/runner/src/db/migrations/0003_retention.sql` · `comms/decisions/ADR-008-observability-retention.md` | — |
| REQ-OBS-17 | §3.5 | Dry runs are traced but excluded from cost, LIVE and status derivation | `apps/runner/src/db/queries.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-18 | §3.5 | A pending named query returns an empty row set and a reason, not a zero | `apps/runner/src/db/registry.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-19 | §3.5 | Durable LAST RUNS (trace link included) is `GET /api/metrics/runs`; `GET /api/runs` is not claimed | `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-20 | §3.5 | Missing Postgres does not crash the runner; `/api/cost/today` still answers `usd: null` | `apps/runner/src/routes/register-metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |

## Interfaces we expose

`runner-engineer` imports `createObservability` from
`apps/runner/src/observability/index.ts` and nowhere else.

| Surface | Shape |
|---|---|
| `obs.startRun(init)` | `{ runId, traceId, traceUrl, tool, usage, event, finish }` |
| `GET /api/cost/today` | `{ usd: number \| null, runs, unpricedRuns, timezone, asOf }` |
| `GET /api/metrics/live` | `{ live, liveAgents, byDepartment, failing, failingAgents, totalSource, asOf }` — no `total` |
| `GET /api/metrics/status` | `{ agents: [{ agent, department, status, errorRate, reason, runs, successfulRuns, lastRunAt }], thresholds, asOf }` |
| `GET /api/metrics/query?metric=&range=&agent=&department=` | `{ metric, range, filter, value, runs, previous, delta, asOf }` |
| `GET /api/metrics/activity?limit=&department=` | `{ items: [{ runId, at, time, event, detail, agent, agentName, department, status, traceUrl }] }` |
| `GET /api/metrics/runs?agent=&limit=` | `{ runs: [{ runId, agent, agentName, startedAt, status, durationMs, costUsd, costSource, traceUrl }] }` |
| `GET /api/runs/:runId/tools` | `{ toolCalls: [{ seq, name, status, startedAt, durationMs, error }] }` |
| `GET /api/metrics/sql` / `GET /api/metrics/sql/:name` | named-query catalogue / rows |
| `writeOutput(db, output)` | structured business row, redacted on the way in |
| `METRICS` / `RANGES` / `NAMED_QUERIES` | `apps/runner/src/db/queries.ts`, `apps/runner/src/db/registry.ts` |

Anything not listed is private.

## Interfaces we consume

- `comms/contracts/api-contracts.md` — `GET /api/cost/today` is ours; `GET /api/runs` is
  `runner-engineer`'s; uniform `{error:{code,message,hint?}}`.
- `comms/contracts/panel-schema.md` — `query.source: "langfuse" \| "sql" \| "static"`;
  panels never contain raw SQL.
- `packages/contracts/src/api.ts` — `COST_TICKER_ROUTE` (reference only, not in
  `RUNNER_ROUTES`).
- Compose env (unread, unedited): `APP_DATABASE_URL`, `LANGFUSE_HOST`,
  `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`.
- `apps/web/src/components/shell/CostTicker.tsx` — consumes `{usd}`; we do not edit it.

## Test plan

- Unit: `node --test` via `npm test --workspace=@agnetos/runner` — instrumentation,
  redaction (absence of PII literals, not presence of placeholders), status derivation,
  metrics handler with a fake `DbClient`.
- Contract: `node scripts/check-metrics.mjs` — every panel `langfuse` metric and `sql`
  name resolves; no raw SQL in `panels/`; migrations numbered.
- Not automatable here: a live Langfuse project on `--profile obs`, a side-by-side of
  the ticker against a real run. That is M3 + `fidelity-qa-reviewer`.

## Deliberately not done

- **`GET /api/runs`.** Runner owns the live view. We did not steal it. Durable history
  is `/api/metrics/runs`. Overlaying the ledger onto their route is a message, not a
  quiet edit.
- **Calling `startRun` from `POST /api/run`.** Runner already does. Their `lib/langfuse.ts`
  still also posts the deprecated ingestion API — two emitters for one run is leftover.
- **LIVE overlay on the graph payload.** `/api/metrics/live` and `/api/metrics/status`
  exist. The shell currently reads frontmatter `status` from `GET /api/graph`. Map
  owns the overlay.
- **`denied` / American `canceled` in the ledger CHECK.** Our `RunStatus` is
  `ok \| error \| cancelled \| awaiting-approval`. Aligning with the SSE four-value
  `done.status` is a joint change with `runner-engineer`.
- **Merging `db/queries.ts` `NAMED_QUERIES` into `db/registry.ts`.** The HTTP path
  reads the registry. The smaller copy in `queries.ts` is leftover, not a second
  source of truth for panels.
- **Compose / Langfuse image pins, volume encryption, Caddy `/traces`.** Infra.
- **`LANGFUSE_PROJECT_ID` in compose.** Trace URLs use `default` until infra adds it.
- **Langfuse project retention UI = 90 days.** Documented (ADR-008); infra sets on the
  live project so it matches `ops.agent_run_tools`.
- **Company.md redaction-rule inheritance.** Coordinate with
  `rtl-arabic-pdpl-specialist`; the rule list is in `redaction-rules.ts`.

## Retention (ADR-008 accepted)

- Spans (`ops.agent_run_tools`) 90d · ledger (`ops.agent_runs`) 400d · daily rollup forever
- `POST /api/ops/prune` mounts on the runner; ofelia `[job-run "ops/prune"]` @ `0 3 * * *`
  via `scripts/sync-ofelia.mjs` (always emitted). Never called from metrics GETs or
  `POST /api/run`.
- Langfuse project retention = **90 days** (match spans).
