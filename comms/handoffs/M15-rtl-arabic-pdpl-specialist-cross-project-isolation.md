---
agent: rtl-arabic-pdpl-specialist
milestone: M15
spec: Plan §22 · Plan §21.8 · Part VII.4 · §3.3 · project-scoping.md §6, invariant 8
created: 2026-08-17T17:57
status: ready-for-review
---

# M15 — cross-project isolation, second pass: the audit of the code as landed

Provenance for everything mechanical below: **scanned at 2026-08-17 17:57 +03:00 · `1e5b5d7`
· 33 uncommitted.** The tree moved twice while I was in it (see *Verification*), so every
claim here is dated and two of them are dated *because* they changed under me.

This is the **second** pass. The first
(`comms/inbox/rtl-arabic-pdpl-specialist/20260816-2235-…-m15-isolation-signoff.md`, answered
00:20, amended 01:05) graded eight properties **armed / inert / absent by design**. That
grading stands with **one correction and one addition**, both below, and neither is cosmetic.

---

## The sentence, first, because it is the part that gets quoted

> **This remains a STRUCTURAL sign-off. Every mechanism named here was read out of source or
> out of SQL. Not one of them has been exercised against two projects holding real rows,
> because zero runs have ever executed and exactly one project is mounted. Isolation has been
> *built*, and since 00:28 last night one of its layers has been *measured* to be switched
> off. It has not been *observed working*, and it cannot be until `RUNNER_ANTHROPIC_API_KEY`,
> a non-superuser role and a second mounted library all exist.**

Quote that whole paragraph or none of it.

---

## Correction to the first pass — the write path was never audited, and it would have failed

My 00:20 verdict graded five properties **ARMED** on the strength of the schema:
`PRIMARY KEY (day, project_id, agent)`, the unique index on `(project_id, kind, entity_key)`,
`agent_ref NOT NULL` + its CHECK, the FKs. All of that was true about the *table*.

**I did not read the writer.** When I did, this pass:

| Defect, as of 17:20 today | Consequence |
|---|---|
| `db/ledger.ts` `recordRun` inserted 26 columns and named **none** of `project_id`, `agent_ref`, `source_ref`, `account_source` — all four `NOT NULL` in 0005 with no default | the **first real run** against a migrated database fails on a Postgres NOT NULL violation. The ledger stays empty in exactly the way an honest empty ledger is empty |
| `writeOutput`'s `ON CONFLICT (kind, entity_key)` still targeted the index 0005 **dropped** | `42P10` at plan time — no business row could ever be written |

Both were **fixed in the working tree by `runner-engineer` while this audit was running**
(`db/ledger.ts`, `observability/instrument.ts`, `observability/types.ts`, `lib/runService.ts`
— all uncommitted at `1e5b5d7`). The fix is the right one and refuses rather than defaulting:
`assertAttributed` throws `run_unattributed` when a run reaches the ledger without a project,
a ref or a source, and the comment gives the reason I would have given — *"recording it under
a guessed project would put an invented row in the table every cost figure is read from."*

**What I am recording is not the bug. It is the grading error.** A constraint the writer
cannot satisfy is not protection; it is an outage that presents as an empty state. "ARMED"
described the reader's side of five properties and said nothing about whether anything could
get past them, and there is exactly one way to find that out — run — which is the thing this
milestone cannot do. The general form, for the next sign-off of this shape:

> **Grade a constraint from both sides. A NOT NULL nobody can satisfy and a NOT NULL that
> holds look identical from the schema, and only one of them has a working product behind it.**

---

## Addition — three read paths that resolve the project and then discard it

`routes/api.ts` calls `projectOf(ctx, request)` at the head of every scoped handler, which is
correct and is the mechanism ADR-015 Q1 describes. Four handlers then **do not use the value**:

```
GET /api/p/:project/graph      → readGraph(config, …)
GET /api/p/:project/agents     → listAgents(config, …)
GET /api/p/:project/agents/*   → loadAgent(config, slug)
GET /api/p/:project/panels     → listPanels(config)
GET /api/p/:project/panels/:id → readPanel(config, id)
```

Every one of those reads `config.agentsDir` / `config.panelsDir` / `config.graphFile`. The
run path does **not** do this — `resolveForDispatch(config, project, slug)` reads
`project.agentsDir` through `cascadeRoots` — so the library plane is project-aware at
dispatch and coordinator-scoped on every read that renders MAP, CHART and DASHBOARDS.

It cannot leak today: one library is mounted, `config.agentsDir === project.agentsDir`, and
`resolveProject` refuses every other slug with `project_not_mounted`. **That is the point.**
The isolation of these five routes is currently a *coincidence between two variables* rather
than a *derivation from one*, and invariant 8's whole argument is that the difference is
invisible until the day it is not. This is the same shape as the brain defect, one plane up,
and it should be closed the same way — by taking `MountedProject`.

Filed to `runner-engineer`, not fixed here: five signatures across three modules that are
theirs, and `readGraph` in particular has a stored-artifact question (`graphFile` is one path
for the whole coordinator) that is a design decision rather than a parameter change.

---

## The brain write-back — confirmed still broken, and **fixed** (this is the code change)

`company/COMPANY.md` rule 9's write-path consequence was still true in the tree as it stood
at 17:20. Both halves of the gate were project-blind, exactly as written:

- `if (agentSlug !== INTERVIEW_AGENT_SLUG) return null` — `intelligence/company-interview` is
  identical in every project under the cascade, so this answers *"is this the interview?"* and
  cannot answer *"whose?"*.
- `writeFile(config.companyFile, …)` — one path, for every project, forever.

At N=2 that is project two's interview overwriting project one's brain, `commitCompanyFile`
recording the overwrite as that brain's git history, and §3.3 injecting the result into every
subsequent run of the project it destroyed. No error message and no defect anywhere else.

**Fixed** in `apps/runner/src/lib/brain.ts` + `apps/runner/src/lib/runService.ts`:

1. **The gate keys on `agent_ref`**, and the permitted ref is *derived from the project being
   written to* — `brainWriteRef(project)` → `` `${project.slug}/intelligence/company-interview` ``.
   There is no pair of arguments for which the agent named and the file written can disagree
   about the project.
2. **The target is the mounted project's `companyFile`**, not a path in the config. A new
   `BrainTier` structural type (`companyDir` · `companyFile` · `companySourcesDir`) is what
   `computeBrainCompleteness`, `readCompanyBrain` and `writeBrainSnapshot` now take; both
   `RunnerConfig` and `MountedProject` satisfy it, so `/api/status` and the watcher are
   unchanged and the run pipeline passes the project.
3. **A write to the global tier is refused outright, and loudly** — it `throw`s
   (`git_write_refused`) rather than returning the `null` the legitimate refusals return,
   because a silent null here reads as *"the interview produced nothing"*, which is the
   sentence that stops anyone looking. The interview is a client-facing agent; the global tier
   is injected into every run of every project.
4. `readCompanyBrain(project)` on the **read** side too — §3.3 injects into every invocation,
   so a tier resolved from config would have been the same leak arriving on the read path.
5. Two smaller lies removed: the returned `path` was the literal `'company/COMPANY.md'` and
   the `updatedAt` pathspec was the same literal. Both are now derived from the tier.

Four tests added, all structural and none needing a database, an API key or a second real
library — which is what "provable in M15" means on a write path:

| test | proves |
|---|---|
| `project two's interview cannot overwrite project one's brain` | the ref-vs-mount disagreement is refused and project one's file is byte-identical |
| `the target is derived from the mounted project, not from a path in the config` | client-b's write lands on client-b's file and the coordinator's `COMPANY.md` is untouched |
| `a write to the global tier is refused outright, loudly` | `git_write_refused`, and the global file is unchanged |
| `INTERVIEW_AGENT_SLUG alone is not a key` | direct regression guard: pass the bare slug and the write is still refused |

---

## PDPL rule 4 — enforceable, or merely stateable?

**Answer: enforceable in three planes, stateable in a fourth, and one of the three is
currently switched off.** Rule 4 is *"client data does not cross clients"*; M15 is the first
release in which that sentence has a code surface at all, and the honest grading is per-plane
rather than per-rule.

| Plane | Rule 4 is… | The mechanism, and its state |
|---|---|---|
| **Operations (Postgres)** | **enforceable, one layer inert** | `project_id` bound on every ops statement (**armed**, and it is what filters today) · RLS `ops.project_visible()` raising `42501` (**inert** — measured `false` at 00:28, superuser bypass) · `PRIMARY KEY (day, project_id, agent)` and the `(project_id, kind, entity_key)` unique index (**armed**, and both were real cross-client *write* collisions) · `assertAttributed` on the ledger writer (**armed as of tonight, uncommitted**) |
| **Library (git)** | **enforceable at dispatch, coincidental on reads** | `cascadeRoots(config, project)` derives all three roots from the project (**armed**) · the five read routes above do not (**coincidence**) |
| **The brain (§3.3)** | **enforceable as of this handoff** | the ref-keyed gate + the project-derived target + the global-tier refusal, four tests (**armed**) · one brain or N is settled: **two tiers, project-first, no global fallback** |
| **Traces (Langfuse)** | **merely stateable** | redaction runs at instrumentation, once, with no unredact path — that is rule 3 and it is genuinely armed. But **no span carries a project attribute**: `langfuse.trace.metadata.*` holds agent, department, trigger, status, dry_run, cost_source, redactions and no project. N clients' traces land in one Langfuse project, interleaved, unfilterable |

The trace row is the one I would not sign as enforceable, and it is worth more than a
footnote because it also breaks **rule 7, right to erasure**: if a subject asks for deletion,
there is no project handle in the trace store to search on. Redaction reduces what is there;
it does not give you a way to find the rest. Filed to `observability-engineer` as a joint
redaction-layer item (that rule list is co-owned).

The residual, stated rather than hidden: `ops.device.name` and `ops.identity.display_name` are
free-text fields a human writes. I signed both tables as *absent by design* (no project axis,
no client data) and I stand by it — a device name and a public key are facts about the
operator's hardware. Nothing stops a human typing "ACME's phone". A `CHECK` cannot fix that
and should not try. It is a training fact, not a code defect, and it belongs in the ADR that
answers the egress question.

---

## Every read path and every write path, with the one question asked of each

*Can data from project A reach a consumer in the context of project B?*

| Path | Answer | Basis |
|---|---|---|
| ops metrics reads (10 routes) | **no** | `project_id = $1::uuid` on every statement in `queries.ts`, `requireProject` throwing rather than defaulting, `readInProject` setting the GUC transaction-locally so a pooled connection cannot hand a stale scope to the next borrower |
| named business queries (registry) | **no** | `PROJECT_ID_SLOT` sentinel in `fixed[0]`; `bindNamedQuery` refuses a served query whose first slot is not the sentinel (`unscoped_query`); the project is a *positional* argument so a panel cannot supply it |
| tool spans (`/runs/:runId/tools`) | **no** | the join goes through `ops.agent_runs`, and `runExistsInProject` separates "no tool calls" from "not your run" → `run_not_in_project` (404), not an empty drawer |
| an artefact download | **no today, by cache** | `runInProject` compares `state.project` and returns `run_not_found` rather than a wrong-project code — correct, since confirming an id exists elsewhere is itself a disclosure. But the in-memory store is bounded at 200 and dies with the process, and **`artifactsRoot/<runId>/` has no project segment on disk**. The isolation of the durable bytes is a property of a cache, not of the store |
| `GET /api/all/approvals` | **yes, by design — and it carries payload** | the one deliberate cross-project route with content in it: every row includes `inputs`. Labelling each row with its project is not isolation. Recommend it return the label and the count, not the inputs |
| the run ledger write | **no, as of tonight** | `assertAttributed` + `agent_ref`/`agent` agreement check + five project columns |
| `app.agent_outputs` write | **no, as of tonight** | `projectId` required on `AgentOutput`; upsert re-targeted at `(project_id, kind, entity_key)` |
| the brain write-back | **no, as of this handoff** | above |
| the brain **read** (`§3.3`, every invocation) | **no, as of this handoff** | `readCompanyBrain(project)` |
| MAP / CHART / DASHBOARDS reads | **not by derivation** | the five routes above |
| Langfuse traces | **not segmented** | no project attribute on any span |
| `deliver:` to Slack | **one webhook for N clients** | `SLACK_WEBHOOK_URL` is coordinator-level env with no `ops.project` column beside it. The payload today is agent name + artefact path + byte count, so nothing client-identifying crosses — but there is structurally no way to say "client B's deliveries go to client B's channel". This is the egress ADR, and it stays **one** ADR with `library_remote` |
| the shell, on a project switch | **was yes for one round trip** | `useEndpoint` kept the previous project's `ready` data on screen while the breadcrumb and `data-cost-scope` already said the new project. **Fixed** — see below |
| `ops.project` · `ops.billing_account` · `ops.device` · `ops.identity` | **no data to cross** | unscoped by design, each with the reason written in its own migration. Signed |

---

## What exists now

- `apps/runner/src/lib/brain.ts` — `BrainTier`, `brainWriteRef`, the ref-keyed gate, the
  global-tier refusal, tier-derived paths.
- `apps/runner/src/lib/runService.ts` — `execute()` now takes `project` and `agentRef`;
  `readCompanyBrain(project)`, `writeBackBrain(config, project, agentRef, …)`,
  `writeBrainSnapshot(config, completeness, project)`.
- `apps/runner/src/lib/__tests__/brain.test.ts` — four new isolation tests, plus
  `repoFixture` / `withRepoRoot` split out so a test can hand the write-back a project and a
  ref that disagree.
- `apps/web/src/components/shell/useEndpoint.ts` — `setResource({state:'loading'})` when the
  URL changes, so a project switch cannot render the previous project's number under the new
  project's name.

## Contracts touched

**None changed.** Three are *cited*: `project-scoping.md` (invariant 8, §5.1 Q8b, §6),
`agent-cascade.md` (§2 `agent_ref`), `api-contracts.md` (the error code, below).

One change I deliberately did **not** make: the global-tier refusal throws `git_write_refused`
rather than a new `brain_write_refused`. `ApiErrorCode` lives in `packages/contracts` under
`api-contracts.md`, which is `runner-engineer`'s. `git_write_refused` is already the runner's
write-boundary code and `assertInsideCompany` throws it, so the reuse is honest rather than
lazy — but the better name is proposed to them as a decision-request, not taken.

**Q8b is now answered from my side.** *Each project gets its own `COMPANY.md`; there is a
global tier and it is not writable by any agent.* The mount half stays `runner-engineer`'s.

## Deliberately not done

- **The five library-plane read routes are not fixed.** Five signatures across three modules
  that belong to `runner-engineer`, and `readGraph` carries a stored-artifact design question
  (one `graphFile` per coordinator) that a parameter change would paper over. Filed, not
  half-done — the brief's own rule.
- **`db/__tests__/sql-executes.test.ts` did not compile at 17:57** (`PROBE_PROJECT_ID`
  undefined; `writeOutput` now requires `projectId`) and I did not fix it — it was mid-edit
  by another agent and BOARD rule 4 says do not write to a path someone else is holding.
  **At 18:06 it compiles**: they finished, `PROBE_PROJECT_ID` is defined at line 60 and the
  probe row carries `projectId` / `agentRef` / `sourceRef`.
  Both timestamps are here on purpose. The consequence stands even though the two lines are
  gone: for the whole window between 0005 landing and tonight, the only instrument in this
  repo that asks Postgres whether our SQL is legal could not run, and neither of the two
  write-path defects was caught by anything.
- **No red test was added for either defect I found in someone else's plane.** A red test is
  a gate failure for everyone; the assertions I would have written are in the messages so
  they land *with* the fix.
- **`/api/all/approvals` still returns `inputs`.** Recommended, not changed —
  `runner-engineer`'s route and a real product decision (the footer badge may genuinely want
  to show what it is approving).
- **Artefacts are still `artifactsRoot/<runId>/`.** Moving them to
  `artifactsRoot/<project>/<runId>/` is the structural fix and it is a migration of existing
  files plus `runner-engineer`'s `extractArtifact`. Recorded.
- **No Langfuse project attribute added.** `observability/instrument.ts` is
  `observability-engineer`'s and the trace-attribute set is theirs to extend.
- **Nothing empirical.** No second project was mounted, no run was executed, no query was run
  against Postgres by me. Every claim above is source or SQL.
- **No commit.** As instructed.

## Verification

Run twice, thirty minutes apart, because the tree moved under me both times. **Both readings
are printed** — a single number from a moving tree is the thing this board keeps asking
people to stop quoting.

```
                                     17:57                      18:06
typecheck (@agnetos/runner)          RED · 2 errors in          CLEAN
                                     sql-executes.test.ts
                                     (another agent, in flight)
tsx --test …/brain.test.ts           12 pass / 0 fail           12 pass / 0 fail
                                     (8 pre-existing + 4 new)
npm run test:runner                  127 pass / 0 fail          143 tests · 140 pass · 0 fail
                                                                (3 skipped: no DATABASE_URL)
npm run test:web                     488 vitest + 101 node      497 vitest + 101 node · 0 fail
npm run verify                       —                          green end to end
node scripts/check-rtl.mjs           scanned at 2026-08-17 17:47 +03:00 · 1e5b5d7 · clean
                                     295 files · 217 strings · 214 arabic (99%) · 261 findings
npm run validate:rtl:gate            ratchet holding · baseline 261 @ 4e0bbe6
```

The deltas between the columns are other agents landing M15 closure work, not my changes.
`npm run verify` failed once at 18:02 on a vitest file being written mid-run and passed on
the next attempt — recorded because a one-shot red on a moving tree is churn, and the BOARD
already carries the rule: **gate when the tree is still.**

**One precision on the "never applied" claim, because a sign-off's own evidence line has to
survive being checked.** The brief I was given says migrations 0005–0007 have never been
applied to a real Postgres. That collapses two facts which my own 01:05 amendment had already
separated, and the collapsed version is quotable in a direction that is wrong:

- `comms/inbox/infra-compose-engineer/20260817-0028-observability-engineer-rls-is-inert-under-the-superuser-role.md`
  records `SELECT ops.project_scope_enforced(); → false` executed against the live database.
  That function is defined in 0005 §6, so **0005 was applied at some earlier point.**
- **No migration in the set has been run against the live database in the state the files are
  in now.** 0006 and 0007 were both written after that reading, and neither has a recorded
  application. This is exactly the sentence my amendment already carried —
  *"my sign-off covers schema as written, not schema as applied"* — and it is the accurate
  half of the brief's claim.
- **New tonight, and it is the sharpest of the three:** the *writer* changed hours ago
  (`db/ledger.ts`, `observability/{instrument,types}.ts`, `lib/runService.ts`, all
  uncommitted). **The writer and the schema have never met**, in any state, on any machine.

The last one is why `sql-executes.test.ts` being uncompilable is not a tidiness issue: the
only instrument that could introduce them is the one that cannot currently run.

I am not softening the brief's underlying point — it is right that nothing here is validated,
and it named the right risk. I am restating it at the precision the record supports, because
"never applied" and "never applied in its current state" license different conclusions, and
BOARD's own rule is that a stale FAIL gets investigated while a stale PASS gets cited.

## Next agent

1. **`runner-engineer`** — `comms/inbox/runner-engineer/20260817-1757-rtl-arabic-pdpl-specialist-library-reads-discard-the-project.md`.
   Read `lib/cascade.ts:61` (`cascadeRoots`) first: it is the shape the five read routes
   should copy, and it is already in their file.
2. **`observability-engineer`** —
   `comms/inbox/observability-engineer/20260817-1757-rtl-arabic-pdpl-specialist-traces-carry-no-project.md`.
   Two items: the trace attribute, and `sql-executes.test.ts` not compiling.
3. **`fidelity-qa-reviewer`** — `review-request` filed. The M15 PASS conditions from my first
   pass stand and gain a third; all three are in that message.
