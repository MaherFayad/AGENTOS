---
agent: runner-engineer
milestone: M15
spec: Plan §9 · §10 · §11 · §23.12 (a plan that amends the spec of record — ADR-013) · spec §3.2 · Part V · Part VII.4
created: 2026-08-17T00:35
status: ready-for-review
---

# M15 — The project axis: `ops.project`, project-scoped routes, and the cascade at dispatch

> **Continued in [`M15-runner-engineer-project-axis-and-billing.md`](M15-runner-engineer-project-axis-and-billing.md)
> (2026-08-17T17:57).** That file carries the enforcement proof the BOARD attached to M15's
> PASS, the `ops.credential` / billing half this one names but does not describe, and **a
> defect found afterwards in the write path of the table this slice added the project axis
> to** — `db/ledger.ts` inserted none of the four `NOT NULL` columns migration 0005 created.
> Nothing below is retracted; the acceptance table below should be read with that section
> beside it.

**This slice was interrupted by a session limit after the code landed and before it was
documented or verified.** The user committed the work in progress as `4e0bbe6`. This handoff
finishes it. What that means in practice, stated first because it changes how to read
everything below: **the code in `4e0bbe6` did not compile and the enforcement point it
contained was unreachable.** Both are fixed here; the rest of that commit was sound.

---

## What exists now

### The plane

- `apps/runner/src/db/migrations/0005_project_axis.sql` — `ops.project`,
  `ops.billing_account`, `ops.credential`, the project axis on the four tables that already
  existed, and row-level security. Written as an **audit** of what exists, not an addition.
- `packages/contracts/src/project.ts` — the code half: `isProjectSlug`, `ProjectSummary`,
  `agentRef`, `sourceRef`, `AccountSource`, `PROJECT_ROUTE_PREFIX`.
- `apps/runner/src/lib/project.ts` — `mountedProject`, `resolveProject` (three refusals),
  `projectIdForSlug`, `probeScopeEnforcement`, `toProjectSummary`.
- `apps/runner/src/lib/config.ts` — **new:** `projectSlug`, `projectName`,
  `globalLibraryDir`. These three were referenced by `project.ts` and `cascade.ts` in
  `4e0bbe6` and did not exist, which is why nothing typechecked.

### The cascade at dispatch

- `apps/runner/src/lib/cascade.ts` — `cascadeRoots`, `resolveThroughCascade`,
  `assertNarrowsDownward`, and **`resolveForDispatch`**, which is the new part and the load-
  bearing one: resolution and enforcement in one call, so the run pipeline cannot obtain a
  runnable agent without the ceiling check having returned.
- `apps/runner/src/lib/agents.ts` — `loadAgent` split, exposing `recordFromSource` so the
  record that runs is built from **the same bytes the ceiling was derived from**. Nothing is
  re-read between the check and the run.
- `apps/runner/src/lib/runService.ts` — `startRun(services, project, request)`. Step 0 is the
  cascade; `loadAgent` is no longer on the dispatch path.

### The routes

- `apps/runner/src/routes/api.ts` — every project-scoped handler resolves `:project` first;
  `GET /api/projects`; `GET /api/all/approvals`; `StatusResponse.projects`; and the
  `LEGACY_UNSCOPED_PATHS` loop that answers `400 project_scope_missing`.
- `apps/runner/src/lib/runStore.ts` — `RunState` gains `project`, `agentRef`, `sourceRef`;
  `list`, `pendingApprovals` and `agentsAwaitingApproval` take a project and accept `'*'` for
  the deliberate cross-project read.
- `packages/contracts/src/api.ts` — `agentRef` + `sourceRef` on `SseStartData`.

### The prose

- `comms/decisions/ADR-015-project-scoping.md` — **new.** Q1–Q8 answered, nine decisions,
  every "must not" naming its mechanism.
- `comms/contracts/project-scoping.md` — §5.1 rewritten from questions to answers; §3's
  column table gains a *what enforces this* column; §5.3 re-owned to
  `identity-access-engineer`; Q16/Q18/Q20 answered.
- `comms/contracts/api-contracts.md` — the project axis section, `GET /api/projects`, the
  seven new error codes, `agentRef`/`sourceRef` on `start`.

---

## How to use it

```
GET  /api/p/agentos/runs            # project-scoped: the great majority
GET  /api/all/approvals             # deliberately cross-project: exactly two routes
GET  /api/status                    # the coordinator itself; says which project it answered for
GET  /api/projects                  # what the switcher lists
GET  /api/runs                      # 400 project_scope_missing, hint names the line above
```

```bash
AGNETOS_PROJECT_SLUG=agentos     # the mount. A config default, never a request default.
AGNETOS_PROJECT_NAME=AgentOS
AGNETOS_GLOBAL_LIBRARY=          # empty ⇒ two-level cascade. NOT an error.
```

```ts
// The only door to a runnable agent.
const dispatch = await resolveForDispatch(config, project, 'sales/account-enrichment');
// dispatch.record.allowlist  — already proven ⊆ the introducing layer's
// dispatch.agentRef          — agentos/sales/account-enrichment
// dispatch.sourceRef         — project:agents/sales/…/SKILL.md@sha256:…
```

---

## Contracts touched

| Contract | Owner | Change |
|---|---|---|
| `project-scoping.md` | mine, in trust | §5.1 answered, §3 rewritten, §5.3 re-owned. **§6 unchanged and has not shrunk.** |
| `api-contracts.md` | mine | project axis, `/api/projects`, seven error codes, SSE `start` fields |
| `agent-cascade.md` | `agent-library-curator` | **no edits.** `cascade.ts` implements ADR-014 §3/§7.3 and re-defines nothing. If ADR-014 changes, this follows it. |
| `frontmatter-schema.md`, `panel-schema.md`, `graph-layout.md`, `design-tokens.md` | others | none |

ADR: [ADR-015](../decisions/ADR-015-project-scoping.md), proposed. It depends on ADR-014,
which is also still `proposed` — see *Deliberately not done*.

---

## What I found half-finished, since the point of this handoff is that it was

1. **`config.ts` was missing all three fields the slice depends on.** `projectSlug`,
   `projectName`, `globalLibraryDir`. The runner did not typecheck at all.
2. **`cascade.ts` computed the ceiling but never the thing to compare it against.**
   `assertNarrowsDownward` existed and was correct, and **nothing in the repo called it.** The
   enforcement point was an exported function with zero callers — the precise shape of "a
   comment is not a mechanism", one level up from a comment. Fixed by computing both sides
   with the same parser (`CascadeResolution.resolved`) and by making `resolveForDispatch` the
   only door.
3. **`runService.ts` still called `loadAgent`.** The cascade was not on the dispatch path, so
   the layers were never read for a real run.
4. **The contract declared five things the server did not mount:**
   `LEGACY_UNSCOPED_PATHS`, `GET /api/projects`, `GET /api/all/approvals`,
   `StatusResponse.projects`, `PendingApproval.project`. The route table said the surface
   existed; the server 404'd it.
5. **The `:project` segment was decorative.** Routes had moved to `/api/p/:project/…` and no
   handler read the segment. Any slug matched and served the mounted project's data — which is
   the exact failure the path segment was chosen to prevent, arriving through the fix for it.
6. **`cascade-ceiling.test.ts` was cited in a source comment and did not exist.**

---

## Deliberately not done

- **`ops.identity` is not built.** One row, no behaviour, defined as a foreign-key target. It
  has an owner now (`identity-access-engineer`) and I defined the seam and stopped.
- **Scopes enforcement is not built** (Q17). BOARD #5 says there is no auth boundary in v1 by
  design, and **a scope with no enforcement point is a comment**. Building it now means
  building against no threat model and rewriting it when the auth ADR lands.
- **`budget_monthly` is not enforced** (Q6). Zero runs have executed, so per-project spend is
  uncomputable and any cap derived from it is a false refusal or a silent pass. Part V's
  workspace cap stays the only enforced ceiling, and `budgetEnforced: false` ships next to the
  number so no UI can render it as though it did something.
- **`host_affinity[]` is built and read by nothing**, with `hostAffinityEnforced: false` beside
  it. One host exists and Tailscale is not installed.
- **`library_remote` cannot be stored.** A `CHECK` holds the egress question open rather than a
  comment. Dropping a constraint is reviewable; ignoring a comment is not.
- **RLS is inert on this stack and the code says so, loudly.** Compose's Postgres user is a
  superuser, so every policy in migration 0005 is bypassed. `probeScopeEnforcement` asks the
  database and `/api/status → projects.scopeEnforcement` reports `enforced` / `bypassed` /
  `unknown`. **A hole you can see on a status page is a task; a hole in a migration comment is
  a surprise.** Closing it is one non-superuser role, filed to `infra-compose-engineer`.
- **Panels are not cascaded** (Q8). ADR-014's rules depend on properties panels do not have.
- **Q8b — one brain or N — is not answered**, and is not mine. `company/` resolves per project
  with **no global fallback**, which is the conservative side of an open question: if the
  ruling is "one brain", a fallback is additive; the other error would already have leaked, on
  every run, with no error message.
- **No `7` anywhere project-shaped.** The seven-vs-eight departments question is open and this
  slice does not touch it. Asserted, not just intended.
- **The 34 metrics endpoints are `observability-engineer`'s** and they landed their half
  concurrently during this session — see *Concurrency* below.
- **The web app is not updated.** It calls the pre-project paths and now receives
  `400 project_scope_missing`. That is the designed migration signal and it is
  `shell-navigation-engineer`'s slice; they were building `ProjectSwitcher.tsx` and
  `useProjects.ts` while this was written.

---

## Verification

**Runner suite — 119/119 pass**, up from 95 (of which one was failing when I arrived).

```
npm run test:runner
ℹ tests 119   ℹ pass 119   ℹ fail 0
```

**Runner typecheck clean:** `npx tsc --noEmit` in `apps/runner` exits 0. It did not before
this session — the slice as committed had 8 source errors and 21 more in tests.

**Root suite — 142 tests, 141 pass, 0 fail, 1 skipped** (the SQL-executes suite, which skips
without a live Postgres). The task named 108/108; the count grew because other agents added
`scripts/__tests__` suites during this session. No failures either way.

**Web — both halves green.** `npm run test:web` → *"both halves ran, both green"*.

**Token discipline — 0 violations**, with its provenance line per `design-tokens.md` §8b:

```
scanned at  2026-08-17 00:30 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web
files scanned  300      violations  0      exemptions  2
```

*(Note the timestamp now carries an explicit `+03:00` offset — `provenance.mjs` was fixed for
the UTC bug, so this is local time. 300 files, not the 291 in my brief: other agents added
components during the session.)*

### The tests that carry the argument

**`apps/runner/src/lib/__tests__/cascade-ceiling.test.ts` — 6 cases.** This is the condition
`commandcenter-orchestrator` attached to M15's PASS. It drives the **real** pipeline and
asserts on `options.allowedTools` — *what the session was handed* — never on a permission
decision or a validator's opinion of a file:

| Case | Asserts |
|---|---|
| project declares `[workspace, shell]` over a global `[workspace]` | `capability_widened`; **no session was ever constructed**; hint names the new-slug escape |
| project narrows to `[workspace]` under a global `[workspace, shell]` | the session receives exactly `Read/Write/Edit/Glob/Grep` and **never sees `Bash`**; `sourceRef` is `project:…@sha256:<64 hex>` |
| `approval` none→required, and required→none | tighten runs and **pauses**; loosen is refused with nothing spawned |
| global `SKILL.md` present but unreadable | `cascade_unresolved`, nothing spawned |
| **no global library configured** | **not an error** — the project layer is the ceiling |
| override wins, and over-widens | most-specific file runs, `sourceRef` is `override:…`; a widening override is refused **against L0's path, not L1's** |

The second row matters as much as the first: a refusal-only test passes just as happily
against an implementation that refuses everything.

**`apps/runner/src/lib/__tests__/project-id.test.ts` — 5 cases.** Reads
`0005_project_axis.sql` and asserts the id expression, the slug regex, the reserved list, the
seed slug, the `library_remote` CHECK and the absence of any department enum, character-for-
character against the TypeScript. Editing either side alone fails in milliseconds, with no
database.

**`apps/runner/src/routes/__tests__/api.test.ts`** — walks `LEGACY_UNSCOPED_PATHS` and asserts
every one refuses with `project_scope_missing`, names its replacement, and **does not also
carry a result set**; plus the three distinct project refusals and the cross-project route.

### Acceptance criteria — structural or empirical

Stated in the two categories `project-scoping.md` §6 demands, because a handoff that blurs
"done" into "proven" is the failure mode here. **Zero runs have ever executed.**

| # | Criterion | Kind | Evidence |
|---|---|---|---|
| 1 | A lower layer cannot widen `wired_into` or loosen `approval` | **structural — strong** | The session is never constructed. Asserted on the allowlist actually received, not on a decision. This is the one no-error-message property obtainable before the key lands. |
| 2 | An unreadable introducing layer refuses rather than trusting the readable copy | **structural** | EISDIR fixture; `cascade_unresolved`; nothing spawned |
| 3 | An unconfigured global library is not an error | **structural** | Two-level cascade case passes |
| 4 | No route serves project data without a project in its path | **structural** | Every legacy path asserted; `resolveProject` is a function, so a route that forgets it fails to compile |
| 5 | `project_not_mounted` ≠ `project_not_found` ≠ `project_scope_missing` | **structural** | Three codes, three statuses, asserted |
| 6 | The SQL id and the TypeScript id are the same identifier | **structural** | Migration text read and compared |
| 7 | `unknown` is distinguishable from `zero` from the first migration | **structural** | `account_source: 'unattributed'` + `CHECK account_provenance`; `scopeEnforcement: 'unknown'`; `scopeEnforced: null` |
| 8 | Nothing project-shaped assumes seven departments | **structural** | Asserted over comment-stripped SQL |
| 9 | Deleting a project cannot destroy history | **structural, unexecuted** | `ON DELETE RESTRICT` exists in SQL. **No Postgres was up; this migration has never been applied.** |
| 10 | An unscoped query raises instead of returning rows | **structural, and currently inert** | The policy exists. RLS is **bypassed** by the superuser this stack connects as. Reported, not assumed. |
| 11 | Cross-project isolation, **empirically** | **not obtainable** | `ops.agent_runs` has no rows to leak |
| 12 | The cascade picks the agent the human *meant* | **not obtainable** | Choosing wrong has no error message; only a real run reveals it (`Plan §21.9`) |
| 13 | `budget_monthly` refuses at the cap | **not obtainable** | No run has ever cost anything |
| 14 | Per-project `COMPANY.md` behaves differently from a global one | **not obtainable** | The one project that exists is 0/20 answered |

Rows 11–14 are `project-scoping.md` §6 verbatim and are blocked on the **human**, not on an
agent: `RUNNER_ANTHROPIC_API_KEY` and the twenty interview answers. Row 10 is blocked on
`infra-compose-engineer`.

**`rtl-arabic-pdpl-specialist`'s mandatory isolation sign-off can only be structural, and must
say so.** Signing it as empirical would be the lie this project is organised to avoid.

---

## Concurrency — read this before assuming a file is mine

Four agents were editing this repo simultaneously during this session:
`observability-engineer` (`db/queries.ts`, `db/registry.ts`, `db/scope.ts`, `routes/metrics.ts`,
`routes/register-metrics.ts`), `identity-access-engineer` (migrations 0006/0007, ADR-016),
`shell-navigation-engineer` (`ProjectSwitcher.tsx`, `useProjects.ts`) and
`design-system-guardian`.

I began adapting `routes/metrics.ts` and `register-metrics.ts` to the project axis, then
**backed out** when their better version landed mid-edit, and wired to the seam they designed
instead — `MetricsMount.resolveProject`, which takes my `lib/project.ts` resolver rather than
an id, so there is one resolver and one set of refusals. Two edits of mine survive in files I
do not own and both are mechanical adaptations to interfaces they had already shipped:

- `apps/runner/src/db/__tests__/sql-executes.test.ts` — every query given `projectId`, because
  `MetricFilter.projectId` is now required and `bindNamedQuery` takes a project. Their suite
  did not compile; it does now. **fyi filed.**

I reverted my changes to `observability/__tests__/metrics.test.ts` entirely rather than
half-adapt it to a shape they had superseded.

---

## Next agent

**`fidelity-qa-reviewer`** — review request filed. Read, in order:
`project-scoping.md` §6 (what cannot be validated and why), then ADR-015's *Consequences*,
then the acceptance table above. The PASS here is necessarily narrower than usual and the
narrowness is the deliverable, not an excuse.

**`shell-navigation-engineer`** — every unscoped call in `apps/web` now gets a named 400.
`projectPath()` and `PROJECT_ROUTE_PREFIX` in `@agnetos/contracts` are what to build URLs
with; `GET /api/projects` is what the switcher lists.

**`drawer-engineer`** — `sourceRef` and `agentRef` arrive on the SSE `start` frame, before any
token. The layer prefix (`global:` / `project:` / `override:`) is the provenance badge's input.

**`rtl-arabic-pdpl-specialist`** — the isolation sign-off, and Q8b, which is the highest-stakes
open question in the contract and does not look like it.

**`infra-compose-engineer`** — one non-superuser role for the runner's connection turns
migration 0005 §5 from inert to enforced, and flips `scopeEnforcement` from `bypassed` to
`enforced` on a status page that already reports it.
