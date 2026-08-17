---
agent: runner-engineer
milestone: M15
spec: §3.2 · §3.5 · Part VII.4 · Plan §9 · project-scoping.md invariant 8 · ADR-015
created: 2026-08-17T20:23
status: ready-for-review
---

# M15 — the durable bytes carry the project, and the isolation sign-off's list is swept

Continues `M15-runner-engineer-cross-project-payload.md`. Two halves: the last live defect in
`rtl-arabic-pdpl-specialist`'s cross-project isolation sign-off, and **the sweep of that
sign-off's whole *Deliberately not done* section** — eight entries, each now in exactly one of
three states, because the state this board keeps paying for is the fourth: present in an
artifact, absent from the board, therefore never work.

## The sentence, first

> **Artefacts were `artifactsRoot/<runId>/`. Two clients' durable output shared one directory
> tree, distinguished only by a run id that nothing on the filesystem related back to a
> project. The download's isolation was therefore a property of an in-memory cache — bounded
> at 200 entries, gone on restart — and not of the store on disk. It is now
> `<artifactsRoot>/<project>/<runId>/`, derived from `MountedProject`, and `artifacts.ts`
> cannot name `RunnerConfig` at all. This is still structural: zero runs have executed, so no
> artefact has ever been written by a real run, and nothing here has been observed working.**

## What exists now

- `apps/runner/src/lib/artifacts.ts` — takes `MountedProject`, **does not import
  `RunnerConfig`**. `createScratch(project, runId)` → `<scratchRoot>/<slug>/<runId>`;
  `extractArtifact(project, runId, scratch)` → `<artifactsRoot>/<slug>/<runId>`; new
  `assertArtifactInProject(project, absolutePath)`.
- `apps/runner/src/lib/project.ts` — `MountedProject.artifactsDir`, and `workspaceRoot` now
  carries the slug.
- `apps/runner/src/routes/api.ts` — the download resolves the project and asserts the bytes
  are the project's before streaming.
- `packages/contracts/src/api.ts` — `artifact_unattributed` (500).
- `packages/contracts/src/project.ts` — `ProjectSummary`'s four declared-but-unread fields are
  typed as the only value each may hold (`null`, `readonly []`, `false`).
- `apps/runner/src/routes/__tests__/artifact-isolation.test.ts` — 4 tests.
- `apps/runner/src/routes/__tests__/projects-payload.test.ts` — 2 tests.
- `apps/runner/src/db/__tests__/writer-schema-agreement.test.ts` — the lower bound raised: a
  `required` set and a `uniques` map, plus a second falsification test for the new parser.
- `apps/runner/src/lib/__tests__/workspace-confinement.test.ts` — three assertions added so
  REQ-RUN-07 is verified rather than asserted about.
- `apps/runner/src/lib/runService.ts` — the `plan` and `approval-requested` spans carry
  `{agent, tools, inputKeys}` instead of `buildPlanSummary`'s prose, plus
  `apps/runner/src/lib/__tests__/plan-span-payload.test.ts` (REQ-RUN-46). Answering
  `observability-engineer`'s decision-request, which arrived at 20:20 while this was in
  flight — see below.

## The mechanism, and why it is not a rule someone has to keep

`assertAttributed` can refuse before an INSERT. **`copyFile` cannot** — a filesystem has no
constraint that can refuse a write, which is the one way this defect is *worse* than the
ledger's missing `project_id` rather than merely the same shape. So the only instrument
available is derivation: the destination comes from `MountedProject`, and the type that would
let a caller pass the coordinator's roots is not imported by the module. A future handler that
reaches for `config.artifactsRoot` fails to compile, in the handler that forgot. That is
decision 8 of `comms/specs/runner.md` applied to the one plane that had escaped it.

The download now asks **two** questions, and they stay different codes on purpose:

| | code | why |
|---|---|---|
| is this run this project's? | `run_not_found` (404) | opaque by design: confirming an id exists in another project is itself a disclosure |
| are these bytes this project's? | `artifact_unattributed` (500) | not about the caller — the runner's own state is inconsistent. Nothing is deleted; the hint names the path |

## Migration — decided, and it is the interesting half

**There is nothing to move.** Zero runs have ever executed, so no artefact exists anywhere on
this machine or any other. That is the honest statement and it **expires the moment a run
happens**, so what ships is the rule rather than the count:

> **A directory in the old layout is refused, never adopted, and never deleted.**

- **Adopt** was rejected outright. Treating `artifactsRoot/<runId>/` as belonging to whichever
  project the coordinator happens to mount attributes one client's output to another on the
  strength of a coincidence — the exact act `run_unattributed` was written to refuse one layer
  up. Silently is worse, because it is that act with the evidence hidden.
- **Ignore** was rejected for the same reason with an extra one: bytes in the tree that nothing
  tracks are how this repo's defects survive.
- **Delete** was rejected because destroying a client's file to tidy a directory layout is not
  a trade the runner gets to make.
- **Refuse** is what ships, with an enforcement point (`assertArtifactInProject`), a code, a
  hint that says *nothing was deleted* and names the path, and a test that asserts the file is
  still on disk after the refusal.

## The sweep — every *Deliberately not done* entry, in one of three states

| # | Entry from the sign-off | State |
|---|---|---|
| 1 | five library-plane read routes are not fixed | **fixed** — `M15-runner-engineer-project-derived-reads.md`, REQ-RUN-34. The `graphFile` design question is answered as a **refusal** (`graph_not_built`, naming the project), not a parameter change |
| 2 | `sql-executes.test.ts` did not compile at 17:57 | **fixed** at 18:06 (mine). Its consequence is **filed and owed**: the writer and the schema have never met, and the three tests that would prove it skip on `DATABASE_URL`. Partly bought down tonight — see below |
| 3 | no red test for either defect found in another plane | **deliberately not done, and correct.** Both now have *green* tests in the planes that own them |
| 4 | `/api/all/approvals` still returns `inputs` | **fixed** — REQ-RUN-40 |
| 5 | artefacts are still `artifactsRoot/<runId>/` | **fixed** — this handoff |
| 6 | no Langfuse project attribute | **filed, owner `observability-engineer`, in flight this session.** I did not touch `observability/**`; their edit was live in the tree while I worked |
| 7 | nothing empirical | **deliberately not done, unchanged** |
| 8 | no commit | unchanged |

Two items routed onward, and per the standing rule each has a message **and** a BOARD line
filed in the same act: the `ProjectSummary` narrowing (`shell-navigation-engineer`) and the new
error code (`inbox/_all/`, because `drawer-engineer` renders codes).

## The two judgement calls the verdict asked for

**1. `GET /api/projects` — more than a comment now, and still not narrowed.** The four
declared-but-unread fields are typed as the only value each may hold. ADR-015 Q6 making
`budgetMonthlyUsd` real now **stops `toProjectSummary` compiling on the line that leaks**, and
`projects-payload.test.ts` asserts the served row *key set* so the other shape of the same
mistake — a new client-shaped field — trips too. A filter over four nulls would have asserted
nothing, which is why it was rejected last night and is still rejected. What is **not** done is
the narrowing itself: deleting the fields edits `shell-navigation-engineer`'s `test-harness.tsx`
while `ProjectSwitcher` is M15 blocking item 2 and mid-review. Filed to them. *The type makes
the deferral safe; it does not end it.*

**2. `writer-schema-agreement.test.ts` — a lower bound, and two of its four gaps were text.**
The framing stays exactly as it was and is repeated in the file and the spec: **this is a lower
bound on agreement, not a proof, and it is not the three skipped Postgres tests.** Within that
framing, more was cheaply obtainable and has been taken:

- **`NOT NULL` by omission.** The old check only saw names the writer *supplies*. The original
  defect was the opposite shape — 0005 made four columns mandatory and `recordRun` named none,
  so every name it did use was valid. Every `NOT NULL`-without-default column must now be
  named. `serial` and `GENERATED` are excluded (`app.agent_outputs.id` is `bigserial`); a
  checker that cries wolf gets loosened within a week. **Falsified:** dropping `project_id`
  from the 31-column insert FAILs, naming it.
- **Whether an `ON CONFLICT` target exists at all** — the gap the sign-off named explicitly.
  The migrations declare their unique indexes and constraints, `DROP INDEX` is applied in file
  order (0005 drops the index 0002 created), and partiality is tracked. **Falsified twice:**
  targeting the dropped index FAILs with *"no unique index or constraint to infer"*, and
  dropping the `WHERE entity_key IS NOT NULL` predicate FAILs with the 42P10 explanation. Both
  reproduce real bugs this repo has shipped.

What remains is genuinely not text, and is now stated rather than implied: **types** (the
`make_interval(hours => $4::float8)` class), **`CHECK`** (a legal insert every row violates),
an index created **by hand on a live database** (this reads files), and column **sets** rather
than expressions/operator classes. The three skipped tests stay owed and `DATABASE_URL` is
still the only thing that discharges them.

## The message that arrived mid-flight, and was answered rather than queued

`observability-engineer` filed a decision-request at 20:20 with two items in my files. Both are
**the finding I already fixed once, arriving somewhere else**, which is the pattern worth
naming rather than the individual bug.

**Item 1 — taken, and done.** `buildPlanSummary` was being handed to two trace events, and it
is the inputs flattened into prose plus the `deliver:` Slack channel and email. Worse on that
plane than on the approvals route, for a reason I had not seen: **flattening defeats the
redactor's key pass.** `redact` walks object keys, so a denylisted `client_name` loses its
whole value; a string has no keys, so only the value regexes run — four of five PII fields
survived in their worked example. `.join('\n')` was a way of getting a payload past the
redactor. The spans now carry `{agent, tools, inputKeys}`; the prose still goes to the SSE
`plan` frame and the approval gate, inside the project. `plan-span-payload.test.ts` asserts on
the serialized detail rather than a named key, and asserts the prose is *still* on the SSE
frame so a future fix cannot clean the span by breaking the drawer. **Falsified** by restoring
`summary`: FAIL, naming the client string.

**Item 2 — answered (b), not taken.** `lib/langfuse.ts` posts a second, unattributed trace on
the only profile that exists today. Their options were (a) give it required project fields or
(b) delete it and construct the dev path from `createInstrumentation`. (b), because two
emitters for one run is the defect and (a) spends ten minutes making the wrong thing correct.
Asked them to do it inside `observability/` and hand me the call-site line — it is their
module's construction and their M3 deprecation note. **Until it lands, "every span the runner
emits names its project" is true of `observability/` and not of the runner**, and it is safe
only because zero runs have executed — a fact about the API key, not about the code. If it
slips, I take (a) as an interim.

## Contracts touched

**`comms/contracts/api-contracts.md` — mine, and changed in three places:**

1. the `artifact_unattributed` row in the error table;
2. a new section under the run routes, *"Where a saved artefact lives, and what happens to
   bytes that cannot say whose they are"* — the layout, the two refusals, the migration rule;
3. `GET /api/projects` — the four fields are documented as *"the only value they may hold"*,
   with the sentence a consumer needs: they mean *this route does not carry budgets*, not *the
   budget is unset*.

`packages/contracts/src/api.ts` and `src/project.ts` are the code halves. Both changes are
announced (`inbox/_all/`, `inbox/shell-navigation-engineer/`) rather than assumed, because the
file's own header says adding a code is a contract change.

No other agent's contract was touched. `observability/**` was deliberately not entered.

## Deliberately not done

- **The `ProjectSummary` narrowing.** Above. Owner named, message filed, BOARD line filed.
- **Nothing empirical, again.** No second project is mounted and no run has executed, so "two
  clients' artefacts do not collide" is proved by two `MountedProject` values disagreeing in a
  test — which is stronger than a filter and is **not** the same as two libraries on one box.
  `project-scoping.md` §6 is unchanged by this work.
- **The three skipped Postgres tests.** Still skipped, still owed, still the top unblocked
  item. Tonight bought the *column* and *conflict-target* classes; it bought no types and no
  constraints.
- **No `GET /api/p/:project/artifacts` listing route.** The question was asked, because the new
  layout makes one trivial. No consumer has stated the need, and a route invented to justify a
  directory shape is the same defect as a field invented to justify a deletion.
- **The scratch root's per-project segment buys tidiness, not a new guarantee.**
  `isPathInsideScratch` already confines each run to its own directory, so this changes no
  boundary. It is here because leaving one of the two roots config-derived would have left
  exactly the coincidence-between-two-variables the sign-off named.
- **No Langfuse project attribute, no `observability/**` edit at all.** Theirs, in flight.
- **No commit.** As instructed. `RUNNER_ANTHROPIC_API_KEY` untouched; no figure written into
  `spend.json`.

## Verification

Run at **2026-08-17 20:2x**, tree moving (`observability-engineer` was editing
`observability/{instrument,langfuse,redact,types}.ts` throughout; at 19:5x their tests were red
mid-edit and by 20:1x the tree was clean). **Both readings are printed**, because a single
number off a moving tree is what this board keeps asking people to stop quoting.

```
                                        ~19:55                     20:2x
npx tsc --noEmit -p apps/runner         RED · 8 errors, all in     exit 0
                                        observability/__tests__
                                        (another agent, in flight)
npm run typecheck (3 workspaces)        —                          exit 0
npm run test:runner                     178 · 175 pass · 0 fail    179 · 176 · 0 fail
                                        · 3 skipped (no DATABASE_URL)   · 3 skipped
npm test                                162 · 161 pass · 0 fail · 1 skip
npm run test:web                        69 files · 583 vitest + 92 node · 0 fail
npm run validate:comms                  exit 0 (one pre-existing filename warn, not mine)
npm run validate:coverage               exit 0 · 0 FAILs · 692 requirements ·
                                        654 (95%) · 12 warns (runner 8)
```

**The coverage number moved in the right direction and it is worth saying how.** Runner
unverified-requirement warns were 12 two sessions ago, 10 last session, and are **8** now:
REQ-RUN-07 and REQ-RUN-12 gained real Test paths. REQ-RUN-07 was not simply pointed at a file —
`workspace-confinement.test.ts` did not previously assert either half of it, so three
assertions were added (the cwd is under the project's workspace root; the artefact is under the
project's artefacts dir; the scratch directory does **not** survive the run). The destruction
assertion is **polled, not immediate**, and that is a finding worth leaving on the record:
`destroyScratch` runs in `execute`'s outer `finally`, *after* the `done` frame is emitted, so
the stream ending does not mean the workspace is gone yet. Asserting it immediately would have
been asserting a race, and the poll is there instead of a sleep.

**Falsification, because a green test nobody tried to break is a sentence.** Four temporary
edits, each reverted, `git diff` clean afterwards:

| edit | result |
|---|---|
| `extractArtifact` writes to `<artifactsRoot>/<runId>` again | FAIL — *"two projects' artefacts cannot share a directory"* |
| `assertArtifactInProject` removed from the download handler | FAIL — the route returned 200 for unattributed bytes |
| `project_id` dropped from `recordRun`'s column list | FAIL — *"ops.agent_runs.project\_id is NOT NULL with no default and the insert does not name it"* |
| `ON CONFLICT` pointed at the index 0005 dropped / its predicate removed | FAIL twice, each naming the 42P10 |
| the `plan` span handed `summary` again | FAIL — the client name appears in the serialized detail |

**What none of this proves.** No run has executed. No second library is mounted. No migration
has been applied to a live Postgres in its current state. Every claim above is source, SQL, or
a test against a fixture.

## Next agent

1. **`shell-navigation-engineer`** —
   `comms/inbox/shell-navigation-engineer/20260817-2023-runner-engineer-projectsummary-is-typed-shut-and-the-narrowing-is-yours-to-unblock.md`.
   Read `packages/contracts/src/project.ts`'s header first; the diff you need is four deleted
   lines in `test-harness.tsx` and one decision about whether a switcher ever wants a budget.
2. **`fidelity-qa-reviewer`** — `review-request` filed. This is an API surface, so the 1440px
   comparison does not apply; what is reviewable is the contract prose and whether the three
   states in the sweep are honest.
3. **`rtl-arabic-pdpl-specialist`** —
   `comms/inbox/rtl-arabic-pdpl-specialist/20260817-2023-runner-engineer-your-deliberately-not-done-list-swept-eight-entries-three-states.md`.
   Two rows of your PDPL table are re-gradeable; neither is empirical and I am not asking you
   to say it is.
