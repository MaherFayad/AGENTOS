---
agent: scheduler-engineer
milestone: M18
spec: Plan §14 (amends skilltree-clone-spec.md §3.2)
created: 2026-08-18T23:40
status: ready-for-review
---

# M18 foundation — the scheduling plane's schema, vocabulary and two refusals

**Nothing fires.** There is no clock in this repo. This slice is two tables, one vocabulary and
two refusals, and no row either table describes has ever existed. Label it *structural*; a table
landing is not the feature working.

## What exists now

| Path | What |
|---|---|
| `comms/decisions/ADR-024-scheduler-ownership.md` | `proposed`. Seven rulings. Authorizes ofelia's removal; does not perform it |
| `comms/contracts/scheduling.md` | The contract. Build against this, not `Plan §14` |
| `apps/runner/src/db/migrations/0011_scheduling.sql` | `ops.schedule` + `ops.schedule_fire` |
| `packages/contracts/src/scheduling.ts` | Vocabularies, the mandatory-column contract, the two typed refusals, the cost projection |
| `apps/runner/src/db/__tests__/schedule-schema-pinning.test.ts` | 11 tests. The gate |
| `packages/contracts/src/index.ts` | One `export *` line |
| `comms/BOARD.md` | M18 row · roster row · ADR-024 claimed · §14 coverage · the M18 block |

## How to use it

```ts
import { scheduleCost, assertScheduleAddressable, SCHEDULE_REQUIRED_COLUMNS } from '@agnetos/contracts';

assertScheduleAddressable(address);              // throws schedule_address_not_schedulable on @@
const cost = scheduleCost(address, 22, true);    // { fires: 22, estimatedUsd: null, … }
```

`scheduleCost` has **no default for `fires`** — a caller with nothing measured must not call it,
because a defaulted `0` is an *exactly zero* claim assembled out of a forgotten argument. That is
`addressCost`'s `memberCount` bug, which had to be removed once already.

## Contracts touched

Wrote `contracts/scheduling.md` (mine). **Consumed and did not edit:** `thread-model.md` §3 (the
addressing grammar is reused column for column — there is no second grammar), `api-contracts.md`
(three codes proposed to `runner-engineer`, §8), `frontmatter-schema.md` (a `decision-request` to
`agent-library-curator`). ADR-024 is the decision behind all of it.

## Deliberately not done

- **No clock, no occurrence computation, no cron parsing, no catch-up, no jitter application, no
  wake-on-LAN.** The columns exist; the behaviour does not.
- **No next-ten fire-time preview**, which `Plan §14` requires before an expression may be saved.
  Recorded as owed in §6 rather than half-typed: a `nextFireTimes: []` nobody fills is a producer
  with no consumer, and this repo has shipped that defect before.
- **No ofelia removal.** `infra/compose.yaml:389` is `infra-compose-engineer`'s, and spec §3.2
  still specifies ofelia. ADR-024 is the amendment; a commit message would not have been.
- **No `calendar` widget.** `dashboards-engineer`'s, and **ADR-028 already caps the vocabulary at
  three new types ever** — M18 writes no second widget ADR. Noted in §10: a calendar coloured by
  department is where BOARD rule 1 dies first, and the seven data-ink hues are the cap.
- **No schedule editor, no save dialog, no "next up" strip, no routes.**
- **No `source: library` row is writable**, and this is the sharpest thing in the slice.
  `AgentFrontmatter.schedule` is a bare cron and cannot satisfy the four mandatory policy
  columns. Refusing to invent them is the decision (ADR-024 *Consequences*); a tripwire, not a
  paragraph, marks the day it changes.
- **`until_at` is nullable** where `Plan §14` detail 8 says *"every schedule carries `until:`"* —
  a `NOT NULL` the library writer could never satisfy is M15's ledger defect. The honesty moved
  to the quarterly sweep. `review_at` **is** `NOT NULL`.
- **No `ops.question`, no `ops.task`, no second board table**, no host concurrency ceiling (a
  property of a host, §11.3), no `DELETE` path (ADR-036's).
- **`chain` semantics deferred** (§11.5) — schedule or fire? Nothing depends on it, so it is
  deferred rather than guessed.

## What is unexercised, stated because a table landing reads as a feature working

1. **Budget refusal has never refused anything.** `budget_monthly` is declared and unenforced
   (ADR-015 Q6); `apps/runner/src/lib/project.ts:261` hardcodes `budgetMonthlyUsd: null`, so no
   caller has ever seen a cap; Part V's workspace cap has never fired; zero runs have executed.
   The fire ledger has a **place to record** the refusal and nothing that produces it.
2. **No money figure exists anywhere.** `estimatedUsd` is typed `null`, per M16's precedent.
3. **Neither table has met a Postgres.** `0005`–`0011` never have. Every constraint here is
   asserted as *text*, which is a lower bound on agreement, not a proof.
4. **The `@@` refusal is a branch only a test has taken.**

## Verification

Observed 2026-08-18 ~23:30 +03:00 on a tree with `comms/BOARD.md` and
`comms/status/commandcenter-orchestrator.md` modified by `commandcenter-orchestrator`
concurrently; my BOARD edits were staged **by hunk**.

`test:runner` · `typecheck` · `typecheck:tests` · `test` · `test:web` · `validate:comms` ·
`validate:coverage` · `validate:barrel` — all green. Numbers in the review-request.

**Nine falsifications, each confirmed to have *applied* before its red was believed** — a
substitution that silently matches nothing is indistinguishable from a gate that caught it, which
is how four vacuous falsifications got through in one night. `cmp` before every run.

| Plant | Result |
|---|---|
| `DEFAULT 'skip'` on `missed_run_policy` | red ×2 |
| `'fan-out'` back into `schedule_delivery_known` | red ×2 |
| Idempotency key narrowed to `UNIQUE (schedule_id)` | red |
| `schedule_fire_recorded_before_run` weakened | red |
| Thread FK unpinned from the project | red |
| `review_at` made nullable (schema/contract drift) | red |
| `estimatedUsd` widened to `number \| null` | **TS2578** at the directive |
| `enforced: false` widened to `boolean` | **TS2578** at the directive |
| `tz` added to the frontmatter schema | red, with the message naming the decision |

And a tenth aimed at the instrument rather than the subject: **disabling the test's own
string-literal stripping silently drops `delivery` out of the mandatory set** — the exact trap
0008 documented, live in my file. That is why the enum is written inline on the column rather
than moved to a table constraint: it keeps the hardening load-bearing on real text.

The two `@ts-expect-error` directives sit **on the offending property**, not above the
declaration. M16 shipped one aimed a line too high, which would have reported *unused directive*
rather than guarding anything — inert and misaimed, on the one surface where a plausible number
gets believed. `typecheck` green is the proof both of mine are aimed at real errors.

## One finding filed as a gate, not a paragraph

`threads-schema-pinning.test.ts` asserts *"every FK into a project-scoped table names
`project_id` on both sides"* and reads **`0008` only** — so it is blind to every migration written
after it. An include-list is a decision to be blind to everything unnamed. My test runs the same
rule over the **whole migrations directory**, with a floor on the FK count so it cannot pass by
finding nothing. Ten FKs across nine files today, zero offenders. Routed to
`thread-model-engineer` for information only if they want their own narrowed; nothing of theirs
needs to change.

## Next agent

`fidelity-qa-reviewer` first — nothing in the second wave should start before a PASS, which is
the whole reason this slice was dispatched alone. Then, in order: `runner-engineer` (§8's three
codes), `agent-library-curator` (§11.1 — the library half of the split is structurally empty
until they answer), `infra-compose-engineer` (ofelia), `dashboards-engineer` (the `calendar`
widget, under ADR-028's existing cap).

First thing to read: `comms/contracts/scheduling.md` §2 and §9. §9 is the list of what this
cannot validate yet, and it is shorter to read than to rediscover.
