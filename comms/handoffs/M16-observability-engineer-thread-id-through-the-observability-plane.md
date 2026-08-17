---
agent: observability-engineer
milestone: M16
spec: §3.5 (+ `Plan §12` via ADR-023, filed under §3.5 per ADR-013)
created: 2026-08-17T22:20
status: ready-for-review
---

# M16 — `thread_id` through the observability plane

**Read this first: structural, not empirical.** Zero runs have executed. No span has ever
been emitted. `ops.agent_runs` is empty, so `thread_id` has never held a value and every
`?thread=` answers zero runs. What is demonstrated is that the column, the bind, the filter,
the span attribute and the trace metadata all exist and agree with each other. What is not
demonstrated is any of it against a run. **M16 can be completed; M16 cannot be validated**
until `RUNNER_ANTHROPIC_API_KEY` lands — `contracts/thread-model.md` §8.

Built against `contracts/thread-model.md` and ADR-023, not `Plan §12`.

## What exists now

**The metrics plane** — `thread` is a filter, never a second aggregation model.

- `apps/runner/src/db/queries.ts` — `MetricFilter.threadId`; `THREAD_PREDICATE` as `$8` on
  the shared `RUN_SCOPE` (so `metric`, `metricSeries` and `metricBreakdown` all gain it);
  `lastRuns` gains `$6` and selects `thread_id`; `activityFeed` gains `$3` and selects it.
- `apps/runner/src/routes/metrics.ts` — `?thread=` on `/metrics/query`, `/metrics/runs`,
  `/metrics/activity`; `threadId` on every run and activity row; `readThreadFilter` →
  **`400 bad_thread`** before the database.

**The trace plane** — one run, one trace, unchanged.

- `apps/runner/src/observability/langfuse.ts` — `SpanScope['agnetos.thread.id']`, **optional**,
  with the anchor written where the next reader will find it.
- `apps/runner/src/observability/instrument.ts` — the id joins the spread scope (so every
  span carries it) and the root span carries `langfuse.trace.metadata.thread`.
- `apps/runner/src/observability/types.ts` — `RunRecord.threadId: string | null`.

**Tests** — `apps/runner/src/observability/__tests__/threads-observability.test.ts`, 12 tests.

**Spec** — `comms/specs/observability.md`: decisions 15–17, REQ-OBS-36…41, the *Erasure*
table (two rows corrected/added + a new sub-section), *Retention* (§9.4 answered),
*Interfaces we expose*, *Deliberately not done*.

## The three judgements, and where the reasoning lives

### 1. `agnetos.thread.id` is optional on `SpanScope` — anchored to the ledger, not to `RunInit`

Written in full in `langfuse.ts`. The short form:

> A required member's job is to make an **unfileable** datum a compile error, and a datum is
> unfileable exactly when the plane it lands in cannot represent its absence. `project_id`
> is NOT NULL on `ops.agent_runs`, so a run with no project cannot be recorded — required. A
> run with no thread **can** be recorded, truthfully (`0008` §3). Requiring it on the span
> while the ledger tolerates NULL would have the trace plane assert something the ledger does
> not — and when those two disagree the trace is the one lying, because the ledger is what
> every rendered number reads.

**Why the anchor matters and is not pedantry.** `RunAttribution.threadId` moved twice during
this session — `runner-engineer` made it required, then reverted it — and had I anchored to
their type, my span type would have moved twice with a decision that is not about spans.
Anchoring to the migration means one fact moves one way, once, and takes both types with it.

**The coupling is mechanical.** The last-but-one test reads every migration (line comments
stripped) and:

| Migration state | Test requires |
|---|---|
| `SET NOT NULL` present | `'agnetos.thread.id'` **required** — red until the `?` goes |
| `SET NOT NULL` absent | `'agnetos.thread.id'` **optional** — red if the `?` goes early |

**The comment-stripping is load-bearing and was nearly the bug:** `0008`'s own prose contains
the literal `ALTER COLUMN thread_id SET NOT NULL`, so a regex over the raw file matches it.
Verified explicitly — raw text matches, stripped text does not.

### 2. A thread is a filter. No rollup, no `groupBy`

`?thread=` narrows the endpoints that already exist. **There is no `/metrics/threads` and no
`groupBy: "thread"`**, both pinned by a test.

- A rollup would be a second way to compute `cost` and `runs`, and two ways to compute one
  number is how a widget and a drawer start disagreeing about one client's spend.
- `groupBy: thread` is refused for a second, independent reason: **a thread has no title**
  (`thread-model.md` §9.6), so the `bar-list` could only render uuids — a panel that looks
  like data and answers nothing. A decision made about a column stopped a bad widget in a
  different plane.

Also refused: an `unthreaded` bucket mirroring `account`'s `unattributed`. That one is a
*value the ledger stores*; "no thread" is a NULL and is every row today, so a bucket for it
would be a filter whose answer is "everything" dressed as a category.

### 3. What a trace may carry from an `ops.message` body — decided before anything writes one

`messageId`, `threadId`, `kind`, `interrupt`, `bodyChars`, `hasPayload`, `payloadKeys`.
**Never a character of the body**, not truncated, not summarised.

**The finding, demonstrated rather than asserted.** The flattening defect has now appeared
four times, and `ops.message` is the one the M15 fix cannot reach — the earlier three were
*derived* prose, which still contained `client_name:` for a key rule to find. A message body
is flat at origin and has no keys at all:

```
redact('Chase Fatima Al-Harbi about the Olaya lease — she wants to move in March.')
  → the string, verbatim.  hits: []
redact({ client_name: 'Fatima Al-Harbi' })
  → '[REDACTED:clientname]'.  hits: 1
```

Five of five survive. So the redactor is **not a fallback here**, and no rule can make it
one: a name-shaped regex would redact `Follow-Up Coordinator` and `King Fahd Road` and teach
everyone to distrust the redactor — the exact failure `KEY_DENYLIST`'s own comment refuses
`name`/`title`/`label` to avoid. The defence is that the body never enters the object, and
the mechanism is `messageSpanAttributes` being a type with no `body` field.

## Contracts touched

| Contract | Change |
|---|---|
| `contracts/thread-model.md` | **consumed, not edited.** `thread-model-engineer`'s outright. Its §9.3 and §9.4 were routed to me and are answered in my spec + a message to them |
| `contracts/panel-schema.md` | **unchanged** — `query.source` stays `langfuse \| sql \| static`; no new source. `dashboards-engineer` messaged so `thread-feed` does not invent one |
| `contracts/api-contracts.md` | **not edited** — `runner-engineer`'s. `bad_thread` is a new error code on *my* routes; announced to them rather than added by me |
| `comms/specs/observability.md` | mine — decisions 15–17, REQ-OBS-36…41, erasure, retention |

No ADR written. Nothing here needed one: the span-scope decision is recorded at the type and
pinned by a test, and the two destructive operations that *do* need one are requested rather
than built (below).

## Deliberately not done

- **A delete verb, for any plane.** Requested as one ADR with the retention horizon
  (`commandcenter-orchestrator`), not written. Erasure is destructive, the number is the
  human's, and writing one into a migration nobody asked to review is how an irreversible
  capability arrives without a decision behind it. **REQ-OBS-35 stays declared-and-unbuilt so
  the gate counts it among the 39 missing.**
- **A retention horizon for `ops.thread` / `ops.message`.** `thread-model.md` §9.4 was routed
  to me and I answered it **no horizon**, with reasoning, rather than deferring: an
  age-based prune copied from `ops.agent_runs` would delete the conversations that make
  *continue this thread* work, silently, at 03:00, by cron. Any figure I picked would be a
  plausible number on a surface with no data to derive it from — the same rule that types
  `TurnCost.estimatedUsd` as `null`, applied to a duration.
- **`groupBy: thread` and `/metrics/threads`.** Refused, not deferred. Reasoning above.
- **A thread's own aggregate cost as a second spelling.** It is
  `/metrics/query?metric=cost&thread=<id>`.
- **`lib/langfuse.ts`, the second emitter — row left OPEN, not closed.** It is the deprecated
  `/api/public/ingestion` emitter and it fires whenever `services.obs` is absent, i.e. **every
  `--profile dev` run, the only profile that exists today**. `runner-engineer` answered
  **(b), delete it**; it is still in the tree. **Threads widen this rather than leaving it
  unchanged:** a trace that cannot name its project also cannot name its thread, so *both*
  correlation keys M16 exists to provide are absent from the only emitter that fires. The fix
  is a deletion in a file that is not mine, so the row stays open.
- **`db/ledger.ts` — not edited by me.** `recordRun` is `runner-engineer`'s and they were in
  it concurrently. I supplied `RunRecord.threadId` (a writer cannot name a column the record
  does not hold) and messaged them the one-line ask. **They landed it during the session**;
  I then wrote the test for it rather than assuming it (below).
- **`RunAttribution.threadId` required-vs-optional.** Theirs. It moved twice tonight and I
  deliberately did not anchor to it.
- **Nothing empirical.** No live Langfuse, no Postgres, no run. Three runner tests still skip
  on `DATABASE_URL`.

## Verification

Every mechanism below was falsified by **planting the defect**, not by reading the diff.

| Planted | Result |
|---|---|
| `ALTER COLUMN thread_id SET NOT NULL` appended to `0008` | red — *"Remove the `?` from `agnetos.thread.id`"* |
| `?` removed from `SpanScope` while the column is nullable | red — *"would force every call site to invent one — a fabricated correlation key on every trace"* |
| `isThreadFilter` → `return true` | red — the malformed-id test; the request reached the database |
| `body` added to `MessageSpanAttributes` + populated | red — *"`Fatima` reached the span projection"* |
| `run.threadId` removed from the ledger bind array, **column name left in place** | red — *"a named column bound to nothing is the same silent gap as an unnamed one"* |

Also verified: the raw text of `0008` **does** match the `SET NOT NULL` regex (its own prose
contains the literal) and the comment-stripped text does not — so the strip is load-bearing
rather than decorative.

**Gates, at `8a9bdf5` + uncommitted, measured 2026-08-17T22:27 — the last measurement, not
the best one.**

```
npm run test:runner            230 tests · 227 pass · 0 fail · 3 skipped   (baseline 198/195/0/3)
npm test                       163 tests · 162 pass · 0 fail · 1 skipped
npm run validate:coverage      0 FAIL · 12 warn · 698 req · 39 declared-unbuilt
npm run validate:comms         0 errors · 1 pre-existing filename warn (not mine)
npx tsc --noEmit -p apps/runner/tsconfig.json   ✗ EXIT 1 — 4 errors, ALL in runner-engineer's
                                                  two new files, none in mine
npm run typecheck              ✗ EXIT 1 — same 4 errors
```

**The typecheck is red and I am reporting it red rather than reporting the green I had.**
The four errors are in `apps/runner/src/lib/__tests__/thread-run.test.ts` (bad import path)
and `apps/runner/src/routes/__tests__/thread-routes.test.ts` (three), both created by
`runner-engineer` after 22:14 and both mid-slice. **Zero errors are in any file I touched.**

At 22:14 the same command exited **0**. I could have written the handoff then and been
truthful-at-the-time and wrong-by-morning — which is exactly the `:242` failure mode I was
routed here to fix. So the number above is the last one I took.

`threads-observability.test.ts` alone: **12 tests, 12 pass.** The 3 skips are the standing
`DATABASE_URL` three — the same three BOARD names as *"exactly the three that would catch a
writer/schema mismatch"*. My REQ-OBS-38 test is deliberately built to run **without** one, on
the statement text and the bind array, because that gap is precisely where a nullable column
can be named and not bound.

**A number on this handoff is a timestamp, not a fact.** `runner-engineer` landed
`threadService`, `mailbox`, the ledger write and two test files in this tree while I worked.
The runner test count went 198 → 209 → 218 → 230 under me; the typecheck went red → green →
red. **Gate on a still tree**, and if the reviewer's figures differ from mine, the tree moved
again rather than one of us being wrong.

## Two things I corrected that had gone stale — including my own, twice

1. **`observability.md:242` — routed to me from M15's PASS, fixed.** It said artefacts have
   no project segment; that landed at `7b6401d`. Verified against the tree before editing
   (`lib/project.ts:143` builds `join(config.artifactsRoot, slug)`) rather than transcribed —
   and the routing message named the wrong file in my first draft of the answer, which I
   caught and corrected. The correction is **dated in the table**, not silently applied.
2. **My own comments, ~45 minutes old.** I wrote *"the ledger writer does not name
   `thread_id`"* in six places and a REQ row; `runner-engineer` landed the line and every one
   became false. All six now say **"the table is empty; zero runs have executed"** instead —
   a different sentence, and the only one that survives the next commit. Two already-filed
   messages carry dated *Update* sections rather than rewrites. This is the same defect class
   as `:242`, committed by me, an hour after being asked to fix it in someone else's file.

## Next agent

- **`runner-engineer`** — `…/runner-engineer/20260817-2158-…-thread-id-read-plane-is-live-and-your-writer-is-the-gap.md`.
  Read the **Update** section first; §1 and §5 are already discharged by you. What is live:
  the `0009` handshake fires the day `SET NOT NULL` lands, and the second emitter is still
  in the tree.
- **`rtl-arabic-pdpl-specialist`** — the message-body ruling and two COMPANY.md lines.
  The second, *"never put a human's message into a trace, a log or a push payload — not
  truncated, not summarised; reference it by id"*, is new and is the one that needs your
  words rather than mine.
- **`commandcenter-orchestrator`** — one ADR number covering erasure **and** the thread
  retention horizon together, plus the human's number.
- **`dashboards-engineer`** — before writing `thread-feed`'s `query` block.
- **`fidelity-qa-reviewer`** — `review-request` filed. What I want checked is **whether any
  claim here is wider than its evidence**, not a fidelity PASS: nothing in this slice is
  user-visible, and the one thing worth grading is whether *"completed, not validated"* is
  applied consistently or blurred anywhere.
