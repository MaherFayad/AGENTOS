# ADR-024 — The coordinator owns the clock: one schedule object, two authorities, a fire ledger written before the run

**Date:** 2026-08-18 · **Author:** `scheduler-engineer` · **Status:** proposed
**Affects:** `comms/contracts/scheduling.md` (new) · `comms/contracts/api-contracts.md` (§`POST /api/schedule`, the error table) · `comms/contracts/frontmatter-schema.md` (`schedule:`) · `skilltree-clone-spec.md` §3.2 (ofelia) · `infra/compose.yaml` · M18

## Context

`Plan §14` is the amendment. Spec §3.2 is still the spec of record and it specifies **ofelia**:
recurring schedules live in agent frontmatter, `POST /api/schedule` commits them, ofelia reads
Docker labels on one host and fires. `api-contracts.md` carries the whole shape today, down to
`ofeliaSynced:false` and the `ofelia_sync_failed` error code.

Ofelia reads Docker labels on **one host**. It cannot express N projects, N execution hosts,
catch-up after a sleeping laptop, timezone intent, budget refusal, or a UI. Every one of those is
a `Plan §14` requirement, and none of them is reachable by configuring ofelia harder.

Two things made the obvious option non-obvious.

**First, the frontmatter/ops split is right and the temptation is to throw it out with ofelia.**
A `schedule:` in an agent's `SKILL.md` is part of that agent's *identity* — it arrives by commit,
it is reviewed in a PR, it is the same fact on every host. That property has nothing to do with
who fires the timer, and BOARD rule 2 (frontmatter is the single source of truth; views are
projections) means a schedule that exists only in Postgres and that frontmatter does not know
about is a rule-2 violation. Ofelia's departure must not take the split with it.

**Second, the headline mechanism cannot be built.** `Plan §14`'s flagship line is *"a fire that
would exceed the project cap does not run — it raises a question."* In this tree:
`apps/runner/src/lib/project.ts:261` returns `budgetMonthlyUsd: null` unconditionally,
`ops.project.budget_monthly` is declared and unenforced (ADR-015 Q6, 0005 line 95), Part V's
workspace cap has never once refused anything, and **zero runs have ever executed.** A decision
that quietly implies otherwise is worth less than no decision: it is BRIEF's house defect (a
declared value read as an observed one) sitting on the one surface where believing a number costs
four figures.

## Options

| Option | For | Against |
|---|---|---|
| **A — keep ofelia, add a wrapper table** | No spec amendment. Nothing to rebuild. | The wrapper's state and ofelia's labels are two authorities on one fact, on one host. `api-contracts.md` already calls the desynchronised case *"a bug, never a state to reconcile"* — this makes it the normal case. Catch-up, timezone intent and refusal are still unreachable. |
| **B — coordinator owns the clock; two tables; frontmatter split preserved** | Every `Plan §14` requirement becomes expressible. One fire ledger, one UI, six trigger types in one object. Frontmatter stays the identity plane. | ofelia's removal is a spec §3.2 amendment. `api-contracts.md`'s `POST /api/schedule` shape and two error codes become wrong. Someone has to write a clock, and none exists today. |
| **C — B, but two tables: `ops.schedule_library` and `ops.schedule_ops`** | Read-only-ness is structural: the library table has no UI write path at all. | Two tables means every reader, every calendar query and every fire path unions them, and the *first* one somebody forgets is a silently missing schedule. The authority is a property of a row, not of a table. |
| **D — B, but defaults for the missed-run and overlap policies** | Frontmatter's `schedule:` (a bare cron string) could be materialized today. | A default makes a writer that never thought about the question look like one that did. `skip` silently loses a briefing; `catch_up_all` silently spends four figures on a laptop that slept a week. There is no safe default because the two failure modes point opposite ways. |

## Decision

**We adopt B.** The coordinator owns the clock. `ops.schedule` and `ops.schedule_fire` are
created by `0011_scheduling.sql`. Ofelia is removed from `infra/compose.yaml` — **by
`infra-compose-engineer`, in a later slice; this ADR authorizes the removal and does not perform
it**, and spec §3.2 is amended by this ADR rather than by a commit message.

Seven rulings, each of which another agent could otherwise contradict:

1. **One table, two authorities.** `ops.schedule.source` is `library` or `ops`. `library` rows are
   materialized from an agent's frontmatter on library sync and are read-only in the UI, edited by
   PR; `ops` rows are ad-hoc and created in the app. Not two tables (option C): the authority is a
   property of a row. A schedule that exists only in Postgres and that frontmatter does not know
   about is a BOARD rule 2 violation, and `source` is what makes that statement checkable.

2. **The fire row is written at the occurrence time, before the run.** `pending → running →
   done|failed|missed|skipped`. Fire-then-record makes "never fired" invisible, which is the
   failure most worth seeing. This is enforced, not documented: `schedule_fire_recorded_before_run`
   is a CHECK that `recorded_at <= started_at`.

3. **The idempotency key is `(schedule_id, occurrence_time)`,** a UNIQUE constraint named
   `schedule_fire_idempotent`. A restart re-deriving occurrences hits the constraint instead of
   double-firing. **A retry does not create a second fire row** — it increments `attempts` on the
   one that exists; otherwise the escalation ladder would defeat the key it depends on.

4. **`missed_run_policy` and `overlap_policy` are `NOT NULL` with no `DEFAULT`,** as are `tz`,
   `follow_me`, `jitter_seconds`, `auto_disable_after`, `enabled`, `review_at`, `state`,
   `created_by`. Option D is refused. The cost of this ruling is stated in §5 below and is real.

5. **A schedule's target is written in `thread-model.md` §3's grammar, not a second one** — the
   same `kind` / `delivery` / `addressed_to` triple as `ops.thread`, with the same constraint
   shapes. **`fan-out` and `session` are refused at insert.** `@@` dispatch is refused today until
   a cap proves a refusal (`thread-model.md` §6.1); that refusal is *interactive* — a human reads
   it while typing. A stored `@@` schedule fires unattended at 03:00 with nobody to read anything,
   so it is a row whose only reachable outcome is a nightly failure, and it is the single most
   likely way `@@` gets quietly re-enabled ("the schedule keeps failing, let's fix it"). Refusing
   the row is narrower than the grammar, deliberately, and §3.4 of the contract says so from both
   sides. A `session` target is refused because a schedule cannot host a CLI.

6. **The budget refusal path exists and has never refused anything, and both halves are typed.**
   `SCHEDULE_BUDGET_ENFORCEMENT.enforced` is typed `false`, so arming it is a reviewable
   type-level act rather than a config edit at 2am — the same mechanism as
   `FAN_OUT_DISPATCH.allowed`. `ops.schedule_fire.refusal_code` and the `skipped` state carry the
   outcome; `question_message_id` carries the question it raises (`ops.message.kind='question'`,
   ADR-023 — there is no `ops.question` table and this ADR does not add one).

7. **Projected spend is typed `null`.** `ScheduleCostProjection.estimatedUsd: null`, exactly as
   `TurnCost.estimatedUsd` is and for the same reason: zero runs have completed, so there is
   nothing to average, and a money figure that a schedule multiplies by every future occurrence is
   the worst possible place for a plausible number. The **count** of fires in a window is real and
   is printed; the money is absent and says why (`estimateBasis: 'no-completed-runs'`). The day
   real runs exist, a number here **stops the file compiling**, and the diff that widens the type
   is the diff that has to say where the figure came from.

## Consequences

**Easy.** Six trigger types in one object with one fire ledger and one UI. Catch-up, jitter,
timezone intent and the escalation ladder become columns rather than features. A `calendar` widget
reads one table (ADR-028 already named `calendar` and capped the vocabulary — M18 writes no second
widget ADR). Scheduling composes with addressing for free, because it reuses the grammar.

**Hard, and unpaid.** Nothing computes an occurrence. There is no clock process, no cron parser,
no next-ten preview, no natural-language input, no wake-on-LAN. `0011_` has never met a Postgres —
`0005`–`0008` have not either. **This ADR lands a schema and a set of refusals; it fires nothing,
and no row it describes has ever existed.**

**The `until:` asymmetry, stated because it will look like an omission.** `Plan §14` detail 8 says
*"every schedule carries `until:` and a review date."* `until_at` is **nullable** and `review_at`
is `NOT NULL`. A review date can be derived by any writer at write time; an expiry cannot be
invented for an agent whose frontmatter never declared one, and a `NOT NULL` the only writer
cannot satisfy is M15's ledger defect — four constraints the writer never named, which would have
failed to record a run *after* the model was paid for. The quarterly sweep `Plan §14` asks for
therefore flags `until_at IS NULL` as well as stale reviews; the honesty is moved from the
constraint to the sweep rather than dropped.

**The cost of ruling 4, in one sentence, because it is the sharpest thing in this slice.**
`AgentFrontmatter.schedule` is `z.string().refine(isCronExpression).optional()` — a bare 5-field
cron carrying no timezone, no intent and no policy. **So no `source: library` row can be
materialized today at all**, and that is the correct outcome rather than a bug: the alternative is
four invented policy values on every agent in the library, presented as the author's choices.
`SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` is typed `false` and a test asserts the frontmatter
schema still lacks the keys, so the day `agent-library-curator` widens `schedule:` the assertion
goes red and points at this paragraph. Filed to them as a `decision-request`; not decided here,
because `frontmatter-schema.md` is theirs.

**To reverse.** Dropping two tables and one contracts module is cheap while no clock exists. What
does not reverse cheaply is ruling 5: once a `@@` schedule row can be stored, something will store
one.

## Contract edits

- **New:** `comms/contracts/scheduling.md`, owner `scheduler-engineer`. Normative for both tables,
  the six trigger types, the two mandatory policies, the addressing restriction and the two typed
  refusals.
- **`comms/contracts/api-contracts.md` (`runner-engineer`'s — requested, not edited by me).** The
  `POST /api/schedule` section describes ofelia sync, `ofeliaSynced`, and `ofelia_sync_failed`
  (502). Under this ADR the git-commit half stays (a frontmatter `schedule:` is still committed);
  the ofelia half is wrong. Three proposed error codes are listed in `scheduling.md` §8 for
  `runner-engineer` to accept or rename, per the `thread-model.md` §11 precedent.
- **`comms/contracts/frontmatter-schema.md` (`agent-library-curator`'s — requested).** `schedule:`
  must gain the mandatory intent before any `source: library` row can exist. Filed.
- **`skilltree-clone-spec.md` §3.2 — amended, not edited.** The spec's ofelia sentence is
  superseded by this ADR under ADR-012's standing rule. The file itself is not rewritten.
