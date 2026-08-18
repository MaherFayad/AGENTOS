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
14. **The project attribute is a selector, and a selector is not erasure — but a missing
    selector is worse, because deletion presupposes selection.** PDPL rule 7 needs an
    *operation* that finds and removes one subject's data across artefacts, traces and
    Postgres. What §3.5 has is the handle to select on at **project** granularity (tier 1)
    and, in `ops.message.author`, at **author** granularity (tier 2); no delete verb exists
    for either. **Tier 3 — a third party named inside free text — has no selector at any
    price, and a delete verb does not fix it** (ruling, 2026-08-18). See *Erasure* below; it
    is written as a stated limit, not an open item, and the difference is the point.
15. **A thread is a filter on the run plane, never a second aggregation model**
    (`Plan §12`, ADR-023). ADR-023 rejected making the thread the traced unit on
    *one run, one trace* alone, and that assumption is untouched: a thread spanning four
    runs is **four traces**, correlated by `ops.agent_runs.thread_id`. So `thread` joins
    `agent`, `department` and `account` as one more optional predicate — `?thread=<uuid>`
    on `/metrics/query`, `/metrics/runs` and `/metrics/activity`, and `threadId` on every
    run and activity row. **There is no `/metrics/threads` and no `groupBy: thread`.** A
    rollup would be a second way to compute `cost` and `runs`, and two ways to compute one
    number is how a dashboard and a drawer start disagreeing about one client's spend.
    `groupBy: thread` is refused for a second reason of its own: a thread has **no title**
    by decision (`contracts/thread-model.md` §9.6), so the bar-list it produced could only
    render uuids — a panel that looks like data and answers nothing.
16. **`agnetos.thread.id` is optional on `SpanScope`, and the optionality is coupled to the
    schema rather than left to taste.** The other three members are required because none
    has a truthful absent state; `thread_id` does — `ops.agent_runs.thread_id` is nullable
    on purpose (`0008_threads.sql` §3), meaning *"this run predates threads"*, and that is
    true of every run this system can currently record. Requiring it would be a constraint
    whose only satisfying value is a placeholder, i.e. M15's ledger defect written from the
    other side, and it would put a fabricated correlation key on every trace in the
    product. **The coupling is mechanical:** `threads-observability.test.ts` reads every
    migration and, the day `thread_id` becomes `NOT NULL`, requires the member to lose its
    `?`. The required set of `SpanScope` tracks the NOT NULL set of the ledger, and neither
    moves without the other going red. Falsified in both directions by planting each.
17. **What a trace may carry from an `ops.message` body: an id, a kind, a level and two
    counts. Never a character of the body itself.** This is decided *before* anything writes
    a message, because *redact at instrumentation, not after* means the decision has to
    precede the first write — there is no unredact path and no viewer-side toggle to fix it
    later. `messageSpanAttributes()` (`packages/contracts/src/threads.ts`) is the **only**
    instrumentation point for that table and is a type with no `body` field to add back.
    **And the redactor is not a fallback here, which is the finding rather than the rule.**
    Decision 13 closed flattening for *derived* prose; a message body is not derived, it is
    flat by construction — free text a person typed, with no keys to deny. Demonstrated
    rather than asserted: `redact()` on `"Chase Fatima Al-Harbi about the Olaya lease"`
    returns it **verbatim, zero hits**, because the name is not a denylisted key and has no
    value shape a regex knows; the same content as `{client_name: …}` redacts. So the four
    keys / one survivor arithmetic that appeared in the plan span, the approvals `summary`
    and the redactor itself reaches its limit at `ops.message`: there is nothing to catch.
    The defence is that the body never enters the object, and the mechanism is the type.
    `bodyChars` is a length, and a length is not content — it exists so *"the human sent
    something and the agent read nothing"* and *"the human sent nothing"* are different rows
    on a trace.

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
| REQ-OBS-36 | §3.5 | *(`Plan §12` — filed under §3.5, the metrics plane it extends)* A thread narrows the existing metrics plane as a bound parameter (`?thread=` on query / runs / activity; `threadId` on every run and activity row), with **no** thread rollup route and **no** `groupBy: thread` | `apps/runner/src/db/queries.ts` · `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/threads-observability.test.ts` |
| REQ-OBS-37 | §3.5 | A malformed `?thread=` is refused `400 bad_thread` before the database, so it cannot answer zero runs and look like a thread that has none | `apps/runner/src/routes/metrics.ts` | `apps/runner/src/observability/__tests__/threads-observability.test.ts` |
| REQ-OBS-38 | §3.5 | The run ledger row **stores** `thread_id` — the INSERT names the column *and* binds the value — so a thread's runs are answerable from the table every number is read from | `apps/runner/src/db/ledger.ts` *(`runner-engineer`'s writer; landed during M16)* · `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/threads-observability.test.ts` |
| REQ-OBS-39 | §3.5 | Every span of a threaded run carries `agnetos.thread.id` and its trace carries `langfuse.trace.metadata.thread`; a run with **no** thread emits neither key rather than an empty one | `apps/runner/src/observability/instrument.ts` · `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/threads-observability.test.ts` |
| REQ-OBS-40 | §3.5 | `SpanScope`'s required set tracks the ledger's NOT NULL set — a migration making `ops.agent_runs.thread_id` NOT NULL fails the gate until `agnetos.thread.id` stops being optional | `apps/runner/src/observability/langfuse.ts` | `apps/runner/src/observability/__tests__/threads-observability.test.ts` |
| REQ-OBS-41 | §3.5 | An `ops.message` body never becomes a span attribute — the projection is a type with no field it could arrive in, and the redactor is demonstrably **not** a fallback for free text | `packages/contracts/src/threads.ts` *(`messageSpanAttributes`, `thread-model-engineer`'s — consumed, not owned)* | `apps/runner/src/observability/__tests__/threads-observability.test.ts` · `apps/runner/src/observability/__tests__/message-body-never-traced.test.ts` *(`rtl-arabic-pdpl-specialist`'s — the projection was **opt-in** until it existed)* |
| REQ-OBS-42 | §3.5 | Text a run is told to withhold is scrubbed from **every** string it emits — span attribute, ledger column, activity line and **error message** — whole or in a 32-character window, because §9.3 refuses truncation by name | `apps/runner/src/observability/withhold.ts` · `apps/runner/src/observability/redact.ts` · `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/withheld-text-never-traced.test.ts` |
| REQ-OBS-43 | §3.5 | A body seen once under a denylisted key is withheld for the rest of that run, whatever container it arrives in next — and the register is **per-run**, so one client's text never scrubs another's trace | `apps/runner/src/observability/redact.ts` · `apps/runner/src/observability/instrument.ts` | `apps/runner/src/observability/__tests__/withheld-text-never-traced.test.ts` |
| REQ-OBS-44 | §3.5 | Exhausting the withheld register never **un**-withholds a literal it already holds: the bound refuses the newest, `size()` is monotonic, `add()` returns `false` so the call site learns the text is unprotected, and the refusal count reaches the root span as `withheld_refused` | `apps/runner/src/observability/withhold.ts` · `apps/runner/src/observability/instrument.ts` · `apps/runner/src/observability/types.ts` | `apps/runner/src/observability/__tests__/withheld-text-never-traced.test.ts` *(§4 — red on the old `literals.shift()` shape)* |

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
| `GET …/metrics/query?metric=&range=&agent=&department=&account=&thread=` | `{ metric, range, filter, value, runs, previous, delta, asOf }` — `filter` echoes `projectId` and `threadId` |
| `GET …/metrics/activity?limit=&department=&thread=` | `{ items: [{ runId, at, time, event, detail, agent, agentName, department, status, threadId, traceUrl }] }` |
| `GET …/metrics/runs?agent=&limit=&thread=` | `{ runs: [{ runId, agent, agentRef, agentName, startedAt, status, durationMs, costUsd, costSource, accountId, accountSource, threadId, traceUrl }] }` |
| `GET …/metrics/accounts?range=` | `{ range, spend: [{accountId, account, label, source, usd, runs, unpricedRuns}], accountsRegistered, accountsEnforced: false, asOf }` |
| `GET …/runs/:runId/tools` | `{ toolCalls: [{ seq, name, status, startedAt, durationMs, error }] }` · `404 run_not_in_project` when the run is another project's |
| `GET …/metrics/sql` / `GET …/metrics/sql/:name` | named-query catalogue / rows |
| `writeOutput(db, output)` | structured business row, redacted on the way in |
| `METRICS` / `RANGES` / `NAMED_QUERIES` | `apps/runner/src/db/queries.ts`, `apps/runner/src/db/registry.ts` |

`?thread=` takes a uuid and nothing else; a malformed one is **`400 bad_thread`** before the
database. There is deliberately no `unthreaded` bucket to mirror `account`'s `unattributed`:
that is a *value the ledger stores*, whereas "no thread" is a NULL and is every row in the
table today — a bucket for it would be a filter whose answer is "everything" dressed as a
category.

**Read every `threadId` below through this.** The chain is now complete in *source* —
`RunInit.threadId` → span scope and trace metadata → `RunRecord.threadId` →
`ops.agent_runs.thread_id` (the ledger INSERT names the column and binds the value, landed
by `runner-engineer` during M16, REQ-OBS-38). **It has never carried a value, because zero
runs have executed** — `RUNNER_ANTHROPIC_API_KEY` is unset, no span has ever been emitted,
and the table is empty. So every `threadId` is `null` and every `?thread=` answers zero runs,
today, and will until Phase 0's human items land. **Completed is not validated**: what is
demonstrated is that the column, the bind, the filter and the attribute all exist and agree;
what is not demonstrated is any of it against a real run.

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
- **The project attribute on `lib/langfuse.ts` — and now the thread too. Still open, still
  theirs, and threads make it worse rather than merely unchanged.** That is the runner's
  *second* emitter, the deprecated `/api/public/ingestion` one, and it fires whenever
  `services.obs` is absent — which is every `--profile dev` run, i.e. the only profile that
  exists today. It posts `{name, tags, metadata:{durationMs, costUsd, toolsUsed,
  brainInjected}}` and **no project**, so *"every span the runner emits names its project"*
  is true of this module and not yet true of the runner. `runner-engineer` answered **(b) —
  delete the second emitter**; it is not deleted at the time of writing. Adding
  `thread_id` to the plane does not add a second defect here, it **widens the first one**:
  a trace that cannot name its project also cannot name its thread, so the two correlation
  keys M16 exists to provide are both absent from the only emitter that currently fires.
  Left as an open row rather than quietly closed, because the fix is a deletion in a file
  that is not mine.
- **`groupBy: thread` and a `/metrics/threads` rollup.** Refused, not deferred — decision 15,
  pinned by a test. A thread has no title (`thread-model.md` §9.6), so a thread breakdown
  could only render uuids.
- **The thread's *own* aggregate cost.** Answerable today as
  `/metrics/query?metric=cost&thread=<id>` and deliberately not given a second spelling.
  `TurnCost.estimatedUsd` stays typed `null` in `packages/contracts` for the composer's
  *preview*; this is the retrospective figure and it is `null` too, for the older reason —
  nothing has run.
- **A retention horizon for `ops.thread` / `ops.message`.** Answered as *no horizon*, with
  the reasoning, under *Retention*. The number is the human's.
- **Erasure itself.** Below.

## Erasure (PDPL rule 7) — three tiers, two of which a delete verb reaches

Recorded here rather than in a handoff, because the next person to read "traces carry a
project now" will otherwise read it as this being solved.

**Which planes this table speaks for, stated first because it used to be assumed.** The
ledger, the tool-call rows, `app.agent_outputs`, the Langfuse traces, the artefact directory,
`ops.thread` and `ops.message` — the planes this repo stores data in. It does **not** speak
for the model endpoint. `lib/prompt.ts` renders every prior turn's `body` into the user
prompt, and this repo asserts no processing region for that endpoint — there is no region or
base-URL configuration in `apps/runner` at all — so a message body leaves the tailnet the
moment a thread takes a second turn (`thread-model.md` §7.1, corrected 2026-08-18). Rule 7's
*"traces stay local"* is true and answers for **this** plane, not for the plane carrying the
words. Cross-border transfer under PDPL Arts. 29–31 is `rtl-arabic-pdpl-specialist`'s
data-egress ADR, it needs the human, and **nothing in this file settles it**. An erasure
table that quietly implied it covered every path the text takes would be the house defect in
its costliest costume.

**Can we name an operation that finds one subject's data across artefacts, traces and
Postgres, and does it terminate?** At **project** granularity: nearly — every plane has the
selector, none has a delete verb. At **subject** granularity the answer splits in two, and
that split is the 2026-08-18 ruling; see the tier table below.

| Plane | Select by project? | Delete verb exists? |
|---|---|---|
| `ops.agent_runs` · `ops.agent_run_tools` | yes — `project_id`, NOT NULL, FK'd | prune is by **age**, not by project. `DELETE … WHERE project_id = $1` is one statement and is not written |
| `app.agent_outputs` | yes — `project_id` in the unique index | same |
| Langfuse traces | **yes** — `langfuse.trace.metadata.project` + `agnetos.project.id` on every span | **no.** Nothing in this repo calls a Langfuse delete endpoint. We can now *find* them and cannot *remove* them |
| Artefacts on disk | **yes, as of `7b6401d`** — `<artifactsRoot>/<project>/<runId>/`, and an old-layout directory is *refused*, never adopted (`runner-engineer`, REQ-RUN-42/43, new code `artifact_unattributed`) | **no.** A per-project directory now exists to remove and nothing removes it — `rm -rf` of a real path, unwritten |
| `ops.thread` · **`ops.message`** | yes — `project_id` NOT NULL on both and FK-pinned (`0008_threads.sql` §5) | **no**, and `ops.prune` is deliberately not extended to them — see *Retention* |

*(The `ops.thread` / `ops.message` row said "NOT NULL, FK-pinned, **RLS'd**" until 2026-08-18.
Two of those three mechanisms fire on the only stack that exists; RLS does not, because
compose's Postgres user is a superuser and a superuser bypasses RLS unconditionally —
`GET /api/status` reports `projects.scopeEnforcement: "bypassed"`, and `thread-model.md` §8b
grades every mechanism in `0008` this way. The conclusion was never wrong — the `WHERE`
clause carries it — but the sentence listed three enforcers where two are running, which is
a declared value read as an observed one. Cited, not concluded from, per §8b.)*

*(The artefacts row said **no** until 2026-08-17 and was wrong at `eaca677`: the project
segment landed one commit later at `7b6401d`. Corrected on `commandcenter-orchestrator`'s
routing of M15's PASS follow-up. The direction of the error was the safe one — it
understated what exists — but this is the row a future erasure implementer reads, and as
written it sent them to build something that was already there.)*

**Subject-level erasure does not reduce to a search, and this is the part worth stating
plainly.** Redaction runs at instrumentation with no unredact path, so a data subject's
name is *not in the trace* — which is excellent minimisation and is exactly what makes
"find John Smith's spans" unanswerable. The two outcomes are:

- for every field the rules catch, erasure is satisfied **by construction**: there is
  nothing there to erase, and that is the strongest possible answer;
- for any field that slipped through, erasure is **impossible by search**, because the
  handle we would have searched on is the thing we removed.

### `ops.message` is where the minimisation argument stops working

Added 2026-08-17, from `thread-model-engineer`'s ADR-023 / `contracts/thread-model.md` §7.3,
and it is a genuine weakening of the position above rather than a caveat on it.

Every plane in the table before it holds identifiers, mounts, counts, and the names of
secrets — things minimisation gets to be *true* about. **`ops.message.body` holds free text
a human typed, stored verbatim, and storing it verbatim is the point**: a redacted record is
not a record. It is the first plane in this repo where a data subject's own words are held
in full, and decision 17 above shows the redactor cannot be a fallback for it — a body has
no keys to deny, so `redact()` returns a sentence naming a client with **zero hits**.

So the sentence *"for every field the rules catch, erasure is satisfied by construction"*
is still true and no longer sufficient, because at `ops.message` the rules catch nothing by
design.

### The three tiers — `rtl-arabic-pdpl-specialist`'s ruling, 2026-08-18, and the table is mine

The standing finding on this page was *"erasure has no delete verb in any plane"*, and it was
one step short in a way that changes what to build. **Deletion presupposes selection.** Split
on that, subject-level erasure is not one problem but three, and a `DELETE` landing tomorrow
answers two of them:

| Tier | Unit | Selectable today? | Executable today? | Does a delete verb fix it? |
|---|---|---|---|---|
| **1** | a **project** | **yes** — `project_id` NOT NULL and FK-pinned on every table, `metadata.project` on every trace, one directory on disk | no | **yes, in the live planes.** One `DELETE` per table, one API call, one `rm -rf` — and **a backup is a fourth store none of them reaches** |
| **2** | an **author's own words** — `ops.message.author = 'human:{identity}'`, plus `thread_id` and `message.id` | **yes** — `author` is NOT NULL and its grammar is fixed (`0008` §4), so *"everything Maher wrote"* is a `WHERE` clause | no | **yes for what that author wrote** — which is *"delete everything I typed"*, and **not** an erasure request from that person |
| **3** | a **third party named inside a body** | **no, at any price** | no | **no** |

*(Both qualifications in the last column were added 2026-08-18, graded by
`rtl-arabic-pdpl-specialist` while grading ADR-036. The **normative text for both is
`company/COMPANY.md` rule 7**, deliberately, because that file is injected into every run of
every project and this page is read by whoever opens it; cite it, do not re-derive it. In
short: a single natural person is tier 2 for their own rows and **tier 3 for everything others
wrote about them**, so the three tiers are not three populations and author-scoped deletion
does not discharge that person's Art. 18 request; and rule 2's encrypted backups are a fourth
store, so a tier-1 erasure that leaves the rows in last night's dump is not complete by this
page's own standard. Neither narrows tier 3 — both **widen** the population minimisation is the
only mechanism for.)*

**Tier 3 is the ruling and it is why this table is written as a limit rather than a roadmap.**
*"Chase Fatima Al-Harbi about the Olaya lease"* is a data subject who never touched this
system, stored in full, with nothing to select on. Full-text search is a guess whose false
negatives nobody can count — a misspelling, a nickname, an Arabic rendering, a pronoun — and
**an erasure that cannot be proven complete is not an erasure**. So the honest sentence is
not *"we cannot execute erasure yet"*. It is that for text a human typed, **deletion is not
the mechanism that discharges the obligation; not accumulating it is.**

That makes four decisions elsewhere load-bearing rather than tidy, and **they may not be
relaxed for convenience** (`thread-model.md` §9.3): §9.6 no thread title (it would have put a
truncated body in every list payload), §5.2 `payload` is an object and never prose,
contentless push, and `messageSpanAttributes` having no `body` field. Each was argued on other
grounds; each is now doing PDPL work, and each is minimisation — which is the only tier-3
mechanism there is.

**v1's erasure scope is tier 1, and none of it is written** — stated rather than gapped, and
in the same tense as the table's *Executable today? no*. Tier 2 is buildable from the same verb
and is not in v1 because no row exists to delete. Tier 3 ships as a written position.

### The trace plane, and what its "by construction" argument now rests on

The trace plane is unaffected by the `ops.message` weakening, and that is load-bearing rather
than regrettable: **a message body never becomes a span attribute** (decision 17, REQ-OBS-41),
so nothing this weakening touches has leaked into Langfuse. The exposure is Postgres, and it
is one table.

**But that argument used to rest on a call site's good manners, and now it rests on a gate.**
`messageSpanAttributes` was the sanctioned projection and was **opt-in**; on 2026-08-18
`rtl-arabic-pdpl-specialist` measured `trace.event('mailbox-read', message)` putting the body
verbatim into the OTLP payload in **three** places with zero redaction hits. Two mechanisms
now hold it, and this page cites them rather than the claim:

- `apps/runner/src/observability/__tests__/message-body-never-traced.test.ts` — the key
  backstop (`body` and four siblings on `KEY_DENYLIST`), catching a message-shaped object at
  any depth under any entry point.
- `apps/runner/src/observability/__tests__/withheld-text-never-traced.test.ts` +
  `observability/withhold.ts` — the **withheld-literal register**, which is the only pass that
  survives flattening and interpolation. `` `halted: ${message.body}` `` is a `string` by the
  time any signature sees it, so no type reaches it and no value rule should try; characters
  are the only handle left. A registered literal is scrubbed from every string this run emits,
  whole or in a 32-character window — §9.3 refuses truncation **by name**, so a mechanism that
  missed `body.slice(0, 40)` would miss the case the ruling anticipates.

**What that register still cannot do, asserted as a passing test rather than a TODO:** a run
that was never told a literal is client text still emits it. It is a register, not a
classifier. The automatic half needs no call site (a body seen once under a denylisted key is
remembered for the rest of that run); the sanctioned mailbox path never shows the body to the
redactor at all, so it needs one `trace.withhold(message.body)` at the drain — filed to
`runner-engineer`, **not landed as of 2026-08-18 22:40** (`grep withhold apps/runner/src/lib/`
returns two test doubles and no call site).

**Its bound refuses rather than forgets, corrected 2026-08-18.** The register was capped at 32
literals and evicted the oldest, which `rtl-arabic-pdpl-specialist` graded as a **fail-open**
while grading ADR-036: the 33rd registered body silently un-protected the 1st, in an ordinary
33-message thread, on the mechanism whose whole job is this. It now refuses the newest literal
at a 1 MiB character budget (512 entries as a second ceiling on scrub cost), never evicts —
`size()` is monotonic — returns `false` so the call site learns the text is unprotected, and
puts the refusal count on the run's root span as `langfuse.trace.metadata.withheld_refused`,
absent when zero. **The residual is stated, not closed:** a full register still cannot withhold
what it refused, and neither bound is unreachable by construction, because `ops.message.body`
has no length CHECK and `readMailbox` has no `LIMIT`. What changed is that exhaustion now costs
the *newest* body — the one whose caller is still on the stack — and says so, instead of
costing the oldest and saying nothing. **REQ-OBS-44.** Gated by
`withheld-text-never-traced.test.ts` §4, red on the old shape (falsified three ways).

**Owners:** the PDPL ruling is `rtl-arabic-pdpl-specialist`'s (`thread-model.md` §9.3); this
table is mine. **A delete verb gets its own ADR before its first line of code** — erasure is
destructive, the number it needs is the human's, and writing one into a migration nobody
asked to review is how an irreversible capability arrives without a decision behind it. That
ADR is **[ADR-036](../decisions/ADR-036-erasure-and-retention.md)**, claimed on BOARD before
the file was written, and it carries the retention horizon in the same document for the reason
given there.

So the only erasure unit this architecture **could execute, once a verb exists**, is the
project — erase everything for that client, or demonstrate the subject's data was never in the
trace store. **That would terminate:** it is bounded by one project's traces, one `DELETE` per
table, and one directory. Tier 2 would terminate the same way once the verb exists. Tier 3 does
not terminate and no attribute added later fixes it.

*(The three verbs above were present tense until 2026-08-18 — "can actually execute", "that
terminates" — twelve lines below this section's own table reading **Executable today? no**, and
four lines above a *What is missing* list whose item 3 is the tier-1 `DELETE`. ADR-036 kept the
distinction in its Context; the spec lost it in the mood of a verb, which is the same house
defect as the RLS row above and is harder to see because no mechanism is misnamed. Found by
`fidelity-qa-reviewer` as the single item of a FAIL.)*

**What is missing, in the order it should land:**

1. A **delete verb for Langfuse** — a `deleteProject(projectId)` on the sink, calling
   Langfuse's trace-delete API with the trace ids the metadata filter returns. This is
   the gap that makes the whole chain non-executable today.
2. **Artefacts under `artifactsRoot/<project>/<runId>/`** — `runner-engineer`, in flight
   from the same sign-off. Until then the durable bytes have no project handle at all.
3. **`DELETE FROM … WHERE project_id = $1`** for `ops.agent_runs`, `ops.agent_run_tools`,
   `app.agent_outputs`, `ops.message` and `ops.thread`, behind one named operation rather
   than five ad-hoc statements. **Tier 1.**
4. An answer to **what `app.agent_outputs.payload` erasure means per `kind`** — that
   table holds business rows a client is entitled to have deleted, and "delete the whole
   project" is the only granularity anyone has specified.
5. **Whether a Langfuse trace deleted through its API is actually gone** from its Postgres
   *and* its ClickHouse/blob storage. Unverified, and it is the difference between
   erasure and a hidden row.
6. **`DELETE … WHERE project_id = $1 AND author = $2`** — **tier 2**, the same verb with one
   more predicate, and deliberately *after* tier 1 rather than alongside it. A per-author
   delete that ran before the project-wide one existed would be the narrower blast radius
   shipping first, which sounds prudent and is how the wide one arrives later untested.
7. **A backup rotation shorter than whatever erasure commitment we make**, written down and
   observed — the fourth store. Added 2026-08-18 with the tier-1 qualification above. It is a
   number and it is the **human's**, alongside ADR-036 decision 5's other two; nothing here
   guesses it. `infra-compose-engineer` owns the mechanism, this page owns the claim it makes
   true, and until it exists tier 1 says *in the live planes*. Note the ordering trap: an
   `eraseProject` that shipped before this would look complete and would not be.

**Not on this list, and that is the ruling:** anything that would find a third party named
inside a body. No item can be written for tier 3 — not a full-text index, not an entity
extractor, not a "PII scan" job. Each of those produces a number nobody can audit and a
report that reads like completeness, which is worse than the empty list above.

Items 1, 3 and 4 are mine. None of them is in M15's scope and none should be smuggled in:
each one is a destructive operation and the first destructive operation in this product
should not land in the same change as the attribute that makes it possible.

## Retention (ADR-008 accepted)

- Spans (`ops.agent_run_tools`) 90d · ledger (`ops.agent_runs`) 400d · daily rollup forever
- `POST /api/ops/prune` mounts on the runner; ofelia `[job-run "ops/prune"]` @ `0 3 * * *`
  via `scripts/sync-ofelia.mjs` (always emitted). Never called from metrics GETs or
  `POST /api/run`.
- Langfuse project retention = **90 days** (match spans).

### Threads and messages are **not** pruned, and that is a decision — `thread-model.md` §9.4

Routed to me as the owner of the retention horizon. **Answered: `ops.prune` is not extended
to `ops.thread` or `ops.message`, and no horizon is invented here.**

ADR-008's horizons are horizons *on telemetry*. A span is exhaust: past 90 days it is a
record of how a thing ran, and deleting it costs a drill-down. **A thread is not exhaust —
it is the record of what a person asked and what was done about it**, which is the product's
memory rather than its by-product. `Plan §12` makes continuing a thread a new run *seeded
with the thread's history*, so an age-based prune copied from `ops.agent_runs` would delete
the conversations that make continuation work, silently, at 03:00, by cron. That is the
opposite of what a thread is for, and it would also make erasure *look* solved by making the
data go away for an unrelated reason.

**So: unbounded today, deliberately, and stated rather than implied.** Growth is a real
operational question and it is not answered by pretending it is a retention question:

| | Position |
|---|---|
| Horizon | **none.** Nothing deletes a thread or a message |
| Why not a number now | any figure I pick is a plausible number on a surface with no data to derive it from — zero threads exist, zero messages, zero runs. The same rule that types `TurnCost.estimatedUsd` as `null` |
| What it needs | **the human**, one number, in **[ADR-036](../decisions/ADR-036-erasure-and-retention.md)** — claimed on BOARD 2026-08-18, `proposed`. Erasure and retention are the product's first destructive operations and they arrive together or not at all |
| Meanwhile | the exposure is bounded by the fact that nothing writes either table yet |

**Why the horizon is in the same ADR as the delete verb, since splitting them keeps being
proposed.** They share an enforcement point, a blast radius and a review. Split, the
irreversible half acquires a default six weeks later in a migration nobody read — which is
exactly how `ops.prune`'s 90 days would arrive on `ops.message` under the honest-sounding
heading *"align thread retention with span retention"*. One document, one review, one human
number.

Filed as a decision-request rather than a default. **An unbounded table that says so is an
operational task; an invented 90-day horizon on a client's conversation is a data-loss
incident with a changelog entry.**
