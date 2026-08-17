---
agent: runner-engineer
milestone: M15
spec: §3.2 · §3.5 · Part VII.4 (PDPL rule 4) · Plan §9–§11
created: 2026-08-17T19:52
status: ready-for-review
---

# M15 — the cross-project route stops carrying payload, and the writer meets the schema

Two items from `comms/verdicts/M15-fidelity-qa-reviewer.md`. The first is the verdict's
follow-up that *"fell out of the record"*; the second was posed as a judgement call and the
answer turned out to be **yes, there is something worth doing without Postgres.**

## What exists now

- `packages/contracts/src/api.ts` — `PendingApprovalRef` (new) and
  `PendingApproval extends PendingApprovalRef`; `AllApprovalsResponse` (new). The
  `RUNNER_ROUTES.allApprovals` comment now says what the scope marker does and does not
  claim. Also corrects *"there are currently exactly two"* cross-project routes — there is
  one, and there only ever was.
- `packages/contracts/src/project.ts` — `ProjectSummary` gains the audit note. No behaviour.
- `apps/runner/src/lib/runStore.ts` — private `*pendingGates(project?)`; public
  `pendingApprovals(project)` (fat, project-scoped) and `pendingApprovalRefs()` (narrow,
  cross-project). The `'*'` sentinel is gone.
- `apps/runner/src/routes/api.ts` — `/api/all/approvals` reads `pendingApprovalRefs()`.
- `apps/runner/src/routes/__tests__/approvals-payload.test.ts` — **new**, 4 tests.
- `apps/runner/src/db/__tests__/writer-schema-agreement.test.ts` — **new**, 3 tests, no
  database required.
- `apps/runner/src/lib/__tests__/company-interview.test.ts` — `setTimeout(25)` → poll.
- `comms/contracts/api-contracts.md` (mine) — the Approvals table now has three rows and a
  section explaining why two routes return two shapes.
- `comms/specs/runner.md` — decision 11, REQ-RUN-40, REQ-RUN-41, and verification filled in
  for REQ-RUN-14 and REQ-RUN-15 from tests that already existed.

## How to use it

```ts
GET /api/all/approvals   → { approvals: PendingApprovalRef[] }
// runId · project · agent · agentName · department · requestedAt · inputCount
GET /api/p/:project/approvals → { approvals: PendingApproval[] }   // …plus summary + inputs
```

## The finding, and the part of it the recommendation did not reach

The isolation sign-off's recommendation was *"return the label and the count, not the
inputs"*. **Doing exactly that would have changed nothing**, and this is the load-bearing
sentence of the whole change: `buildPlanSummary` (`apps/runner/src/lib/prompt.ts:85`) builds
the plan summary **out of** the inputs —

```ts
lines.push(`Inputs: ${renderInputs(inputs).replace(/\n/g, ' · ')}`);
if (record.deliver.slack) lines.push(`Delivers to Slack ${record.deliver.slack} …`);
if (record.deliver.email) lines.push(`Emails ${record.deliver.email} …`);
```

— so `summary` is the same payload flattened into prose, plus the `deliver:` Slack channel
and email address. Dropping `inputs` while keeping `summary` moves data out of an object and
into a string. **The label is `agentName`; `summary` is payload wearing a label's name.** The
project-scoped test asserts this directly, so if `buildPlanSummary` ever stops embedding the
inputs, the decision gets revisited on purpose rather than by drift.

## Does a legitimate consumer need what was removed? Decided, not assumed

**No, and here is the argument rather than the conclusion.** An approvals UI that needs to
show *what* is being approved fetches it project-scoped — and that is **not a hop it would
otherwise have avoided**, because deciding is `POST /api/p/:project/approvals/:runId`. Acting
on a row already means entering its project. So the cross-project queue's job is to say
*that* something is waiting and *where*; one extra click is the right price for crossing a
client boundary. **No new detail route was added**, deliberately: `GET /api/p/:project/approvals`
already carries both fields, and inventing `GET /api/p/:project/run/:runId` for a need no
consumer has stated would be a route built to justify a deletion.

## The rest of the cross-project surface, asked field by field

| Field / route | Verdict |
|---|---|
| `PendingApprovalRef.runId` · `agent` · `agentName` · `department` | ids + frontmatter. Library metadata, not client data |
| `.project` | it **is** the boundary; a row that cannot say whose it is, is not triage |
| `.requestedAt` · `.inputCount` | a timestamp and a count. The count separates "nobody typed anything" from "somebody typed six fields" |
| `StatusResponse` counts, `budget`, `brain.missing[]` | counts; a coordinator-level spend; interview **topic keys**, which are fixed schema |
| `LedgerHealth.lastError` | checked: only ever set from a **connection** failure (`ledgerConnection.ts` `drop()` / `open()` catch), and `reportQueryError` calls `drop` only when `isConnectionError`. A constraint-violation message echoing a row value cannot reach it |
| `GET /api/projects` | **clean today, for a reason that expires** — see below |

## Deliberately not done

- **`GET /api/projects` was audited and left alone.** It is `scope: 'coordinator'`, but it is
  the other route returning one row per client. `toProjectSummary` hardcodes
  `budgetMonthlyUsd`, `defaultAccountId`, `hostAffinity` and `libraryRemote` to empty values,
  and `apps/web/src/components/shell/useProjects.ts` says in a comment that it does not read
  them — so nothing client-shaped crosses. **The day ADR-015 Q6 makes `budgetMonthlyUsd` real,
  this route hands every client's monthly budget to any caller**: the same defect, arriving
  through a field that already exists rather than a route someone adds. Recorded in
  `packages/contracts/src/project.ts` beside the field. Not fixed here — a filter over four
  hardcoded nulls is untestable, and `ProjectSwitcher` is mid-review.
- **The project-scoped row keeps `inputs`.** PDPL rule 4 is about crossing clients. Removing
  them inside one project would be a different rule, unargued, and would leave a real need
  with no route.
- **Nothing empirical.** One project is mounted, so "A's inputs do not reach a caller in B"
  is argued from the row not carrying inputs *at all* — stronger than a filter, and still not
  two projects on one box. `project-scoping.md` §6 unchanged.
- **The three skipped tests stay skipped and stay owed.** See below for what was bought
  without them and, more importantly, what was not.
- **No commit.** As instructed. `RUNNER_ANTHROPIC_API_KEY` untouched; no figure written into
  `spend.json`.

## The three skipped tests — the honest answer is "partly, and here it is"

The verdict's sharpest sentence is *the writer changed last night, so the writer and the
schema have never met*, and the three tests that would catch that all skip on
`DATABASE_URL is not set`. The migrations are text in this repo and the writer's SQL is text
this process can produce, so the **column** half is answerable with no database:
`writer-schema-agreement.test.ts` asserts every column, `ON CONFLICT` target and
`DO UPDATE SET` column the writer names exists in a migration, and every function the write
path calls is defined by one.

**It falsifies its own parser rather than trusting it**, because a parser that matched
nothing would make every assertion pass — the exact defect the verdict found in three
checkers. Negative controls: a name that does not exist must be absent, and
`ops.device.identity_id`, which appears **only inside a `--` comment** in `0006`, must be
absent too (a parser that believed comments would invent a column and then pass a writer that
used it). Plus floors on the harvest: ≥4 statements, ≥40 column references, ≥25 columns
parsed for `ops.agent_runs`.

**What it does not do, stated so nobody quotes it as more:** it cannot see types (the
`make_interval` regression was a legal column list meeting an `int`-only overload), `NOT NULL`
or `CHECK`, whether the *partial* unique index `writeOutput`'s `ON CONFLICT` infers actually
exists, or the `app.safe_num` class across the thirty read queries. It is a **lower bound on
agreement, not a proof of it**, and `sql-executes.test.ts` is still the instrument that
answers those. Item 1 on my Next list is unchanged: apply 0005–0007 to a real Postgres.

## Verification

Run at `8e77a23` + working tree, with three agents editing concurrently.

| Gate | Result |
|---|---|
| `npm run test:runner` | **163 · 160 pass · 0 fail · 3 skip** (was 156 · 153 · 0 · 3) |
| `npm test` | **162 · 161 pass · 0 fail · 1 skip** |
| `npx tsc --noEmit -p apps/runner/tsconfig.json` | clean |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | clean |
| `npm run validate:coverage` | **0 FAILs**, 674 reqs / 637 (95%), **14 warns** (was 16); runner.md 12 → 10 |

**Falsifications actually performed, not asserted:**

1. `account_source` → `account_sourse` in `recordRun`'s 31-column insert →
   `writer-schema-agreement` FAILs naming `ops.agent_runs.account_sourse`. Reverted;
   `git status --porcelain apps/runner/src/db/ledger.ts` empty.
2. The function check's first run produced three **false positives** —
   `INSERT INTO ops.agent_runs (` is textually a qualified name followed by a paren. Fixed by
   subtracting the table set the same parser produced. Recorded in the file because a checker
   that was noisy once will be loosened later by someone who does not know why.

**One flake I caused and fixed rather than reported.** Adding two test files pushed
`company-interview: an approval resumes the run…` to fail 2 runs in 3: it slept
`setTimeout(25)` before `store.decide`, and under load the gate had not opened yet. Baselined
by moving my two new files out — **3/3 clean without them** — so it was mine. Both waits now
poll for `status === 'awaiting-approval'` with a 5s deadline and a sentence on timeout.
**4/4 clean** after. A test that fails when the machine is busy teaches people to re-run
rather than read.

*Not mine, recorded so nobody files it:* `npm test` was momentarily red on
`English and Arabic catalogues have matching keys` mid-session — `scripts/check-rtl.mjs` was
`M` with +284 lines under `rtl-arabic-pdpl-specialist`. Green by the final run.

## Next agent

`fidelity-qa-reviewer` — re-read the follow-up bullet at
`comms/verdicts/M15-fidelity-qa-reviewer.md:186`, then
`apps/runner/src/routes/__tests__/approvals-payload.test.ts`. The assertion that matters is
on `res.payload` as a **string**, not on a key: a type cannot hold this line, because
TypeScript is structural and `PendingApproval[]` is assignable to `PendingApprovalRef[]`.

`commandcenter-orchestrator` — this needs a BOARD row. The finding's own defect was that it
reached neither BOARD nor the carry-forward list; closing it in code without closing that is
half the fix.
