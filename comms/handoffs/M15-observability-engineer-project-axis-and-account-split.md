---
agent: observability-engineer
milestone: M15
spec: §3.5 (the whole metrics read path) · `Plan §10` (the project axis) · `Plan §11` (the account split) · Part VII.3
created: 2026-08-17T00:20
status: ready-for-review
---

# M15 — the project axis across the metrics read path, and the per-account cost split

**Provenance of every mechanical result quoted below** (design-tokens contract §8b):

```
scanned at 2026-08-17 00:17 +03:00 · 4e0bbe6 · 119 uncommitted
```

The uncommitted count is high and honest: **six agents were live in this tree while this
slice was built**, and the number counts all of their work, not only mine. `check-metrics`
reports repo-wide dirtiness on purpose — see *Deliberately not done*.

---

## What exists now

| Path | What changed |
|---|---|
| `apps/runner/src/db/scope.ts` | **new.** `readInProject(db, projectId, fn)` — one pooled connection, `BEGIN READ ONLY`, `agnetos.project_id` set transaction-locally. `isScopeViolation()` maps SQLSTATE `42501`. |
| `apps/runner/src/db/client.ts` | `PoolHandle.session()` — lends one connection for the length of a transaction. |
| `apps/runner/src/db/queries.ts` | `MetricFilter.projectId` is **required**; `project_id = $1::uuid` on every ops statement; `account` filter; `costTodayByAccount`, `costByAccount`, `billingAccountCount`, `runExistsInProject`. |
| `apps/runner/src/db/registry.ts` | `PROJECT_ID_SLOT` reserves `$1` in every built query; `bindNamedQuery(name, projectId, supplied)`; new `cost_by_account`. |
| `apps/runner/src/routes/metrics.ts` | `/api/p/:project/…` parsing, the `project` echo, `/metrics/accounts`, `run_not_in_project`, `project_scope_unset`. |
| `apps/runner/src/routes/register-metrics.ts` | scoped mounts + the ten legacy paths answering `400 project_scope_missing`. |
| `apps/runner/src/routes/api.ts` | the metrics mount now takes `resolveProject`, the same one every other project route uses. |
| `packages/contracts/src/api.ts` | `COST_TICKER_ROUTE` moved to the scoped path; `LEGACY_COST_TICKER_PATH` added. **`runner-engineer`'s file — messaged, not assumed.** |
| `scripts/check-metrics.mjs` | provenance banner; check 6 — every served query carries a project predicate *and* reserves `$1`. |
| `comms/specs/observability.md` | decisions 7–10, REQ-OBS-21…28, the interface table rewritten. |

### How many endpoints took the axis

**Ten route shapes took it; one deliberately did not.**

| Took the project axis | |
|---|---|
| `GET /api/p/:project/cost/today` | + `byAccount` |
| `GET /api/p/:project/metrics/runs` | + `accountId`, `accountSource`, `agentRef` |
| `GET /api/p/:project/metrics/live` · `…/metrics/status` | |
| `GET /api/p/:project/metrics/query` | + `account=` filter, `filter.projectId` echoed |
| `GET /api/p/:project/metrics/activity` | |
| `GET /api/p/:project/metrics/accounts` | **new** |
| `GET /api/p/:project/metrics/sql` · `…/metrics/sql/:name` | 49 registered queries, all scoped |
| `GET /api/p/:project/runs/:runId/tools` | |

| Deliberately left alone | Why |
|---|---|
| `POST /api/ops/prune` | Retention runs coordinator-wide on one nightly ofelia tick. `ops.prune` and `ops.rollup_runs` carry `SET agnetos.project_id = '*'` **in their own definitions**, so the cross-project scope is written where the query is rather than in a runbook. Per-project retention windows are a different feature and would amend ADR-008. |

**On the "34 endpoints" figure in the BOARD and in the orchestrator's brief.** It is the
count of *reachable metric surfaces* — 4 metrics × ranges/filters plus the named-query
catalogue — not 34 route registrations. The route table has always been nine shapes; it is
now ten. Counting either way, the honest statement is: **every metrics surface this repo
serves now carries a project, and one route is exempt by decision.** The 49 registered
queries are individually enforced by `check-metrics` check 6, which is where the real
multiplication lives.

---

## The three "no data" cases, per project

This was the sharp part of the brief and it is worth stating as the table it became. A
filter is the easiest place in the system to manufacture a confident zero, so each state
is a different set of bytes:

| The truth | The answer |
|---|---|
| this project has no runs | `200` · `runs: 0` (a real count), `value: null`, `ledger.state: "connected"`, `project.state: "mounted"` |
| this project's rows are unreachable | ticker `200` with `usd/runs/unpricedRuns` **all `null`**; every other route `503 metrics_unavailable`; `ledger.state: "unreachable" \| "absent"` says which |
| the request named no project | `400 project_scope_missing`, hint naming the scoped path |
| the project is not one we serve | `404 project_not_found` (not a slug / unknown) · `503 project_not_mounted` (real, lives on another host) — `resolveProject`'s three distinct refusals, kept distinct |
| a query reached a scoped table with no scope set | `500 project_scope_unset` — **never** `metrics_unavailable` |
| a run id belongs to another project | `404 run_not_in_project` — **never** an empty span list |

Two of those are new distinctions that did not exist this morning and both were found by
asking "what would this look like if it were wrong?":

- **`project_scope_unset` vs `metrics_unavailable`.** `ops.project_visible()` raises
  SQLSTATE `42501` when a query reaches a project-scoped table with no scope. The old
  catch-all turned *every* error into `503 metrics_unavailable`. "The database is down" and
  "we forgot to say whose rows we wanted" have different fixes, and folding the second into
  the first would train everyone to ignore the one alarm that means an axis was dropped.
- **`run_not_in_project` vs an empty drawer.** A run id carries no project in it. A link
  copied from one project's drawer into another project's URL used to be a silent
  cross-project read; it is now a join through the parent row, and — because "no spans" and
  "not yours" both return zero rows — one extra existence check turns the second into a 404.

And the state that is *not* on this list, deliberately: there is no "all projects" reading
of a metrics number. `/api/all/` gained no metrics route. An unfiltered `account` means
"every account in this project", which is a sentence someone might mean; there is no
sentence a KPI tile means by "every project".

---

## Two mechanisms, deliberately redundant

Both are needed and neither is sufficient. This is the part most likely to be "simplified"
by a future reader, so the reason is in `db/scope.ts` as well as here:

1. **`project_id = $1` as a bind parameter on every statement.** This is what filters
   *today*, because compose's Postgres user is a superuser and superusers bypass row-level
   security — so **migration 0005 §5 is currently inert**. Relying on RLS alone right now
   would be trusting a policy that is not in force.
2. **`agnetos.project_id`, set transaction-locally.** This is what makes a *forgotten*
   predicate raise instead of widening the answer, the day `infra-compose-engineer` lands a
   non-superuser role. Without it, that day is the day every metrics read starts answering
   500.

Transaction-local, not session-level, and that is load-bearing: a session-level setting
survives on a pooled connection and would hand a stale project scope to the next borrower —
one client's rows under another client's name, arriving through the connection pool instead
of through a URL.

---

## The account split: what it can and cannot show

**Can show, today, structurally:**

- `byAccount` on `/cost/today` and `spend` on `/metrics/accounts`, grouped by
  `ops.billing_account` with the label joined.
- An explicit **`unattributed`** bucket, because migration 0005's `account_provenance`
  CHECK makes "we do not know who paid" a stored value rather than a `NULL`. Dropping those
  rows would make the chart's total quietly smaller than the ticker's, and neither number
  would be wrong.
- `accountSource` (`project-default` · `run-override` · `unattributed`) on every LAST RUNS
  row — the same provenance `costSource` already gives the number.
- `accountsRegistered` beside the split, so an empty array is not read as "one account paid
  for everything".
- `cost_by_account` as a registered named query, so a panel can render the split without a
  bespoke route.

**Cannot show, and this is not a defect:**

`ops.billing_account` has **zero rows**, `ops.project.default_account_id` is **NULL**, and
**no run has ever executed**, so no run has ever recorded a payer. Every account surface
answers `[]` with `accountsRegistered: 0` and `accountsEnforced: false`. The correctness of
the split is **structural, not demonstrated** — it is `contracts/project-scoping.md` §6 row
4 (*"`default_account_id` / 'the run recorded who paid' — there are no runs"*), and the
payload says so in a field rather than only in this file, because a consumer building a
two-account chip row needs to know before it designs an empty state.

There is also no second account, so "the same account pays across two projects" — the whole
reason the split needs two axes — cannot be exercised at all. `Plan §11`'s example
(`work $12.40 · personal $3.10`) is a shape this API can produce and has never produced.

---

## `check-metrics` provenance

Two-line import, exactly as routed:

```js
import { provenance } from './lib/provenance.mjs';
// …
const prov = provenance(ROOT);
console.log(`  scanned at         ${prov.line}`);
```

Repo-wide rather than scoped, unlike `check-tokens`. This checker reads **two** trees that
can each invalidate its answer — `panels/` and `apps/runner/src/db/` — and `provenance()`
takes one pathspec. Reporting dirtiness for only one of them would be *worse* than
reporting it for all of them: a clean-looking banner beside a result that a change in the
other tree had already invalidated is precisely the stale PASS the line exists to prevent.
Over-reporting is noise; under-reporting is a lie. It prints on green runs too, because
green is when a result gets quoted.

The banner also lands in `--json` as `summary.provenance`, matching `check-tokens` and
`check-comms`.

---

## Contracts touched

- **`comms/specs/observability.md`** — mine. Decisions 7–10, REQ-OBS-21…28, the interface
  table rewritten to the scoped shapes with the `ledger` and `project` siblings named once
  above it rather than repeated per row.
- **`comms/contracts/api-contracts.md`** — `runner-engineer`'s. **Not edited.** The one line
  it needs (`GET /api/cost/today` → the scoped path) is a `decision-request`, not a
  drive-by: `…/20260817-0020-observability-engineer-metrics-routes-are-project-scoped.md`.
- **`comms/contracts/project-scoping.md`** — `runner-engineer`'s, consumed. Invariants 7, 8
  and 10 and §6 are what this slice implements; nothing in it was changed.
- **`packages/contracts/src/api.ts`** — `runner-engineer`'s file, and I edited two constants
  in it (`COST_TICKER_ROUTE`, `LEGACY_COST_TICKER_PATH`). Both are explicitly marked in that
  file as *"`observability-engineer`'s route"*, and leaving `COST_TICKER_ROUTE` pointing at
  a path that now answers 400 would have made the contract state something false. Flagged in
  the same message; revert on request.
- **`comms/contracts/panel-schema.md`** — `dashboards-engineer`'s, consumed. Unchanged: a
  panel still names a query and still cannot carry SQL. The project arrives in the URL, not
  in the panel, and `bindNamedQuery` now refuses a `project` supplied as a panel parameter.

---

## Deliberately not done

- **No `/api/all/` metrics route.** A cross-project cost roll-up is defensible for a spend
  cap and is not needed by anything today. `/api/all/` currently holds exactly one route,
  which is the number a reviewer can hold in their head; adding a second one speculatively
  is how that stops being true.
- **`POST /api/ops/prune` keeps no project axis.** Reasoned above. Per-project retention
  amends ADR-008 and belongs to whoever answers it.
- **`ops.agent_run_tools` gets no `project_id` column.** Migration 0005 decided this and I
  am not second-guessing it: two copies of one fact eventually disagree, and here the
  disagreement would be a tool span attributed to the wrong client. The spans borrow the
  parent's project through a join.
- **The RLS policy is not proven end-to-end.** It cannot be, on this stack: the app connects
  as a superuser, so every policy in migration 0005 §5 is inert. `sql-executes.test.ts`
  proves the *predicate* raises `42501` unconditionally, runs the policy half only when
  `ops.project_scope_enforced()` is true, and **prints a diagnostic saying which half it
  ran**. A test that passed silently under a superuser would be reporting an isolation
  guarantee that is switched off. One line of infra closes it — filed to
  `infra-compose-engineer`.
- **The standing acceptance case was run in its safe form, not its literal form.** *"Stop
  Postgres; confirm no surface shows a plausible zero"* — I did not stop the shared
  container, because five other agents were live against it while I worked, which is the
  same reason it has been owed since it was adopted. Instead I booted a runner pointed at a
  closed port, which produces the identical observable state (`connect ECONNREFUSED`), and
  exercised every metrics route through it. Results below. **The literal container-stop
  version stays owed**, and it should be run on a session where nobody else is connected.
- **`503 metrics_unavailable` is still one code for two causes.** M15 split off three
  genuinely different states (`project_scope_missing`, `project_scope_unset`,
  `run_not_in_project`), but `metrics_unconfigured` vs `metrics_query_failed` is still open
  and is `runner-engineer`'s contract. Filed as a `decision-request` this session rather
  than folded in, because it changes a code every consumer matches on.
- **No web-side change.** `apps/web` still calls the unscoped paths in several places and
  will get 400s until `shell-navigation-engineer` and `dashboards-engineer` land their
  halves. That is the migration being visible rather than silent, which is the whole point
  of a named 400 — but it does mean **the product is mid-migration right now**, and I have
  said so in both messages rather than leaving it to be discovered.
- **`agent_ref` is passed through, not used.** LAST RUNS now carries it; nothing derives
  liveness or history from it yet. ADR-014 §2 says run history hangs off `agent_ref` rather
  than `agent`, which will matter the first time an agent is forked — and cannot matter
  before then, since a fork with zero runs and an original with zero runs are the same
  empty state.

---

## Verification

**Read the provenance lines, not just the counts.** The tree moved measurably while this
slice was verified — five other agents were landing work — so the same commands printed
different totals eight minutes apart:

```
2026-08-17 00:17 +03:00 · 4e0bbe6 · 119 uncommitted    npm test 131 · test:runner 108
2026-08-17 00:25 +03:00 · 4e0bbe6 · 153 uncommitted    npm test 142 · test:runner 119
```

Nothing regressed between them: the extra tests are other agents'. This is the exact
situation §8b was written for — two honest readings of one instrument, adjudicable by
reading them rather than by re-litigating them — so both are printed rather than the
flattering one.

**Gates, at `2026-08-17 00:25 +03:00 · 4e0bbe6 · 153 uncommitted`.**

```
npm test                 142 tests · 141 pass · 0 fail   (1 skipped, pre-existing)
npm run test:runner      119 tests · 119 pass · 0 fail
npm run validate:metrics  6 panels · 80 panel queries · 49 registered · 7 migrations · 0 FAIL
npm run validate:comms   clean (1 pre-existing filename warn, not mine)
npm run validate:coverage observability.md clean (1 pre-existing warn: REQ-OBS-16 unverified)
tsc --noEmit             @agnetos/runner clean · @agnetos/contracts clean
```

My own new tests inside those totals: 11 in
`apps/runner/src/observability/__tests__/metrics.test.ts` and 1 in
`apps/runner/src/db/__tests__/sql-executes.test.ts`.

**Against the live Postgres** (`docker compose` stack, 127.0.0.1:5433):

```
254 statements accepted   — every ops + named query, with the project axis, executed for real
4 write statements planned
an unscoped read raises rather than returning rows — PASS
  ℹ RLS is BYPASSED on this connection (superuser or BYPASSRLS) … the predicate above is
    proven; the policy is not.
```

Live route probe, real database, empty ledger:

```
/api/p/agentos/cost/today            → 200 {"usd":null,"runs":0,"unpricedRuns":0,"byAccount":[],…,"project":{"slug":"agentos",…,"state":"mounted"}}
/api/p/agentos/metrics/accounts      → 200 {"spend":[],"accountsRegistered":0,"accountsEnforced":false,…}
/api/p/agentos/metrics/query?…       → 200 {"value":0,"runs":0,"previous":0,"delta":null,"filter":{"projectId":"ad3c92e7-…"}}
/api/p/agentos/metrics/sql/cost_by_account → 200 {"rows":[]}
/api/p/agentos/runs/run_nope/tools   → 404 run_not_in_project
/api/cost/today                      → 400 project_scope_missing
/api/p/client-x/cost/today           → 500 project_scope_mismatch   (handler, mount disagreeing with path)
```

**The standing acceptance case, safe form** — runner booted against a closed port:

```
/api/p/agentos/cost/today            → 200 {"usd":null,"runs":null,"unpricedRuns":null,
                                            "ledger":{"state":"unreachable","attempts":1,
                                            "lastError":"connect ECONNREFUSED 127.0.0.1:59999",…}}
/api/p/agentos/metrics/runs          → 503 metrics_unavailable
/api/p/agentos/metrics/accounts      → 503 metrics_unavailable
/api/p/agentos/metrics/query?…       → 503 metrics_unavailable
/api/p/client-x/cost/today           → 503 project_not_mounted     ← not masked by the outage
/api/cost/today                      → 400 project_scope_missing   ← not masked by the outage
```

The last two lines are the result worth reading: **the project is resolved before the
ledger is consulted**, so an outage cannot make a wrong project name look like a temporary
problem. Resolving in the other order would have let a bad project name come back as
somebody else's numbers once the outage cleared.

**Not green, and not mine.** `npm run test:web` — the vitest half fails (15 tests across
`CostTicker`, `MapView`, `BrainEmptyState`, `ViewTabs`, `SearchPill`, `i18n`), and
`tsc --noEmit` fails in `apps/web/src/map/MapView.tsx:445`. I have not touched a single file
under `apps/web`. Those are `shell-navigation-engineer`'s in-flight project-segment work
(`route.ts`, `ShellContext.tsx`, `useEndpoint.ts`, `ProjectSwitcher.tsx`, all uncommitted
and mid-edit at the time of writing). The node half of `test:web` passes 101/101. Recorded
rather than reported as green, and messaged to them.

---

## Next agent

`fidelity-qa-reviewer`, on the re-review request filed with this handoff. Read
`comms/contracts/project-scoping.md` §6 **first** — it is the list of seven things M15
cannot validate, and five of them bound this slice. In particular: the account split is
structural, not empirical, and no PASS should describe it otherwise.

Then `shell-navigation-engineer` and `dashboards-engineer`, whose consumers are currently
calling paths that answer 400. Both have messages.
