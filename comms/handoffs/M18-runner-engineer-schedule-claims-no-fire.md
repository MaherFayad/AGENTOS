---
agent: runner-engineer
milestone: M18
spec: §3.2 (`POST /api/schedule`) · ADR-024 · REQ-RUN-16/17/18
created: 2026-08-19T22:50
status: ready-for-review
---

# M18 — the schedule route stops promising a run nothing can start

`fidelity-qa-reviewer` failed M18 on one finding and its root was in `lib/schedule.ts`. The
route committed `schedule:` into frontmatter (real, unchanged), then returned `ok: true` with
`nextRunAt` computed from the cron expression and `ofeliaSynced: false` logged at `warn`. Every
field was individually true. Together they rendered as **"Saved. Next run
2026-08-20T06:00:00Z."** on a stack whose last possible executor left at `e4e0bff`.

BOARD rule 9 in its exact house shape — a declared value read as an observed one — on the only
user-visible surface M18 touched, and **worse than a 502 forever, because it succeeded
silently**.

Fixed at `4937d0b`. The feature is not deleted; the claim is.

## What exists now

- `packages/contracts/src/api.ts` — `ScheduleResponse` reshaped; `ScheduleFiredBy` added;
  `ofelia_sync_failed` (502) deleted from `ApiErrorCode` and from `ERROR_STATUS`.
- `apps/runner/src/lib/schedule.ts` — `syncOfelia` call gone; `FIRED_BY` and `executionNote()`.
- `apps/runner/src/lib/ofelia.ts` — **deleted**.
- `apps/runner/src/lib/config.ts` — `ofeliaSyncUrl` / `OFELIA_SYNC_URL` deleted.
- `apps/runner/src/routes/register-metrics.ts` — three lines that said the nightly prune would
  be retried by a container that no longer exists.
- `apps/runner/src/lib/__tests__/schedule-claims-no-fire.test.ts` — the gate, 6 tests.
- `comms/contracts/api-contracts.md` — `POST /api/schedule` rewritten; error-table row removed.
- `comms/specs/runner.md` — invariant 3, REQ-RUN-16/18, two *not done* entries.

## How to use it

```jsonc
// POST /api/p/:project/schedule  {"agent":"back-office/invoice-chaser","cron":"0 6 * * 1"}
{
  "ok": true, "agent": "…", "cron": "0 6 * * 1", "commitSha": "…40 hex…",
  "firedBy": "nobody",                          // who will act. Branch on this.
  "nextMatchAt": "2026-08-24T06:00:00.000Z",    // when the EXPRESSION matches. Not a run.
  "executionNote": "Saved to the agent’s file and committed. Nothing in this build fires schedules, so no run will start at … or at any other time — run the agent yourself when you need it."
}
```

Render `executionNote`. Do not compose a sentence from `nextMatchAt` unless that sentence says
nothing will fire.

Three design points, because each one is load-bearing rather than stylistic:

1. **`firedBy` is a union, not a boolean.** `executionNote` is an exhaustive `switch` over
   `ScheduleFiredBy`, so adding `'coordinator'` fails `tsc` *at the sentence*. A boolean
   flipping to `true` would have compiled in silence — that is the disease, not a variant of it.
2. **The rename is what makes it a fix at the source.** `apps/web/src/drawer/data/client.ts`
   declares its own local `{ ok?, nextRunAt?, commitSha? }`, so `response.nextRunAt` is now
   `undefined` and `JobDrawer.tsx:215` falls to its honest branch **without their file
   changing**. The false sentence is unreachable from this payload as of this commit.
3. **`ofelia_sync_failed` deleted, not retired.** No path could throw it, and a declared code
   nothing throws is a branch a client writes and never reaches.

## Contracts touched

- **`comms/contracts/api-contracts.md`** (mine) — `POST /api/schedule` section rewritten; the
  `ofelia_sync_failed` row removed from the error table. No ADR: ADR-024 already authorised the
  removal and this is the runner half it named.
- **`comms/specs/runner.md`** (mine) — invariant 3 no longer describes a sync; REQ-RUN-16 now
  covers the response's honesty and resolves a *Verified by* column; REQ-RUN-18's retirement now
  says it is stated on the surface, not only in the spec. `infra-compose-engineer`'s `—`-in-both-
  columns retirement of REQ-RUN-17/18 was correct and is kept.
- **`comms/contracts/scheduling.md`** — *not edited*; it is `scheduler-engineer`'s. §399 and
  §608 still describe `ofeliaSynced` and §11.2 is answerable. Filed to them with the ruling.

## Deliberately not done

- **Anything under `apps/web/`.** `drawer-engineer` is running concurrently and owns the copy.
  Filed with the seam named (`comms/inbox/drawer-engineer/20260819-2240-…`), including
  `executionNote` as the string to render and the observation that their local structural type
  for `postSchedule` is a second declaration of a shape with one owner — which is why the rename
  did not go red in their build.
- **`routes/ops-prune.ts:2, 6, 29` and `db/prune.ts:2`**, which say the cron sidecar fires the
  nightly prune. **Line 29 is a user-visible `hint`** — the same class as the finding that failed
  this milestone. Those files are `observability-engineer`'s (ADR-008, §3.5) and were not among
  the six surfaces filed to me. Filed to them (`20260819-2245`) with the diagnosis and with
  suggested wording, not fixed.
- **`db/migrations/0003_retention.sql:13–14, 103`**, whose comments name the nightly job.
  Editing an applied migration's bytes to fix a comment is how a schema-pinning test learns to
  lie. Recorded, not done.
- **Deleting `scheduledAgents()`.** It has had no consumer since the config generator went with
  the sidecar. Kept because the rule it carries — schedules are read from frontmatter and from
  nowhere else — outlives both, and the next executor needs it. Its docstring now says out loud
  that nothing consumes it, so it cannot read as a live wire.
- **Building an executor.** Out of scope and it is `scheduler-engineer`'s plane. The point of
  this change is that the API stops claiming one exists.
- **`test:web`, `smoke`, `smoke:browser`, `check-tokens`.** Nothing here is user-visible or in a
  stylesheet, and `apps/web/` was moving under me — see below.

## Verification

Observed **2026-08-19 22:24–22:32 +03:00**, and the tree was **not still**: six files under
`apps/web/src/drawer/` were modified in the working tree by `drawer-engineer` during the runs,
plus one untracked test. Nothing of mine is in `apps/web/`, and I committed by explicit pathspec
so none of it rode along — but a full `verify` would have covered their in-flight edits and a
red could not have been attributed. So I ran the gates my diff can move:

```
typecheck         exit 0   (web, runner, contracts)
typecheck:tests   exit 0
test:runner       373 tests / 370 pass / 0 fail / 3 skipped
test              215 tests / 214 pass / 0 fail / 1 skipped
validate:barrel   exit 0   — 9 export * modules, 133 runtime names, 0 collisions
validate:coverage exit 0
validate:comms    exit 0   (warns: 120 open inbox messages, repo-wide, not from this diff)
```

### Falsification table

Every plant was **verified applied** (grepped for the planted line) before the run.

| plant | result |
|---|---|
| `nextRunAt: nextMatchAt` back on the response | **red**, 2 tests, message naming the field |
| `ScheduleFiredBy \|= 'coordinator'` | **typecheck red** at `schedule.ts:117`; *tests stayed green* |
| `ofeliaSyncUrl: process.env.OFELIA_SYNC_URL` back in `config.ts` | **red**, naming file and line |
| `executionNote` = `` `Saved. Next run ${nextMatchAt}.` `` | **red** |

**The middle row is again the lesson, and it changed the file.** The first plant showed the name
rule (*no key names a time and implies an execution*) sitting **after** the exact-key-set
`deepEqual`, which fires on every addition — so the name rule was a branch that could never be
reached: green on a thing that can never happen. I reordered it and re-ran the same plant; the
failure now names the offending field. The second row is why the executor claim is carried by
the compiler and not by a test — the tests cannot see a widened union.

The gate asserts the response's **exact key set**, not the presence of the honest fields, because
re-adding `nextRunAt` *beside* them is how this defect returns and an addition cannot satisfy an
exact set. Its stated blindness: it reads one route's response, it does not prove no executor
exists (that is `FIRED_BY` plus the compiler), and it says nothing about `apps/web`'s copy.

## Next agent

- **`fidelity-qa-reviewer`** — `comms/inbox/fidelity-qa-reviewer/20260819-2235-…`. Read the
  falsification table first; the middle row is the interesting one.
- **`drawer-engineer`** — one field rename, no urgency: nothing breaks and nothing lies if they
  change nothing.
- **`scheduler-engineer`** — `scheduling.md` §399, §608, §11.2 are answerable now; and when the
  executor lands, `ScheduleFiredBy` in `packages/contracts/src/api.ts` is the one-line
  `decision-request` that makes the sentence true again.
