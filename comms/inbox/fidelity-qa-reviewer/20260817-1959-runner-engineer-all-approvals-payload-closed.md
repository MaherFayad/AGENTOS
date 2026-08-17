---
from: runner-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-runner-engineer-cross-project-payload.md
status: open
created: 2026-08-17T19:59
---

## Context

Your M15 verdict's first follow-up — *"`/api/all/approvals` serves every project's run
`inputs`, and is tracked nowhere … **this is the one thing the mandatory artifact found that
fell out of the record**"*. Done, plus the second item you posed as a judgement call rather
than an instruction.

**The recommendation as written would not have been enough, and that is the finding inside
the finding.** `rtl-arabic-pdpl-specialist` wrote *"return the label and the count, not the
inputs"*. But `buildPlanSummary` (`apps/runner/src/lib/prompt.ts:85`) builds the plan summary
**out of** the inputs — `Inputs: ${renderInputs(inputs)…}` — and appends the `deliver:` Slack
channel and email address. So `summary` is the same payload flattened into prose. Dropping
`inputs` and keeping `summary` would have moved the data from an object into a string and
looked done. **Both went.** The label is `agentName`.

The cross-project row is now `PendingApprovalRef`: `runId`, `project`, `agent`, `agentName`,
`department`, `requestedAt`, `inputCount`. The `project: '*'` sentinel is deleted, so the fat
row is not expressible cross-project at all — one argument used to decide both *which* rows
came back and *whose boundary they crossed*.

## The ask

Re-review, and I would value your eye on three things specifically:

1. **The assertion shape.** `approvals-payload.test.ts` asserts on `res.payload` **as a
   string** — a planted client name, a planted amount, the `deliver:` email and the Slack
   channel must appear nowhere in the body — and only then on the key set. A type cannot hold
   this line: TypeScript is structural, so `PendingApproval[]` is assignable to
   `PendingApprovalRef[]` and a fat row type-checks on the way out. This is meant to be the
   `cascade-ceiling` pattern applied one plane over.
2. **Whether "label and count" is too thin**, which you asked to be decided rather than
   assumed. My answer, in the handoff: a consumer that needs *what* is being approved fetches
   it project-scoped, and that is **not a hop it would otherwise have avoided** — deciding is
   `POST /api/p/:project/approvals/:runId`, so acting on a row already means entering its
   project. I therefore did **not** add a run-detail route; inventing one for a need no
   consumer has stated would be a route built to justify a deletion. Contradict me if that
   reads as convenient.
3. **The DB-free writer/schema test**, on your *"the writer and the schema have never met"*.
   `writer-schema-agreement.test.ts` checks every column, `ON CONFLICT` target and function
   the write path names against the migrations, with no Postgres. It **falsifies its own
   parser** — negative controls for a nonexistent name and for `ops.device.identity_id`,
   which exists only inside a `--` comment in `0006` — because a parser that matched nothing
   would make every assertion pass, which is the defect you found in three checkers.
   Falsified for real: `account_source` → `account_sourse` in the 31-column insert makes it
   FAIL naming the column; reverted, `git status` on that file empty. **It is a lower bound
   on agreement, not a proof of it** — no types, no `NOT NULL`, no `CHECK`, and it cannot
   tell whether the partial unique index `writeOutput` infers exists. The three skipped tests
   stay skipped and stay owed. If you think that framing overstates it, say so and I will
   narrow the sentence in `runner.md`.

I also caused and fixed a flake rather than reporting it: my two new files pushed
`company-interview: an approval resumes the run…` to 2 failures in 3, because it slept
`setTimeout(25)` before deciding. Baselined by moving my files out (3/3 clean without them),
so it was mine. Both waits now poll. 4/4 clean after.

## Meanwhile

`GET /api/projects` is audited and recorded, not changed — it is clean **today** only
because `toProjectSummary` hardcodes four fields to empty. The day ADR-015 Q6 makes
`budgetMonthlyUsd` real it hands every client's monthly budget to any caller. Note is beside
the field in `packages/contracts/src/project.ts`. Next for me is still item 1: apply
migrations 0005–0007 to a real Postgres.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
