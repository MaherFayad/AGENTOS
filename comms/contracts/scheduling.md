# CONTRACT — Schedules, triggers, and the fire ledger

**Owner:** `scheduler-engineer` · **Status:** proposed · **Date:** 2026-08-19
**Normative for:** `Plan §14` · ADR-024 · `apps/runner/src/db/migrations/0011_scheduling.sql` ·
`packages/contracts/src/scheduling.ts` · `apps/runner/src/lib/scheduleClock.ts` ·
`apps/runner/src/lib/schedulePlan.ts`
**Consumes:** `thread-model.md` §3 (addressing) · `api-contracts.md` (errors, the project axis) ·
`frontmatter-schema.md` (`schedule:`) · ADR-015 (project scoping, `budget_monthly`) ·
ADR-039 (wake-on-LAN refused)

> **Nothing in this contract fires anything.** Wave 1 adds occurrence computation, the fire
> ledger's transitions, both mandatory policies, jitter, the concurrency cap and the ten-fire-time
> preview — **as pure functions with no clock, no loop and no database.** `planTick` returns a
> list of intentions; nothing executes them. No fire row has ever existed, no run has ever run,
> and `0005`–`0011` have never met a live Postgres. Build against this file, not against
> `Plan §14`; the plan is not reviewed and this is.

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

**`cron` means the five-field dialect `parseCron` accepts, and that is now a decision with a
live reason — ADR-040.** `validate-frontmatter.mjs` refused six fields because *"ofelia would
silently take a 6-field one to mean something else"*; ofelia left the stack at `e4e0bff`, so the
rule was standing on a deleted component. It is kept, with the reason replaced: `parseCron` is
the only code here that turns an expression into an occurrence — `nextRunAt` and `scheduleClock`
both share it — and it takes exactly five fields, so a six-field `schedule:` is a clock badge for
a job that can never be planned. `cron-dialect.test.ts` runs every `schedule:` string in the real
library through the coordinator's parser, which is a committed value graded against the behaviour
that has to consume it rather than two validators agreeing with each other.

**One divergence is open and is not mine to close.** `isCronExpression` accepts `0 0 * * 7`
(POSIX's Sunday); `parseCron` throws `day of week 7 is out of range`. Observed: with
`schedule: "0 6 * * 7"` planted in a real agent file, `npm run validate:frontmatter` exits **0**.
So an agent can be committed today with a schedule that validates, renders a badge and can never
fire. The gate above catches it at commit; the fix is one line in `apps/runner/src/lib/cron.ts`
(`runner-engineer`'s) and is filed to them, pinned meanwhile in `cron-dialect.test.ts`.

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

**That tripwire had a blind spot and it has been closed, with the blindness demonstrated rather
than argued.** The key-set assertion watches the *top-level keys* of the frontmatter shape, which
catches four new sibling keys and **misses `schedule:` becoming an object that carries them** —
`schedule` is still exactly one key, the set is unchanged, and a `source: library` row becomes
writable under a green pin. Observed: widening the field to
`z.union([z.string()…, z.object({cron}).passthrough()])` and re-running the suite, *"no source:
library row is writable"* **passed**. The second assertion (`the schedule: field itself still
takes a bare cron string and refuses an object`) asks the live schema a question and reads the
answer, and it went red. This is the standing finding in a new costume: a pin comparing two
declarations is satisfiable by a lie.

**Wave 2's decision on §11.1 is therefore: it stays refused.** Not because an object-form
`schedule:` is wrong — it is the likelier design — but because widening it is a frontmatter
schema change and needs `agent-library-curator` and an ADR, not a scheduler quietly reading four
fields into columns whose whole point is that no default is safe.

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

### 4.1 The transitions — because Postgres cannot check a move

`SCHEDULE_FIRE_TRANSITIONS` / `assertFireTransition`. `schedule_fire_state_known` proves a value
is in the vocabulary and says **nothing** about the move: a writer can take a `done` row back to
`pending` and every CHECK in `0011` passes. So the rule has an enforcer in code, as
`assertThreadTransition` does (`thread-model.md` §4.5).

| From | May become |
|---|---|
| `pending` | `running` · `missed` · `skipped` |
| `running` | `running` (**retry only**) · `done` · `failed` |
| `done` · `failed` · `missed` · `skipped` | nothing — terminal |

Three of those are decisions rather than bookkeeping:

- **`pending → missed`** is the state that *only exists because the row is written first*. Under
  fire-then-record a coordinator that died between deciding and starting leaves nothing at all.
  This is what detail 1 buys.
- **`missed` ≠ `skipped`.** `skipped` means somebody decided — a policy, a refusal, an expiry, and
  `refusal_code` says which. `missed` means nobody did. Collapsing them hides a crashed
  coordinator inside a column that reads as a normal policy outcome.
- **`running → running` is legal only when `attempts` strictly increases.** That is detail 7's
  retry ladder on the existing row; a self-edge that increments nothing is a writer touching a row
  it did not advance, indistinguishable from a stuck run.

**A catch-up does not revive a terminal row.** It is a fresh decision about an occurrence that has
no row yet, taken at planning time.

### 4.2 The CHECKs are mirrored in code, because today they are enforced there or nowhere

`SCHEDULE_FIRE_ROW_CHECKS` restates every row-local CHECK in `0011` under **the constraint's own
SQL name**, and `assertFireRowValid` runs them. `schedule-schema-pinning.test.ts` asserts the two
sets are equal in both directions, so a CHECK added to the migration that no writer mirrors fails
the build — 0005's defect, which was four constraints the ledger writer never named and which
would have failed to record a run *after* the model was paid for.

`schedule_fire_idempotent` is `UNIQUE`, not a CHECK: it is a statement about a table and no
single row can answer it. It is listed in `SCHEDULE_FIRE_TABLE_CONSTRAINTS` so the both-directions
assertion has somewhere to put it rather than tolerating a gap, and its only honest mirror in code
is `planTick` refusing to plan a second record for a key it already holds.

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

### 6.1 The ten fire times — built in wave 1, and what they are computed by

**Never save an unpreviewed cron expression** (`Plan §14`). `previewFireTimes` in
`apps/runner/src/lib/scheduleClock.ts` returns the expression, the resolved zone, and
`PREVIEW_FIRE_TIME_COUNT` = **10** occurrences, each as a UTC instant *and* as the wall clock a
person is actually confirming.

**The natural-language half is not built and is named as unbuilt.** Turning *"every weekday at
seven"* into `0 7 * * 1-5` is a model call and belongs to the save dialog. A phrase-matching
approximation of it here would fail by producing a confidently wrong expression, which is the
one failure the ten fire times exist to catch.

**The preview is computed on the server, by the same function the coordinator plans with.** A
browser-side preview would be a second implementation of occurrence computation, and the two
would answer differently on exactly the two days a year that are not 24 hours long.

**`previewToken` is the receipt, and it is the mechanism behind the word "confirm".** The save
route must recompute it from the expression, zone, `follow_me` and the ten instants it would fire,
and refuse a mismatch with `schedule_preview_stale`. FNV-1a, non-cryptographic, and **explicitly
not a security boundary** (BOARD rule 6 — build nothing that is only safe because something else
is): anyone on the tailnet can compute one. What it catches is the ordinary bug — a dialog that
previewed Mondays, a field edited before the button, and a schedule that fires monthly under a
confirmation screen that said weekly.

### 6.2 The two days a year that are not 24 hours long

Both are decisions, both are surfaced in the preview, and the second is load-bearing for detail 2.

| | What happens | Why not the other thing |
|---|---|---|
| **Spring forward** — 02:30 does not exist | **No occurrence.** Counted in `nonexistentLocalTimes` | Shifting to 03:00 invents a time the author did not write |
| **Fall back** — 01:30 happens twice | **One occurrence, the earlier instant.** Counted in `ambiguousLocalTimes` | Two instants are two `occurrence_time` values, so they are **two different idempotency keys** and `schedule_fire_idempotent` cannot catch the second. The duplicate is prevented here or not at all |

### 6.3 A finding: `tz` is narrower than `Intl` accepts, and that is deliberate

Observed on this host, Node 22, while writing the test that now pins it:

```
new Intl.DateTimeFormat('en-US', { timeZone: 'AST' }).resolvedOptions().timeZone  // 'America/Anchorage'
new Intl.DateTimeFormat('en-US', { timeZone: 'EST' }).resolvedOptions().timeZone  // 'America/Panama'
```

`AST` is what a person in Riyadh writes for Arabia Standard Time and what a person in Halifax
writes for Atlantic Standard Time. ICU returns **Alaska**, with no error. A 07:00 briefing then
fires at 19:00 local forever and looks correct in every view — the quietly-wrong class arriving
one layer *below* the preview, where the preview would cheerfully confirm it.

So `tz` must be IANA `Area/Location`, or exactly `UTC`. `schedule_tz_present` in `0011` only
checks `length(tz) > 0`; the real narrowing is `formatterFor`, and the cost is the legacy
single-word links (`Japan`, `Egypt`, `Zulu`), all of which have canonical two-part names.

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
| `schedule_preview_stale` | 409 | the save body's `previewToken` does not match a recomputation of the expression it carries. §6.1. The hint says the times changed and shows the new ten |
| `schedule_tz_unknown` | 422 | not an IANA `Area/Location` name. §6.3 — the hint must name the AST case, because a user who typed an abbreviation believes it is a timezone |
| `schedule_zone_unresolved` | 422 | `follow_me: true` and nothing supplies a current zone (§9.6). **Not 500**: the request is well-formed and the build is incomplete |
| `schedule_trigger_not_computable` | 422 | a preview or a next-time was asked for on `event` / `condition` / `chain` / `manual` |
| `schedule_fire_transition_refused` | 409 | an illegal move in the fire ledger (§4.1). The sibling of `thread_transition_refused` |

**Two existing codes are affected by ADR-024 and both are `runner-engineer`'s call:**
`ofelia_sync_failed` (502) and the `ofeliaSynced` field of `POST /api/schedule` describe a
mechanism this ADR removes. They are **not** removed here; the ofelia removal is
`infra-compose-engineer`'s and the route is `runner-engineer`'s.

## 9. What this contract cannot validate yet

Stated, because a contract that hides its own gaps is worse than one with gaps.

1. **Nothing fires.** Occurrences are computed and policies are executed — **as decisions, not as
   actions.** There is no tick loop, no process, no timer, no executor. `planTick` returns a list
   of intentions and nothing in this repo consumes it. No `record` has become a row, no `start`
   has become a run.
2. **Neither table has met a Postgres.** `0005`–`0011` have never been applied to a live
   database. Every constraint here is asserted as *text in a migration*, by
   `schedule-schema-pinning.test.ts`, which is a lower bound on agreement and not a proof of it.
   `sql-executes.test.ts` skips on an unset `DATABASE_URL`. **In particular
   `schedule_fire_idempotent` has never enforced anything**: the restart proof in
   `schedule-plan.test.ts` runs against a `Map` keyed the same way, which is agreement by
   construction and not by execution.
3. **No writer exists**, so §3.3's mandatory set and §4.2's CHECK mirror are graded against a
   **declared** writer contract rather than against code that inserts. `assertFireTransition` and
   `assertFireRowValid` have **no live caller** — they are for the executor `runner-engineer`
   owns, which is not built. Both directions are asserted; neither has inserted a row.
4. **The budget refusal is unexercised** (§5) and so is the `@@` refusal. The budget refusal is
   now *written and driven* — `fireBudgetVerdict`'s armed arm is tested, raises the question and
   does not consume a start slot — but it is **statically unreachable from every live call site**,
   because `SCHEDULE_BUDGET_ENFORCEMENT.enforced` is typed `false` and TypeScript narrows the
   union at the planner. The only way to construct its input is a test literal, and that is on
   purpose: all three numbers it needs (`capUsd`, `committedUsdThisMonth`, `projectedUsdThisFire`)
   have no source in this repo.
5. **RLS is inert on this stack.** Compose connects as the owner; `FORCE ROW LEVEL SECURITY` is
   the only reason the policies fire at all, and the enforcement that actually holds is the
   reader's own `WHERE project_id = $1` plus the foreign keys, which fire for every role
   (`thread-model.md` §8b).
6. **`follow_me: true` cannot fire today, at all.** Nothing in this repo reports which zone a
   person is standing in — `ops.device` records hosts, not people, and the preferences surface
   that would own it is M11/M19's and unbuilt. `resolveFiringZone` **refuses** rather than falling
   back to `tz`, because the fallback is precisely the defect detail 6 exists to prevent: a job
   the user set to follow them, quietly firing on home time forever, correct-looking in every
   view. `SCHEDULE_FOLLOW_ME.resolvableToday` is typed `false`. **So the second half of detail 6
   is structurally empty, exactly as the `library` half of §3.3 is.**
7. **No wake-on-LAN, and it is now refused rather than pending** — ADR-039
   (`infra-compose-engineer`). One machine is both coordinator and only execution host, so the
   process that would send the packet is asleep when it is needed; no column anywhere holds a MAC;
   and a `wakeHost()` over UDP cannot fail, so it would report success without sending anything.
   The honest cover for a sleeping host was always `missed_run_policy` — mandatory, no default.
8. **The concurrency cap is the coordinator's, not the host's** (§11.3 is still open). `planTick`
   takes `maxStartsPerTick` with no default and defers the surplus; deferred fires are `pending`
   rows and nothing else, so a restart loses no queue. Nobody supplies the number yet.

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
| 11.3 | Where does the per-**host** concurrency ceiling live (`Plan §14` detail 5)? It is a property of a host, so it is not a column here — `ops.device`, or compose? **Narrowed by wave 1, not answered:** the *coordinator's* per-tick cap is built (`maxStartsPerTick`, no default, surplus deferred as `pending`). The host ceiling is still yours and still unheld | `infra-compose-engineer` with `runner-engineer` |
| 11.4 | Quiet hours: results inside them are held for the morning briefing and only `halt` questions and hard failures escalate. Which surface owns the window, and is it per-project or per-identity? | `client-platform-engineer` (M11/M19 preferences), unrostered — held by `runner-engineer` |
| 11.5 | Does `chain` reference a schedule or a fire? A chain on *"research succeeds → draft"* is an outcome of one occurrence, which argues for the fire; nothing depends on it yet, so it is deferred rather than guessed. **Wave 1 checked whether the clock forced it and it does not:** `assertTriggerIsComputable` *refuses* `chain` rather than answering for it, because a chained occurrence is produced by an upstream outcome and never by a clock. Refusing is what keeps the question genuinely undecided instead of decided by accident at a call site | `scheduler-engineer` (me), before the first `chain` row |
| 11.6 | Who supplies the zone a person is standing in, so `follow_me: true` can fire at all (§9.6)? Until somebody does, half of detail 6 is structurally dead | `client-platform-engineer` (M11/M19 preferences), unrostered — same owner as 11.4 |
| 11.7 | Do the six route semantics in §13 get transcribed into `api-contracts.md` as written, and are the six new codes in §8 accepted? | `runner-engineer` |

## 12. The tick — what wave 1 executes, and the shape it executes in

`planTick` in `apps/runner/src/lib/schedulePlan.ts`. **A pure function**: `now` is an argument,
the ledger is an argument, the result is a list of actions somebody else performs. No clock, no
connection, no side effect.

That shape is the argument, not a preference. Detail 2 calls a double-fire on restart *"the single
most common scheduler bug in existence"*, and the only proof that a restart does not double-fire
is to run the same tick twice against the ledger the first one produced and watch the second plan
nothing. Inside a process with a timer and a pool, that test needs a sleeping laptop and a
Postgres. As a function it needs neither, so it exists today.

### 12.1 The order, and why it is that order

```
record → expiry/disabled → missed-run policy → overlap → budget → concurrency cap → start
```

- **Recording is unconditional and first.** Every due occurrence gets a `pending` row before any
  policy is consulted, so a schedule refused every night is nine hundred visible skips rather than
  silence.
- **Budget sits before the cap**, so a refused fire does not consume a start slot — otherwise a
  project over its cap quietly starves the projects that are not.
- **In-flight is tracked as the plan is built, not read once before it.** Two catch-ups planned in
  the same tick are two runs, and the second must see the first. Reading in-flight once means six
  catch-ups all start "because nothing is running", under a policy whose whole purpose is to
  forbid the second.

### 12.2 The two policies, executed

| `missed_run_policy` | What the plan contains |
|---|---|
| `skip` | every stale occurrence recorded, then `skipped` / `missed_run_policy_skip` |
| `catch_up_all` | every stale occurrence proceeds; the concurrency cap is the only brake, and it **defers** rather than drops |
| `catch_up_once` | the newest stale occurrence proceeds; the rest `skipped` / `catch_up_once_superseded` |
| `ask` | **one** question naming the whole batch. One per occurrence is 2,016 questions after a week of a five-minute job, which is a denial of service dressed as consent. The rows stay `pending` with `question_message_id` set, and the missed sweep leaves them alone |

An occurrence is a **catch-up** when it is older than `latenessToleranceSeconds` at planning time.
The same tolerance decides when a `pending` row that never started becomes `missed`. One
parameter, two uses, **no default** — one second is a lost briefing and thirty minutes is a run
started long after the meeting it was for.

| `overlap_policy` | What the plan contains |
|---|---|
| `skip` | `skipped` / `overlap_policy_skip` |
| `queue` | `defer` — the row stays `pending`. **The ledger is the queue.** A queue held in the coordinator's memory is a queue a restart loses |
| `kill_previous` | a `kill` aimed at each in-flight fire, then the new one starts. The killed row carries `killed_by_overlap_policy` |
| `allow_parallel` | starts |

### 12.3 Jitter is derived from the key, never from `Math.random()`

`jitterOffsetSeconds(scheduleId, occurrenceTime, jitterSeconds)` — FNV-1a over the idempotency
key, modulo `jitter + 1`.

A random offset makes a restart re-derive a *different* start time for the same occurrence, so one
fire has two answers to "when did this begin"; every duplicate-suppression window that reasons
about elapsed time then reasons about a moving target, and the ledger stops being reproducible
from its own inputs. Hashing the key gives the spread detail 5 asks for — fourteen schedules at
09:00 land on fourteen different seconds — and keeps the answer stable across every restart.

A catch-up starts at `max(occurrence, now) + jitter`, never at the occurrence: a `started_at`
before `recorded_at` is a row `schedule_fire_recorded_before_run` refuses.

### 12.4 The one refusal that is deliberately **not** a fire row

A schedule whose firing zone cannot be resolved (§9.6) produces **no occurrences and no rows**,
and comes back in `TickPlan.unresolvable` instead. An occurrence nobody can place in time is not
an occurrence; recording one against `tz` would write the exact fallback `SCHEDULE_FOLLOW_ME`
refuses, with the extra harm that `occurrence_time` is the idempotency key, so every key would
move the day the zone finally resolved. It is a **per-schedule fault** for detail 7's ladder, not
a nightly stream of identical skipped fires.

### 12.5 System jobs are not `ops.schedule` rows — answering `infra-compose-engineer`

ADR-008's nightly prune lost its trigger when ofelia went. It does **not** come back as an
`ops.schedule` row, and the decisive reason is the project axis, not the grammar:

- `ops.schedule.project_id` is `NOT NULL` with an FK to `ops.project`, and `ops.prune()` deletes
  **by age across every project**. Filing it under one project makes the retention of all projects
  depend on that project's row surviving, with `ON DELETE RESTRICT` as the only thing keeping it
  alive. That is a coordinator-wide fact wearing a project's clothes.
- §3.4's target grammar is `thread-model.md` §3's, column for column. A retention prune is not an
  agent, a department or the Chief of Staff, and adding a `system` kind forks the grammar the
  section exists to keep single.
- A prune fire would create a thread, enter a cost projection and consume a start slot meant for
  paid model runs. It is none of those things.

So: **a plain interval in whatever process hosts the clock**, owned by the job's owner. The honest
consequence, stated because it cuts against detail 1: a system tick has **no fire row**, so *"the
prune never ran"* is not visible the way a schedule's miss is. That gap belongs with ADR-008's
owner (`observability-engineer`) as a metric, and this contract does not close it.

## 13. Routes — semantics proposed to `runner-engineer`, who owns `api-contracts.md`

Same split as `POST /api/p/:project/thread/:id/message`: the semantics are argued here, the
transcription is theirs. **Every path carries the project segment** (ADR-015) — a lookup-then-scope
route lets a caller-supplied id choose its own scope, which is the shape M16 FAILed on.

| Route | Semantics |
|---|---|
| `POST /api/p/:project/schedule/preview` | `{trigger, tz, followMe}` → `FireTimePreview`. **Idempotent and writes nothing.** Refuses `schedule_trigger_not_computable` for the four kinds with no clockable occurrence, `schedule_tz_unknown` for an abbreviation, `schedule_zone_unresolved` for follow-me |
| `POST /api/p/:project/schedule` | create an **`ops`** row. Body carries all seventeen mandatory columns **plus `previewToken`**; the server recomputes it and refuses `schedule_preview_stale` on mismatch (§6.1). `assertScheduleAddressable` runs before the database. **`source` is not a body field** — a request cannot claim to be `library` |
| `GET /api/p/:project/schedule` | that project's rows only. `source` is returned so a UI can render `library` rows read-only. Today the `library` half is always empty (§3.3) and an honest empty state says so |
| `PATCH /api/p/:project/schedule/:id` | `enabled`, `until_at`, `review_at`, and the policies. **A `library` row is 409** — it is edited by PR. Disabling requires `disabled_reason`, per `schedule_disabled_names_a_reason` |
| `GET /api/p/:project/schedule/:id/fires` | the ledger for one schedule, newest first. The calendar's read. **No money field** |
| `POST /api/p/:project/schedule/:id/fire` | fire now, out of band. Writes a `pending` row with `occurrence_time = now` **before** starting, like every other path, so a manual fire is not a second, unrecorded way to start a run |

**Two existing surfaces are contradicted by ADR-024 and remain `runner-engineer`'s to sequence:**
`POST /api/schedule` (unscoped, ofelia-era, writes frontmatter and calls a sidecar that no longer
exists) and the `ofeliaSynced` field it returns. `ofelia_sync_failed` (502) now describes a
mechanism removed from `infra/compose.yaml`. **Not changed here.**

**`nextRunAt` in `apps/runner/src/lib/cron.ts` is UTC-only** and feeds that route's `nextRunAt`
field and the map's clock badge. For any `tz` other than UTC it is wrong by the offset. It is not
removed, and `schedule-clock.test.ts` asserts the two implementations agree **at `tz: 'UTC'`**, so
they cannot silently fork while both exist.
