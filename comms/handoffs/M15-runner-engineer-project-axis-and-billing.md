---
agent: runner-engineer
milestone: M15
spec: Plan §9 · §10 · §11 (a plan that amends the spec of record — ADR-013) · spec §3.2 · Part V · Part VII.4
created: 2026-08-17T17:57
status: ready-for-review
---

# M15 closure — the mount, the enforcement proof, and the billing half

**Read [`M15-runner-engineer-project-axis.md`](M15-runner-engineer-project-axis.md) first.** It
is the record of the project-axis slice as it was built and it is not superseded. This file is
the closure half: the enforcement proof the BOARD attached to M15's PASS, the `ops.credential` /
billing-account slice that the first handoff named but did not describe, and **one defect the
proof work uncovered** — the write path of the very table the project axis was added to.

Two sentences that govern how to read everything below, both from the BOARD and neither
softened here:

> **M15 can be completed. M15 cannot be *validated* until Phase 0's human items land.**

> Zero runs have ever executed. **Migrations 0005, 0006 and 0007 have never been applied to a
> real Postgres**, by anyone, on any machine. Every claim below about the database is a claim
> about SQL text and about code that would send it.

---

## 1. The condition the PASS turns on

The BOARD's extra condition on M15's cascade half, adopted from `agent-library-curator`:

> the PASS requires a **runner test asserting on the allowlist the session actually received**,
> not on the validator's opinion of the file. *"CI is not a boundary."*

**`apps/runner/src/lib/__tests__/cascade-ceiling.test.ts` — now 10 cases** (was 6). Every one
drives the real pipeline — `startRun`, the real cascade, the real config — with a session
factory that records `AgentSessionOptions`, and asserts on what the session was *handed*.

| # | Case | What is asserted on |
|---|---|---|
| 1 | project `[web-search, workspace]`, no global | `allowedTools` **deep-equals** `['WebSearch','Read','Write','Edit','Glob','Grep']` — no base set, no sibling connector, no MCP family |
| 2 | `wired_into: []` | `allowedTools` is `[]`, and the gate refuses even a path inside the scratch dir |
| 3 | `wired_into: [workspace, telepathy]` | `unknown_connector`; **no session constructed with the surviving half** |
| 4 | global `[workspace, shell]` → project `[workspace]` | **the gate closure**: `Bash` refused by name; `Write` inside cwd allowed; `Write(repo/.env)`, `../../../etc/passwd` and a library path all refused; `Grep({pattern})` still allowed |
| 5 | project `[shell]` over global `[workspace]` | `capability_widened`; `allowedTools` is `null` — no session ever existed; hint names the new-slug escape |
| 6 | project narrows under a wider global | session receives exactly the narrowed list; `sourceRef` is `project:…@sha256:<64 hex>` |
| 7 | `approval` none→required / required→none | tighten pauses at the gate with nothing spawned; loosen is refused |
| 8 | global `SKILL.md` present but unreadable | `cascade_unresolved`, nothing spawned |
| 9 | **no** global library configured | **not an error** — the project layer is the ceiling |
| 10 | override wins, and over-widens | most-specific file runs; a widening override is refused against **L0's** path, not L1's |

Cases 1–4 are new and map to the four the brief asked for: (a) exactly `wired_into`, in both
directions — never a superset **and never a silently smaller subset**, which is ADR-009's
failure mode; (b) narrowing honoured, case 6; (c) widening refused, cases 5 and 10; (d) the
gate reads the tool's **argument**, case 4.

**Why (d) is asserted here as well as in `workspace-confinement.test.ts`.** That file proves
the path gate against the *filesystem*, which is the stronger assertion and stays the primary
evidence. But it runs a single-layer agent: it would still pass if the cascade path had
assembled the gate from the wrong file's allowlist, or from no allowlist at all. Case 4
captures `AgentSessionOptions.isToolAllowed` itself, on a list a project layer narrowed, and
exercises both gates through it.

**Nothing here proves the cascade picks the agent a human *meant*.** That has no error message
and needs a real run (`project-scoping.md` §6, `Plan §21.9`). What is proved is structural:
whatever the cascade picks, its tool list cannot exceed the introducing layer's, and the
session is never constructed when it would.

---

## 2. `resolveForDispatch` is the only door — verified by reading, and now by a test

**Verified by reading, not memory.** Every caller in the shipped runner:

```
recordFromSource   imported by  lib/cascade.ts                       ← the only producer
resolveForDispatch imported by  lib/runService.ts                    ← the only caller
loadAgent          imported by  lib/schedule.ts, routes/api.ts       ← neither dispatches
services.session(  called in    lib/runService.ts                    ← one session, one allowlist
```

`assertNarrowsDownward` has one call site, inside `resolveForDispatch`, and it returns
**before** `recordFromSource` runs — so the `AgentRecord` does not exist until the check has
passed.

**`apps/runner/src/lib/__tests__/one-door.test.ts` — new, 5 cases.** Four read the shipped
source and assert those sets **exhaustively**, not by containment: a test that checked only for
the presence of the right caller would pass just as happily the day a second one is added,
which is the entire event the file exists to catch. The fifth is behavioural and shows what a
second door would buy — the same fixture through `loadAgent` returns an agent holding `Bash`
that the global layer never granted, while `resolveForDispatch` refuses it.

**The mechanism was verified against a planted second door**, the same way
`repo-conformance.test.mjs` was verified against a planted duplicate migration: a throwaway
module importing `recordFromSource` was added under `src/lib/`, the suite failed on the named
assertion, and the module was removed.

> ✖ the dispatch path has exactly one producer of a runnable agent
> AssertionError: only the cascade may build a record from chosen bytes — a second importer is a second door

Source-reading is the right instrument because the property is *which code exists*, not what a
call returns. A behavioural test cannot see an entrance nobody has walked through yet — which
is exactly how `assertNarrowsDownward` came to be exported with zero callers and no test
noticed.

### The one honest asterisk on "only door"

`lib/schedule.ts` calls `loadAgent` to find the file to write `schedule:` into, and that is the
**project layer's** file, not the cascade winner. Today they are the same file — this repo has
no global library and no `_overrides/` — so nothing is wrong now. The day an override wins,
`POST /api/schedule` would write the cron into a file that does not run. It is a *write* door,
not a *run* door, so it does not weaken the claim above, and it is named in `one-door.test.ts`
next to the assertion rather than left for someone to find. **Deliberately not fixed** — the
fix is a decision about whether a schedule belongs to the resolved agent or to a layer, which
is `agent-library-curator`'s under ADR-014, and I have asked rather than assumed.

---

## 3. `ops.credential`, billing accounts, and who paid

The slice the first handoff named and did not describe. `Plan §11` names one `ops.credential`;
ADR-014 §3.1 needs it keyed `(project_id, connector)`. **ADR-015 §9 split it into two tables,
because they scope oppositely and one table would have forced a nullable `project_id`** —
which is `project-scoping.md` invariant 8 with the safety off.

| Table | Scope | Why |
|---|---|---|
| `ops.billing_account` | **cross-project**, deliberately | One work account pays for four clients. Not row-level-scoped, and that is a decision, not an omission |
| `ops.credential` | **project-only**, PK `(project_id, connector)` | A resolved `wired_into: [hubspot]` means *this project's* HubSpot |

**Neither stores secret material.** `secret_ref` is the *name* of a secret — an env var, a file
on a mounted volume — resolved at dispatch. That makes `Plan §11`'s *"encrypted at rest with
the key outside Postgres"* **structurally true** rather than a claim about an encryption
routine nobody has written: there is no ciphertext column to decrypt and no key to lose (Q18).

**There is no global credential fallback, and the mechanism is the absence of one:** the primary
key has no nullable `project_id` to fall through to, and the lookup has no second branch. Stated
as a rule precisely because *"fall back to the global one"* is the convenience a future
implementer adds at 2am to unblock one project.

**Who paid, per run.** `ops.agent_runs.account_id` + `account_source`, with
`CHECK account_provenance` making `account_id IS NULL` legal **only** when
`account_source = 'unattributed'`. `unattributed` is a named third state, not a `NULL`: *"we do
not know who paid"* must be its own bucket on a cost-by-account surface, not rows a chart
quietly drops.

**Every run today records `unattributed`, and that is the truthful value.** No billing account
row exists, `ops.project.default_account_id` is null, and the runner does not read it in M15.
`runService.ts` passes `accountSource: 'unattributed', accountId: null` explicitly rather than
omitting them — the comment at that call site says why, so nobody later reads the constant as a
placeholder to fill in with something plausible.

**The one enforced ceiling is still Part V's capped API-key workspace** (`lib/billing.ts`):
`assertCanStart()` refuses before anything is spawned, with a hint written for a human on a
phone, and `budget.persisted` reports `true` / `false` / `null` so a cap that silently went
soft is visible. `ops.project.budget_monthly` remains **declared and not enforced**, with
`budgetEnforced: false` shipped beside it on every `ProjectSummary`.

**`RUNNER_ANTHROPIC_API_KEY` is untouched, unstubbed and unworked-around, and no figure has been
written into `spend.json`.** The file does not exist on this machine and this session did not
create one.

---

## 4. The defect the proof work found — the write path of the table the axis was added to

Stated at the top of its own section because it is the most important thing in this handoff and
it is **mine**.

Migration 0005 added `project_id`, `agent_ref`, `source_ref` and `account_source` to
`ops.agent_runs`, backfilled them, and set every one **`NOT NULL`**. It also replaced
`app.agent_outputs`'s unique index `(kind, entity_key)` with `(project_id, kind, entity_key)`.
**`apps/runner/src/db/ledger.ts` — the only writer of both tables — knew about none of it.**

Nothing anywhere failed, and each reason is worth writing down because together they are why
this survived a handoff, an ADR and a review request:

- `tsc` cannot see a column list inside a template literal.
- `sql-executes.test.ts` uses `PREPARE`, which **plans** a statement. Planning resolves column
  names and infers the `ON CONFLICT` index; it does not evaluate a `NOT NULL` constraint. That
  probe would have passed. *(And it never ran: see §6.)*
- The migrations have never been applied and zero runs have executed, so nothing had the
  opportunity to notice.

The first run of step 0.3 — the first real run this project ever performs — would have raised a
`NOT NULL` violation **after the model had been paid for**, and the ledger would have been empty
in exactly the way an honest empty ledger is empty. The `app.agent_outputs` half would have
failed differently and worse: `ON CONFLICT (kind, entity_key)` no longer matches any index, so
the first business row an agent wrote would have errored at plan time.

**Fixed:**

- `db/ledger.ts` — `recordRun` inserts all 31 columns; `writeOutput` takes a required
  `projectId` and targets `(project_id, kind, entity_key)`.
- `observability/types.ts` — `RunInit` gains `projectId`, `agentRef`, `sourceRef`, `accountId`,
  `accountSource` as **optional**; `RunRecord` carries all five. Optional there and required at
  the ledger, deliberately: `--profile dev` has no Postgres and the metrics fakes build a
  `RunInit` by hand, so the place the values cannot be absent is the place they are written.
- `observability/instrument.ts` — carries them onto the record. **Nothing is derived.**
  `agent_ref` *could* be rebuilt as `${project}/${agent}`; `source_ref` could not. Rebuilding
  one and not the other would produce a row that looks complete and is half invented.
- `lib/runService.ts` — supplies them from `project.id` and the cascade's `dispatch`.
- `recordRun` **refuses** an unattributed run (`run_unattributed`) rather than defaulting. Same
  decision as `assertProjectId` on the read path and for the same reason: a default here
  attributes one project's run to another, permanently, in the table every cost and liveness
  number is read from. It also mirrors the DB's `CHECK (agent_ref LIKE '%/' || agent)` in
  TypeScript, so the two columns are caught disagreeing where the message can name both.

**`apps/runner/src/db/__tests__/ledger-project-axis.test.ts` — new, 4 cases.** The first is the
general gate rather than a fix for this instance: it parses every `.sql` under `migrations/`,
collects every `NOT NULL`-without-`DEFAULT` column on `ops.agent_runs`, and asserts each one
appears in the INSERT's column list — plus one placeholder per column and one parameter per
placeholder. **The next migration that adds a required column to this table fails here**, with
no database, in milliseconds. The four project-axis columns are additionally named explicitly,
so "fixing" the test by giving `project_id` a `DEFAULT` still fails — an ambient default project
is the precise mechanism ADR-015 Q2 refuses.

*Ownership note:* `db/scope.ts`'s own header records the orchestrator's ruling —
*"`runner-engineer` owns `ops.project` and the write path; this module and everything downstream
of it is `observability-engineer`'s."* The three files above are the write path and the contract
type it codes against. `fyi` filed to `observability-engineer` naming every line, because a
change in a file you own should never arrive as a surprise in a diff.

---

## 5. Migrations 0005–0007 have never been applied to a real Postgres

Explicitly, because four handoffs now depend on it and none of them can be read as having
proved it.

- **0005** `project_axis` — `ops.project`, `ops.billing_account`, `ops.credential`, the axis on
  four existing tables, and row-level security. Mine.
- **0006** `ops_device` — `sessions-relay-engineer`'s.
- **0007** `identity` — `identity-access-engineer`'s.

No Postgres has been up in any session that wrote them. `sql-executes.test.ts` is the only thing
that would exercise them and it **skips** without `DATABASE_URL` — 3 skipped tests in the runner
suite, reported as skipped rather than counted as passes. So:

| Claim | Status |
|---|---|
| The SQL is syntactically valid | **unverified.** Not parsed by anything but a human |
| `ON DELETE RESTRICT` refuses a delete with history behind it | **structural, unexecuted** |
| RLS raises `42501` on an unscoped read | **structural, and currently inert** — compose's Postgres user is a superuser, so every policy is bypassed. `probeScopeEnforcement` asks and `/api/status → projects.scopeEnforcement` reports `enforced` / `bypassed` / `unknown` |
| The deterministic id matches between SQL and TypeScript | **proved without a database** — `project-id.test.ts` reads the migration text |
| The ledger INSERT satisfies the schema's NOT NULLs | **proved without a database** — §4, new this session |

Running them is one command against the compose stack and it needs no API key. It is the
highest-value unblocked task left on this milestone and it is item 1 on my status file.

---

## 6. Two test files existed and were never run

Found while adding the new suites. `apps/runner/package.json`'s `test` script was an **explicit
list of 15 files**, and `src/db/__tests__/sql-executes.test.ts` and
`src/observability/__tests__/ops-prune.test.ts` were not on it. They had been written, reviewed,
cited in handoffs, and never executed by `npm run test:runner`.

This is the same defect class as an exported function with zero callers, and the same class as a
coverage table that fails nothing: **a thing that looks enforced and is not.** A hand-maintained
list of test files fails open — forgetting to add a file is silent, and the file it protects is
the one nobody notices going stale.

Replaced with `tsx --test "src/**/__tests__/*.test.ts"`. The suite went from 15 files / 127
tests to 17 files / 143 tests (140 pass, 3 skipped — the SQL suite, honestly skipped for the
absence of a database). **The 16 tests that appeared were not written this session; they were
already in the repo, passing, and uncounted.**

---

## Verification

Provenance line per `design-tokens.md` §8b — **the tree was moving while this ran**;
`rtl-arabic-pdpl-specialist` was editing `brain.ts`/`runService.ts` and `drawer-engineer` was
editing `apps/web/src/drawer/**` in the same window.

```
2026-08-17 17:57 +03:00 · 1e5b5d7 · 35 uncommitted (18 modified, 5 untracked, 4 of them mine)
```

| Suite | Result |
|---|---|
| `npm run test:runner` | **143 tests · 140 pass · 0 fail · 3 skipped** (was 119 pass / 15 files) |
| `npx tsc --noEmit` (runner) | exit 0 |
| `npm run typecheck` (all workspaces) | exit 0 — web, runner, contracts |
| `npm test` (root) | **142 tests · 141 pass · 0 fail · 1 skipped** |
| `npm run test:web` | **not run.** Another agent is mid-edit in `apps/web/src/drawer/**`; the BOARD already records 5 red vitest tests from in-flight switcher work and says not to gate on a moving tree. No file of mine is in `apps/web` |

Files added or changed this session:

```
apps/runner/src/lib/__tests__/cascade-ceiling.test.ts   +4 cases, captures isToolAllowed + cwd
apps/runner/src/lib/__tests__/one-door.test.ts          new — 5 cases
apps/runner/src/db/__tests__/ledger-project-axis.test.ts new — 4 cases
apps/runner/src/db/ledger.ts                            the project axis on the write path
apps/runner/src/observability/types.ts                  RunInit / RunRecord carry it
apps/runner/src/observability/instrument.ts             carries it onto the record
apps/runner/src/lib/runService.ts                       supplies it at startRun
apps/runner/src/db/__tests__/sql-executes.test.ts       probe fixtures gain a project
apps/runner/package.json                                test script is a glob, not a list
```

---

## Deliberately not done

- **The migrations are not applied.** Postgres is not up in this session. Applying 0005–0007 is
  the first unblocked item on my list; I am not claiming it as done by writing that sentence.
- **`connector_uncredentialed` still has no test.** `agent-library-curator` asked for the exact
  fixture — seed a credential for project A, dispatch in project B. It needs Postgres, not a
  key. Owed since 2026-08-16 and still owed.
- **`ops.credential` is never read.** No code path resolves a `secret_ref` yet, because no
  connector is real (MCP runtime is M9). The table, the split and the refusal exist; the lookup
  does not. Stated so nobody reads §3 as "credentials work".
- **No billing account row exists and none is seeded.** Seeding one would put a payer in a
  cost surface that nobody configured — a fabricated number inside a billing control.
- **`budget_monthly` is not enforced** (ADR-015 Q6); `host_affinity[]` is read by nothing (Q7).
  Both ship with their `…Enforced: false` sibling.
- **`library_remote` cannot be stored** — a `CHECK`, not a comment, holding the egress question
  open until `rtl-arabic-pdpl-specialist`'s ADR.
- **Scopes enforcement is not built** (Q17). A scope with no enforcement point is a comment.
- **RLS is inert on this stack** and the status page says so rather than the migration comment.
  One non-superuser role closes it; filed to `infra-compose-engineer`.
- **`setSchedule` writes to the project layer, not the cascade winner** (§2). Named, tested
  around, and routed to `agent-library-curator` rather than fixed by guess.
- **`agent_ref` is not yet the key `ops.agent_run_daily` rolls up on in the runner's code** —
  the migration fixed the *table* (`(day, project_id, agent)`), and `ops.rollup_runs` groups by
  `project_id, agent`. ADR-014 §2 says two projects' same-slug agents are two agents, and that
  is now true in the key. Whether the rollup should key on `agent_ref` instead of
  `(project_id, agent)` is a question for `observability-engineer` and is not answered here.
- **Q8b — one brain or N — is not answered and is not mine.** `company/` resolves per project
  with no global fallback: the conservative side of an open question.
- **No web changes.** Nothing in `apps/web` is mine and another agent is mid-edit there.

---

## Next agent

**`fidelity-qa-reviewer`** — review request filed. The order that makes this readable:
`project-scoping.md` §6 (the seven things M15 cannot validate), then ADR-015's *Consequences*,
then §1 and §4 above. **The PASS is necessarily narrower than usual and the narrowness is the
deliverable.** §4 is a defect found and fixed inside my own slice after that slice was already
submitted for review — it should be read as evidence about what the first review could not have
caught, not as a reason to widen the gate.

**`observability-engineer`** — `fyi` filed. `RunInit` gains five optional fields and `RunRecord`
five required ones; `recordRun` refuses an unattributed run; your `ops-prune.test.ts` now
actually runs. Nothing downstream of `db/scope.ts` was touched.

**`agent-library-curator`** — the runner test you specified exists in the shape you specified,
and now covers the argument gate too. One thing for you: §2's schedule/cascade asterisk.

**`infra-compose-engineer`** — bringing Postgres up is what turns §5's whole table from
structural into executed, and it needs no API key.
