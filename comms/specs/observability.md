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
   (accepted 2026-08-15).** 90d spans / 400d ledger / forever daily rollup. *(This line
   read "proposed … pending the human" until 2026-08-17; ADR-008's own status field has
   said `accepted` since it was written. A spec that disagrees with its own ADR about
   whether a decision is made is the kind of small drift that gets cited later.)*
6. **Cloud Langfuse regions are refused at sink construction.** Part VII.4 is a flag,
   not boilerplate.
7. **Every metrics route names its project in its path** (`Plan §10`, ADR-015 Q1) — and
   there is no default. The pre-project spellings stay mounted and answer **400
   `project_scope_missing`** naming the scoped path, so a stale client gets a sentence
   rather than another project's rows or a 404 that reads like a forgotten route.
8. **Two mechanisms hold the project axis, deliberately redundant.** Every statement
   carries `project_id = $1` as a bind parameter — that is what filters *today*, because
   the compose Postgres user is a superuser and therefore bypasses migration 0005's
   row-level security entirely. And `agnetos.project_id` is set transaction-locally for
   every read — that is what makes a *forgotten* predicate raise instead of widening the
   answer, once `infra-compose-engineer` lands the non-superuser role. One mechanism
   would be a filter; two is a filter plus the thing that catches it going missing.
9. **`unknown` is not `zero`, and neither is `not yours`.** Five states, five answers:
   *no runs* → `200` with a real `0`; *ledger unreachable/absent* → nulls with
   `ledger.state`; *no project named* → `400 project_scope_missing`; *project not served*
   → `404 project_not_found` / `503 project_not_mounted`; *scope unset inside the
   database* → `500 project_scope_unset`, **never** `metrics_unavailable`.
10. **The account split is structural, not demonstrated.** `byAccount` and
    `/metrics/accounts` exist, carry an explicit `unattributed` bucket, and report
    `accountsRegistered` alongside so an empty split cannot be read as "one account paid
    for everything". `ops.billing_account` has zero rows and no run has ever recorded a
    payer — see `contracts/project-scoping.md` §6.
11. **The project axis on the trace plane is a type, not a convention.**
    `OtelSpan.attributes` is `SpanScope & Record<string, AttrValue>`, so a span that
    cannot name its project **does not compile**; `RunInit` requires `projectId`,
    `agentRef` and `sourceRef`, so a run that cannot name its project does not compile
    either. This reverses the earlier optional-on-`RunInit` decision, whose stated reason
    ("the ledger's `assertAttributed` refuses it at runtime") guarded Postgres and left
    the *trace store* and the *artefact directory* unguarded — and a trace shipped without
    a project is a leak that has already happened by the time the ledger refuses.
    `assertAttributed` stays: the type stops it being written, the runtime check catches an
    `as` cast or a value that is present and empty.
12. **Redaction is applied to derived text, not only received text.** The activity line
    (`activity_event` / `activity_detail`) is composed from an agent-chosen `summary` and
    an agent-chosen artefact *filename*, and went to Postgres and to the §2.5 feed with no
    redaction pass, because it looked like our own prose rather than someone's payload.
    It is now redacted at instrumentation like everything else.
13. **Flattening a payload into prose is not a way past the key denylist.** The key pass
    walks object keys; a string has none. `buildPlanSummary` flattens run `inputs` into
    a sentence, which the runner traces as `event:plan` — so `client_name`, `address`,
    `date_of_birth` and `salary` all survived, and only `contact_email` was caught, and
    only because its *value* had a shape a regex knows. `redactString` now applies
    `KEY_DENYLIST` — **unchanged**, and co-owned with `rtl-arabic-pdpl-specialist` — to
    `key: value` inside strings. Blunt in the safe direction: a value runs to the next
    `·`, `;`, `|` or newline and **not** to the next comma, because
    `address: 12 King Fahd Road, Riyadh` must not leave `Riyadh` behind.
14. **The project attribute is a selector, and a selector is not erasure.** PDPL rule 7
    needs an *operation* that finds and removes one subject's data across artefacts,
    traces and Postgres. What §3.5 has after this change is the handle to select on, at
    **project** granularity, and no delete verb anywhere in the repo for the trace store.
    See *Erasure* below; it is written as an open item on purpose.

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
| REQ-OBS-20 | §3.5 | Missing Postgres does not crash the runner; `/api/p/:project/cost/today` still answers `usd: null` | `apps/runner/src/routes/register-metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-21 | §3.5 | Every metrics route is served under `/api/p/:project`; the pre-project spelling answers `400 project_scope_missing` naming the scoped path | `apps/runner/src/routes/metrics.ts` · `apps/runner/src/routes/register-metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-22 | §3.5 | Every ops and named query carries `project_id = $1` as a bind parameter, enforced at bind time and at build time | `apps/runner/src/db/queries.ts` · `apps/runner/src/db/registry.ts` · `scripts/check-metrics.mjs` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-23 | §3.5 | Every metrics read runs inside a READ ONLY transaction with `agnetos.project_id` set transaction-locally, so migration 0005's RLS can fire | `apps/runner/src/db/scope.ts` · `apps/runner/src/db/client.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` · `apps/runner/src/db/__tests__/sql-executes.test.ts` |
| REQ-OBS-24 | §3.5 | A scope violation (SQLSTATE 42501 from `ops.project_visible`) answers `500 project_scope_unset`, never `503 metrics_unavailable` | `apps/runner/src/db/scope.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-25 | §3.5 | Every metrics body carries a `project` sibling naming the project the numbers are about | `apps/runner/src/routes/metrics.ts` · `apps/runner/src/routes/register-metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-26 | §3.5 | A run id belonging to another project answers `404 run_not_in_project`, not an empty span list | `apps/runner/src/db/queries.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-27 | §3.5 | *(`Plan §11` — the gate reads the spec of record only, per ADR-013, so this is filed under §3.5, the cost surface it extends)* Cost surfaces split by billing account with an explicit `unattributed` bucket, and report how many accounts are registered | `apps/runner/src/db/queries.ts` · `apps/runner/src/db/registry.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/metrics.test.ts` |
| REQ-OBS-28 | §3.5 | `check-metrics` prints a provenance banner on every run, green or red (tokens contract §8b) | `scripts/check-metrics.mjs` · `scripts/lib/provenance.mjs` | — *(banner is the evidence; `provenance.mjs` itself is pinned by `scripts/__tests__/provenance.test.mjs`)* |
| REQ-OBS-29 | §3.5 | Every span a run emits — root, tool, generation and event alike — carries `agnetos.project.id` and `agnetos.agent.ref` | `apps/runner/src/observability/instrument.ts` · `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-30 | §3.5 | A span that cannot name its project is a **compile** error (`SpanScope` on `OtelSpan.attributes`), not a convention | `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` *(`@ts-expect-error`; enforced by `npx tsc --noEmit -p apps/runner/tsconfig.json`)* |
| REQ-OBS-31 | §3.5 | A run that cannot name its project, agent ref and source ref is a compile error; `assertAttributed` stays as the second, runtime mechanism | `apps/runner/src/observability/types.ts` · `apps/runner/src/db/ledger.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` · `apps/runner/src/db/__tests__/ledger-project-axis.test.ts` |
| REQ-OBS-32 | §3.5 | The trace carries a **trace-level** project handle (`langfuse.trace.metadata.project` / `.agent_ref` / `.source_ref`), so a trace list can be filtered to one client | `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-33 | §3.5 | The activity line is redacted at instrumentation, before the ledger row and before the §2.5 feed — including the artefact filename it is derived from | `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/instrument.test.ts` |
| REQ-OBS-34 | §3.5 | A denylisted key redacts its value inside a **string** too, so flattening a payload into prose does not get it past the key pass | `apps/runner/src/observability/redact.ts` | `apps/runner/src/observability/__tests__/redaction.test.ts` |
| REQ-OBS-35 | §3.5 | Erasure (PDPL rule 7) executes as a **project-scoped** operation across ledger, outputs, traces and artefacts | — *(not built — see `## Erasure`)* | — |

## Interfaces we expose

`runner-engineer` imports `createObservability` from
`apps/runner/src/observability/index.ts` and nowhere else.

| Surface | Shape |
|---|---|
| `obs.startRun(init)` | `{ runId, traceId, traceUrl, tool, usage, event, finish }` |
Every path below is prefixed with **`/api/p/:project`**, and every 200 body carries two
siblings the table does not repeat: `ledger: {state, since, attempts, lastError,
nextRetryAt, hint}` and `project: {slug, id, state: "mounted"}`. A consumer that renders a
zero must read `ledger.state` first (`state: "connected"` is the only licence to draw one)
and should read `project.slug` before labelling it.

| `GET …/cost/today` | `{ usd: number \| null, runs, unpricedRuns, byAccount: [{accountId, account, label, source, usd, runs, unpricedRuns}], timezone, asOf }` |
| `GET …/metrics/live` | `{ live, liveAgents, byDepartment, failing, failingAgents, totalSource, asOf }` — no `total` |
| `GET …/metrics/status` | `{ agents: [{ agent, department, status, errorRate, reason, runs, successfulRuns, lastRunAt }], thresholds, asOf }` |
| `GET …/metrics/query?metric=&range=&agent=&department=&account=` | `{ metric, range, filter, value, runs, previous, delta, asOf }` — `filter` echoes `projectId` |
| `GET …/metrics/activity?limit=&department=` | `{ items: [{ runId, at, time, event, detail, agent, agentName, department, status, traceUrl }] }` |
| `GET …/metrics/runs?agent=&limit=` | `{ runs: [{ runId, agent, agentRef, agentName, startedAt, status, durationMs, costUsd, costSource, accountId, accountSource, traceUrl }] }` |
| `GET …/metrics/accounts?range=` | `{ range, spend: [{accountId, account, label, source, usd, runs, unpricedRuns}], accountsRegistered, accountsEnforced: false, asOf }` |
| `GET …/runs/:runId/tools` | `{ toolCalls: [{ seq, name, status, startedAt, durationMs, error }] }` · `404 run_not_in_project` when the run is another project's |
| `GET …/metrics/sql` / `GET …/metrics/sql/:name` | named-query catalogue / rows |
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
- **The project attribute on `lib/langfuse.ts`.** That is the runner's *second* emitter,
  the deprecated `/api/public/ingestion` one, and it fires whenever `services.obs` is
  absent — which is every `--profile dev` run, i.e. the only profile that exists today.
  It posts `{name, tags, metadata:{durationMs, costUsd, toolsUsed, brainInjected}}` and
  **no project**, so "every span the runner emits names its project" is true of this
  module and not yet true of the runner. It is `runner-engineer`'s file; proposed to
  them with the diff written out, not edited here.
- **Erasure itself.** Below.

## Erasure (PDPL rule 7) — the selector landed; the operation did not

Recorded here rather than in a handoff, because the next person to read "traces carry a
project now" will otherwise read it as this being solved.

**Can we name an operation that finds one subject's data across artefacts, traces and
Postgres, and does it terminate?** At **project** granularity: nearly — three of four
planes have the selector, one has no delete verb. At **subject** granularity: no, and the
reason is structural rather than a missing feature.

| Plane | Select by project? | Delete verb exists? |
|---|---|---|
| `ops.agent_runs` · `ops.agent_run_tools` | yes — `project_id`, NOT NULL, FK'd | prune is by **age**, not by project. `DELETE … WHERE project_id = $1` is one statement and is not written |
| `app.agent_outputs` | yes — `project_id` in the unique index | same |
| Langfuse traces | **yes, as of this change** — `langfuse.trace.metadata.project` + `agnetos.project.id` on every span | **no.** Nothing in this repo calls a Langfuse delete endpoint. We can now *find* them and cannot *remove* them |
| Artefacts on disk | **no** — `artifactsRoot/<runId>/` has no project segment (`runner-engineer`, in flight) | `rm -rf` of a directory that does not exist yet |

**Subject-level erasure does not reduce to a search, and this is the part worth stating
plainly.** Redaction runs at instrumentation with no unredact path, so a data subject's
name is *not in the trace* — which is excellent minimisation and is exactly what makes
"find John Smith's spans" unanswerable. The two outcomes are:

- for every field the rules catch, erasure is satisfied **by construction**: there is
  nothing there to erase, and that is the strongest possible answer;
- for any field that slipped through, erasure is **impossible by search**, because the
  handle we would have searched on is the thing we removed.

So the only erasure unit this architecture can actually execute is **the project** — erase
everything for that client, or demonstrate the subject's data was never in the trace store.
That terminates: it is bounded by one project's traces, one `DELETE` per table, and one
directory. Subject-level does not, and no attribute added later fixes that without
un-minimising the traces, which would be the wrong trade.

**What is missing, in the order it should land:**

1. A **delete verb for Langfuse** — a `deleteProject(projectId)` on the sink, calling
   Langfuse's trace-delete API with the trace ids the metadata filter returns. This is
   the gap that makes the whole chain non-executable today.
2. **Artefacts under `artifactsRoot/<project>/<runId>/`** — `runner-engineer`, in flight
   from the same sign-off. Until then the durable bytes have no project handle at all.
3. **`DELETE FROM … WHERE project_id = $1`** for `ops.agent_runs`, `ops.agent_run_tools`
   and `app.agent_outputs`, behind one named operation rather than three ad-hoc statements.
4. An answer to **what `app.agent_outputs.payload` erasure means per `kind`** — that
   table holds business rows a client is entitled to have deleted, and "delete the whole
   project" is the only granularity anyone has specified.
5. **Whether a Langfuse trace deleted through its API is actually gone** from its Postgres
   *and* its ClickHouse/blob storage. Unverified, and it is the difference between
   erasure and a hidden row.

Items 1, 3 and 4 are mine. None of them is in M15's scope and none should be smuggled in:
each one is a destructive operation and the first destructive operation in this product
should not land in the same change as the attribute that makes it possible.

## Retention (ADR-008 accepted)

- Spans (`ops.agent_run_tools`) 90d · ledger (`ops.agent_runs`) 400d · daily rollup forever
- `POST /api/ops/prune` mounts on the runner; ofelia `[job-run "ops/prune"]` @ `0 3 * * *`
  via `scripts/sync-ofelia.mjs` (always emitted). Never called from metrics GETs or
  `POST /api/run`.
- Langfuse project retention = **90 days** (match spans).
