# CONTRACT — Schedules, triggers, and the fire ledger

**Owner:** `scheduler-engineer` · **Status:** proposed · **Date:** 2026-08-18
**Normative for:** `Plan §14` · ADR-024 · `apps/runner/src/db/migrations/0011_scheduling.sql` ·
`packages/contracts/src/scheduling.ts`
**Consumes:** `thread-model.md` §3 (addressing) · `api-contracts.md` (errors, the project axis) ·
`frontmatter-schema.md` (`schedule:`) · ADR-015 (project scoping, `budget_monthly`)

> **Nothing in this contract fires anything.** There is no clock in this repo. M18's foundation
> slice is two tables, one vocabulary and two refusals. No occurrence has ever been computed, no
> fire row has ever existed, and `0005`–`0011` have never met a live Postgres. Build against this
> file, not against `Plan §14`; the plan is not reviewed and this is.

---

## 1. What this governs, and the four things it deliberately does not

Governs: the shape of a schedule, the six trigger types, the two mandatory policies, how a
schedule addresses a thread, the fire ledger and its states, where a budget refusal lands, and
what a save-time cost preview is allowed to print.

Does not govern, with owners named so nobody assumes:

| Not here | Owner |
|---|---|
| Removing ofelia from `infra/compose.yaml:389`, and wake-on-LAN | `infra-compose-engineer` |
| The `calendar` widget — **ADR-028 already caps the widget vocabulary at three new types ever**; M18 writes no second widget ADR | `dashboards-engineer` |
| The schedule editor, the save dialog, the "next up" strip | later M18 slices |
| Where a fire's run is placed and how it is started | `runner-engineer` |
| Fire metrics and their span attributes | `observability-engineer` |
| Whether `schedule:` in frontmatter grows the mandatory intent (§3.3) | `agent-library-curator` |

## 2. Invariants — fixed by ADR-024, not open for design

1. **The coordinator owns the clock.** One scheduler process, `ops.schedule` +
   `ops.schedule_fire`. Not Docker labels, not one host.
2. **One table, two authorities.** `source = 'library'` rows are materialized from agent
   frontmatter and are read-only in the UI, edited by PR; `source = 'ops'` rows are ad-hoc. **A
   schedule that exists only in Postgres and that frontmatter does not know about is a BOARD rule
   2 violation**, and `source` is what makes that statement checkable.
3. **The fire row is written at the occurrence time, before the run.**
4. **The idempotency key is `(schedule_id, occurrence_time)`.** A restart hits a UNIQUE
   constraint instead of starting a second paid run.
5. **`missed_run_policy` and `overlap_policy` are mandatory and have no default**, as do `tz`,
   `follow_me`, `jitter_seconds`, `auto_disable_after`, `enabled`, `review_at` and `created_by`.
6. **A schedule addresses a thread in `thread-model.md` §3's grammar. There is no second
   grammar**, and the one narrowing is §3.4.
7. **No money figure is printed anywhere by anything this contract governs.**

## 3. `ops.schedule`

Types, keys, nullability and constraint names are fixed by `0011_scheduling.sql`. The columns
with a decision behind them:

### 3.1 `source` — the frontmatter/ops split, preserved

`library` · `ops`, `schedule_source_known`. `library_ref` names the agent whose frontmatter the
row came from and is present **exactly when** `source = 'library'`
(`schedule_library_ref_matches_source`) — an ops row that named a source file would make "edited
by PR" point nowhere, and a library row that named none would make the PR unfindable from the
row.

**No `library` row is writable today.** See §3.3.

### 3.2 The six trigger types

`cron` · `interval` · `event` · `condition` · `chain` · `manual`
(`schedule_trigger_kind_known`). Per-kind parameters live in `trigger_spec jsonb`, constrained to
be an **object** (`schedule_trigger_spec_is_object`) and never prose — an `event` spec holds a
Gmail filter or a JQL, which is somebody's correspondence, and composed into a sentence first,
key-based redaction stops reaching it (§7).

**Event triggers arrive through the same MCP allowlist door as everything else** (M9's rule, and
CLAUDE.md rule 4): a connector that can be read can be subscribed to. There is **no special-case
capability for subscription**, and a schedule may not widen an agent's `wired_into`. A
`trigger_spec` naming a connector the project holds no `ops.credential` row for is
`connector_uncredentialed`, exactly as a run would be.

### 3.3 The mandatory policies, and the reason no `library` row can exist yet

| Column | Values | Constraint |
|---|---|---|
| `missed_run_policy` | `skip` · `catch_up_once` · `catch_up_all` · `ask` | `schedule_missed_run_policy_known` |
| `overlap_policy` | `skip` · `queue` · `kill_previous` · `allow_parallel` | `schedule_overlap_policy_known` |
| `tz` | an IANA zone name | `schedule_tz_present` |
| `follow_me` | boolean — track the zone you are standing in, or stay on home time | `NOT NULL`, no default |
| `jitter_seconds` | 0–3600 | `schedule_jitter_sane` |
| `auto_disable_after` | N consecutive failures | `schedule_auto_disable_after_positive` |

**None of these has a `DEFAULT`, and that is the load-bearing decision.** `skip` silently loses a
briefing; `catch_up_all` silently spends four figures on a laptop that slept a week. The two
failures point in opposite directions, so there is no safe default — a default would let a writer
that never considered the question look exactly like one that did.

**Graded from the other side, because that is the half M15 got wrong.** A `NOT NULL` the only
writer cannot satisfy is 0005's defect: four constraints the ledger writer never named, which
would have failed to record a run *after* the model was paid for.

- The **`ops`** writer can satisfy all seventeen mandatory columns — they are exactly the fields
  the save dialog has to collect anyway.
- The **`library`** writer **cannot.** `AgentFrontmatter.schedule` is
  `z.string().refine(isCronExpression).optional()` — a bare 5-field cron with no zone, no intent
  and no policy. **So zero `source: 'library'` rows are writable today.**

That is the correct outcome, not a bug. The alternative is four invented policy values written
onto every scheduled agent in the library and displayed as its author's choices — the house
defect applied to the two settings that decide whether a sleeping laptop costs nothing or costs
four figures. `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` is typed `false`, and a test
asserts the frontmatter schema still lacks the four keys, so **the day
`agent-library-curator` widens `schedule:` the assertion goes red and points here.** Filed to
them as a `decision-request`; it is their contract, not mine.

`until_at` is **nullable** and `review_at` is **not**, and the asymmetry is deliberate — see
ADR-024's *Consequences*. A review date is derivable at write time; an expiry cannot be invented
for an agent that never declared one, and the quarterly sweep flags `until_at IS NULL` rather
than a constraint blocking the library path outright.

### 3.4 The target — `thread-model.md` §3's grammar, with one narrowing stated both ways

`kind` / `delivery` / `addressed_to`, the same three columns as `ops.thread`, the same shapes,
the same `*_matches_kind` pairing. `Plan §14`: *"schedules target threads, not only agents"* —
which composes with §12's addressing for free only if it is literally the same grammar.

| Typed | `kind` | `delivery` | Schedulable? |
|---|---|---|---|
| `@sales/digest` | `agent` | `direct` | yes |
| `#sales` | `department` | `dispatch` | yes |
| *(nothing)* | `project` | `default` | yes — `chief-of-staff` |
| `@@sales` | `department` | `fan-out` | **refused** |
| a session | `session` | `session` | **refused** |

**`@@` is refused at insert, and this is narrower than the grammar on purpose.** Fan-out dispatch
is already refused until a cap proves a refusal (`thread-model.md` §6.1) — but *that* refusal is
**interactive**: `assertFanOutDispatchable` throws a sentence a human reads while typing, and the
composer must name the count in an explicit confirm. A schedule fires unattended at 03:00 with
nobody there to read anything. So a stored `@@` schedule is a row whose only reachable outcome is
a nightly failure, **and it is the most likely route by which fan-out gets quietly switched back
on**, because a schedule that fails every night reads as a bug somebody should go and fix.

Said from the permissive side, which is the side that gets forgotten: **an address that is
perfectly legal in `thread-model.md`'s grammar is unstorable here.** That is a refusal with a
stated reason and a code, not a parser disagreement. `assertScheduleAddressable()` raises it
before the database is reached; `schedule_delivery_known` catches anything that gets past.
`session` is refused because a schedule cannot host a CLI (ADR-037).

The day the cap refuses something for real, widening `SCHEDULE_DELIVERIES` and deleting one
branch is a single reviewed diff.

### 3.5 The escalation ladder

`Plan §14` detail 7: retry with backoff → notify → **auto-disable after N consecutive failures,
loudly.** `consecutive_failures` is the counter (`DEFAULT 0` — a zero that is observed, not
declared), `auto_disable_after` is N, and `schedule_disabled_names_a_reason` makes
`disabled_reason` mandatory whenever `enabled` is false: a disabled schedule with no reason is
indistinguishable from one somebody turned off on purpose, which is how thirty failed nights stay
invisible.

**A retry does not create a second fire row** — see §4.

## 4. `ops.schedule_fire` — the ledger

**The row is written at the occurrence time, in `pending`, before anything runs.** Fire-then-
record makes "never fired" invisible, which is precisely the failure most worth seeing.

This is a mechanism, not a convention: `schedule_fire_recorded_before_run` is
`CHECK (started_at IS NULL OR recorded_at <= started_at)`, so a writer that inserts after
starting the run writes a row Postgres refuses.

| State | Means |
|---|---|
| `pending` | the occurrence is due and nothing has started (`schedule_fire_pending_has_not_started`) |
| `running` | a run is in flight |
| `done` / `failed` | terminal; `ended_at` is mandatory (`schedule_fire_finished_has_an_end`) |
| `missed` | the occurrence passed with no host. **Distinct from `skipped`** — nobody decided anything |
| `skipped` | a policy or a refusal declined it, and `refusal_code` says which (`schedule_fire_skip_names_a_reason`) |

**`occurrence_time` is the scheduled instant, never the actual one.** Jitter, catch-up and retry
all move when a run actually starts; if the key moved with them it would not be a key.

**`(schedule_id, occurrence_time)` is `UNIQUE`** — `schedule_fire_idempotent`. `Plan §14` calls a
double-fire on restart *"the single most common scheduler bug in existence"*, and a coordinator
re-deriving occurrences after a restart hits this constraint instead of starting a second paid
run.

**A retry increments `attempts` on the existing row.** A second row would carry the same
`(schedule_id, occurrence_time)` and defeat the very key the retry ladder depends on.

`thread_id` is nullable and is NULL while `pending`: *"a schedule creates threads"* is a statement
about who calls `createThread`, and it has not been called yet at the moment the row is written.
That ordering is the whole point. Every reference out of this table — schedule, thread, question —
is **project-pinned by a composite FK**, which is the one item M16's first review FAILed on.

## 5. Budget — a refusal, and it has never refused anything

`Plan §14`: *"Before you save, the dialog shows projected monthly spend for this schedule and the
project's total scheduled burn against `budget_monthly`. **A fire that would exceed the project
cap does not run — it raises a question.**"*

**Every clause of "it has never refused anything" is checkable:**

| | State |
|---|---|
| `ops.project.budget_monthly` | declared, **not enforced** (ADR-015 Q6, `0005` line 95) |
| `ProjectSummary.budgetMonthlyUsd` | **hardcoded `null`** — `apps/runner/src/lib/project.ts:261`. No caller has ever seen a cap |
| Part V's workspace cap | the only enforced ceiling; **has never fired** |
| Runs executed, ever | **zero** |

So the refusal path has **a place to be recorded and no mechanism that produces it**:
`state = 'skipped'`, `refusal_code = 'budget_would_exceed_cap'`, and `question_message_id`
pointing at an `ops.message` of kind `question` (ADR-023 — there is **no `ops.question` table**
and M18 does not add one).

`SCHEDULE_BUDGET_ENFORCEMENT.enforced` is typed `false`, so arming it is a reviewable type-level
act with a diff rather than a config edit at 2am — the `FAN_OUT_DISPATCH.allowed` precedent.
**Do not write a surface that reads as though a cap is protecting the user today.**

## 6. What a save-time preview may print

`ScheduleCostProjection` in `packages/contracts/src/scheduling.ts`.

**The fire count is real. The money has no source.** Zero runs have completed, so there is
nothing to average — and this is the one preview in the product where a number gets multiplied by
every occurrence for the next month before anybody checks it. So `estimatedUsd` is **typed
`null`**, exactly as `TurnCost.estimatedUsd` is: the day real runs exist, making it a number
**stops the file compiling**, and the diff that widens the type is the diff that has to say where
the figure came from. `estimateBasis: 'no-completed-runs'` carries the reason in the same breath.

**`firesAreExact` is `false` for four of the six triggers.** Only `cron` and `interval` have a
count derivable from the trigger; `event`, `condition` and `chain` fire on the world and `manual`
fires on a person. A calendar printing a confident number under a Gmail filter is a plausible
zero, one decimal place up.

**Never save an unpreviewed cron expression** (`Plan §14`). Natural language in, expression **plus
the next ten fire times** out, confirm. **Not built, and named as unbuilt**: nothing in this repo
parses a cron beyond `isCronExpression`'s five-field shape check, and nothing computes a next
occurrence. The save path owes this before it accepts its first expression; it is a later M18
slice and the requirement is recorded here rather than half-typed, because a `nextFireTimes: []`
that nobody fills is a producer with no consumer.

## 7. PDPL (Part VII.4)

Neither table holds a message body. Two values carry a person's words indirectly:

- **`trigger_spec`** — an `event` filter is somebody's correspondence. Stored as an **object**,
  never composed into prose, because flattening defeats key-based redaction: as an object four
  keys redact, flattened into a sentence four of five leak. Found four times in one night.
  **It must never become a span attribute** — a `trigger_spec` in a trace is a Gmail filter in
  OTLP, which is exactly the `trace.event('mailbox-read', message)` defect one table over.
- **`disabled_reason`** — written by the escalation ladder, from a failure. **It must not carry
  the failing run's output.** A body inside an error string leaks and no key rule reaches it
  (BRIEF's flattening finding, third costume). This is a requirement on a writer that does not
  exist yet, stated here because that writer's author will read this section.

Fire metrics are counts and states and are `observability-engineer`'s.

## 8. Proposed error codes — `runner-engineer`'s to accept or rename

`api-contracts.md` is theirs; these are requested, not written. Precedent: `thread-model.md` §11.

| code | status | when |
|---|---|---|
| `schedule_address_not_schedulable` | 422 | `@@` or a session as a schedule target (§3.4). Deliberately **not** `fanout_dispatch_refused` (503): that one says *you did nothing wrong and it lifts when the cap fires*; this one refuses a **stored intent** and the hint names the two forms that do work |
| `schedule_policy_missing` | 400 | a save with no `missed_run_policy` / `overlap_policy` / `tz` / `follow_me`. The hint must **not** suggest a value |
| `schedule_not_found` | 404 | unknown schedule **in this project's scope** — opaque across projects, like `run_not_found` |

**Two existing codes are affected by ADR-024 and both are `runner-engineer`'s call:**
`ofelia_sync_failed` (502) and the `ofeliaSynced` field of `POST /api/schedule` describe a
mechanism this ADR removes. They are **not** removed here; the ofelia removal is
`infra-compose-engineer`'s and the route is `runner-engineer`'s.

## 9. What this contract cannot validate yet

Stated, because a contract that hides its own gaps is worse than one with gaps.

1. **Nothing fires.** No clock, no occurrence computation, no cron parsing beyond five fields, no
   catch-up, no jitter application, no wake-on-LAN. The columns exist; the behaviour does not.
2. **Neither table has met a Postgres.** `0005`–`0011` have never been applied to a live
   database. Every constraint here is asserted as *text in a migration*, by
   `schedule-schema-pinning.test.ts`, which is a lower bound on agreement and not a proof of it.
   `sql-executes.test.ts` skips on an unset `DATABASE_URL`.
3. **No writer exists**, so §3.3's mandatory set is graded against a **declared** writer contract
   (`SCHEDULE_REQUIRED_COLUMNS`) rather than against code that inserts. Both directions are
   asserted; neither has inserted a row.
4. **The budget refusal is unexercised** (§5) and so is the `@@` refusal — both are branches that
   have never been taken by anything but a test.
5. **RLS is inert on this stack.** Compose connects as the owner; `FORCE ROW LEVEL SECURITY` is
   the only reason the policies fire at all, and the enforcement that actually holds is the
   reader's own `WHERE project_id = $1` plus the foreign keys, which fire for every role
   (`thread-model.md` §8b).

## 10. Consumers — and what each one is getting

| Consumer | Gets | Does **not** get |
|---|---|---|
| `runner-engineer` | the fire ledger's states, the three proposed error codes, where a run attaches | a placement policy, a concurrency ceiling (a host property, not a schedule's) |
| `dashboards-engineer` | one table to read for a week grid, `firesAreExact`, and **no money field** | a `calendar` implementation, or permission for an eighth hue. **Colour a calendar by department and BOARD rule 1 dies there first** — the existing seven data-ink hues are the cap; use weight and position for everything else |
| `thread-model-engineer` | `created_by = 'schedule:{id}'` on threads a fire creates — already legal in `thread_created_by_shape` | any change to the addressing grammar. §3.4 narrows what is *storable*; it does not touch the parser |
| `observability-engineer` | fire counts and state transitions | `trigger_spec` or `disabled_reason` as span attributes (§7) |
| `infra-compose-engineer` | ADR-024 as the authority to remove ofelia | the removal itself, which is theirs to sequence |
| `agent-library-curator` | the four keys `schedule:` needs before a library row can exist (§3.3) | a decision about `frontmatter-schema.md`, which is theirs |

## 11. OPEN — must be answered before code depends on them

| # | Question | Owner |
|---|---|---|
| 11.1 | Does `schedule:` in frontmatter become an object carrying `tz`, `follow_me`, `missed_run_policy`, `overlap_policy`? **Until it does, no `source: library` row can exist** and the frontmatter/ops split has only one live half | `agent-library-curator` |
| 11.2 | Are the three error codes in §8 accepted, and what happens to `ofelia_sync_failed` and `ofeliaSynced`? | `runner-engineer` |
| 11.3 | Where does the per-host concurrency ceiling live (`Plan §14` detail 5)? It is a property of a host, so it is not a column here — `ops.device`, or compose? | `infra-compose-engineer` with `runner-engineer` |
| 11.4 | Quiet hours: results inside them are held for the morning briefing and only `halt` questions and hard failures escalate. Which surface owns the window, and is it per-project or per-identity? | `client-platform-engineer` (M11/M19 preferences), unrostered — held by `runner-engineer` |
| 11.5 | Does `chain` reference a schedule or a fire? A chain on *"research succeeds → draft"* is an outcome of one occurrence, which argues for the fire; nothing depends on it yet, so it is deferred rather than guessed | `scheduler-engineer` (me), before the first `chain` row |
