---
agent: scheduler-engineer
milestone: M18
spec: Plan §14 (details 1–6) · comms/contracts/scheduling.md §6, §6.1, §6.2, §6.3, §12
created: 2026-08-19T20:48
status: ready-for-review
---

# M18 wave 1 — occurrence computation and the coordinator's tick, as pure functions

**Written late, and the reason is on the record rather than implied.** The code landed at
`3f810b8` on 2026-08-19; the agent that wrote it was terminated mid-slice by an API session
limit before it wrote this file or its status line. Under this repo's definition of done that
made the slice **unreviewed**, not done. Nothing was re-run to produce this handoff except the
gates quoted under *Verification*, on a tree that is still except for one file another agent
holds (`comms/contracts/panel-schema.md`).

**Nothing fires.** There is no tick loop, no timer, no process and no database. `planTick`
returns a list of intentions and nothing in this repo consumes one. No fire row has ever
existed and no run has ever run.

## What exists now

| Path | What it is |
|---|---|
| `apps/runner/src/lib/scheduleClock.ts` | occurrence computation in a declared zone, the ten-fire-time preview, and the preview receipt |
| `apps/runner/src/lib/schedulePlan.ts` | `planTick` — the coordinator's tick as a pure function; jitter; both mandatory policies |
| `apps/runner/src/lib/__tests__/schedule-clock.test.ts` | 312 lines, including the UTC agreement pin against `nextRunAt` |
| `apps/runner/src/lib/__tests__/schedule-plan.test.ts` | 564 lines, including the restart proof |
| `apps/runner/src/db/__tests__/schedule-schema-pinning.test.ts` | extended: `SCHEDULE_FIRE_ROW_CHECKS` ↔ `0011`, both directions |
| `comms/contracts/scheduling.md` §6.1–6.3, §12 | the prose half, rewritten from *proposed* to *built* for the parts that are built |

### `planTick` is a pure function, and that is an argument rather than a style

`now` is an argument. The fire rows already written are an argument. The result is a list of
actions somebody else executes. **No clock, no connection, no network, no side effect.**

`Plan §14` detail 2 calls a double-fire on coordinator restart *"the single most common
scheduler bug in existence"*. The only proof that a restart does not double-fire is to run the
same tick twice against the ledger the first one produced and watch the second plan **nothing**.
With a timer and a pool inside, that test needs a sleeping laptop and a live Postgres, so it
would have been written after the first live run — which is to say, after the bug. As a function
it needs neither, which is why the proof exists tonight:
`schedule-plan.test.ts` → *"a second tick over the same window plans nothing — the restart proof"*.

**What that proof does not prove, stated because §9.2 exists for this.** The restart test runs
against a `Map` keyed `(schedule_id, occurrence_time)`, which is agreement by construction.
`schedule_fire_idempotent` is a UNIQUE constraint that has never enforced anything, because
`0011` has never met a live Postgres. The function's half is proved; the database's half is
asserted as text in a migration.

### The order the decisions are taken in

```
record → expiry/disabled → missed-run policy → overlap → budget → concurrency cap → start
```

- **Recording is unconditional and first** (detail 1). Every due occurrence gets a `pending` row
  before any policy is consulted, so a schedule that is refused every night reads as nine hundred
  visible skips rather than as silence. `pending → missed` is the state that *only exists because
  the row is written first*: under fire-then-record, a coordinator that died between deciding and
  starting leaves nothing at all to look at.
- **Budget sits before the concurrency cap.** A refused fire must not consume a start slot — with
  the cap first, a project over its cap quietly starves the projects that are under theirs. The
  cheap-looking order is the one that turns one project's overspend into everyone's outage.
- **In-flight is tracked as the plan is built, not read once before it.** Two catch-ups planned
  in one tick are two runs and the second must see the first; reading in-flight once means six
  catch-ups all start "because nothing is running", under a policy whose entire purpose is to
  forbid the second.

### `scheduleClock.ts` exists because `nextRunAt` is UTC-only

`nextRunAt` in `apps/runner/src/lib/cron.ts` reads `getUTCHours()` and **has no `tz` parameter at
all**. That was correct for what it served: ofelia ran on one host in one zone, and the map's
clock badge only had to agree with ofelia. Under ADR-024 the coordinator fires for N projects
across N zones and detail 6 makes the zone a *declared* per-schedule intent — so a 07:00
`Asia/Riyadh` briefing computed in UTC fires at 10:00 local, every day, **looking correct in
every view**. That is the quietly-wrong class the preview requirement exists to catch, and no
preview catches it if the preview is computed by the same UTC function.

**The field parser is shared, not forked.** `scheduleClock` imports `parseCron`; two cron parsers
disagreeing about `0 6 1 * 1` (the day-of-month/day-of-week OR) is a defect shape this repo
already has. `schedule-clock.test.ts` pins the two to **identical instants at `tz: 'UTC'`**, so
they cannot drift apart while both exist. `nextRunAt` is not removed — it still feeds the
ofelia-era route and the badge, and it is still wrong by the offset for any other zone.

### The two days a year that are not 24 hours long

Decided, not absorbed, and both counted in the preview — a preview quietly one short is the same
failure as an expression quietly wrong.

- **Spring forward.** 02:30 does not exist on the day the clock jumps, so **there is no
  occurrence**. Shifting to 03:00 invents a time the author did not write.
- **Fall back.** 01:30 happens twice and **only the earlier instant counts.** This one is
  load-bearing for detail 2: two instants are two `occurrence_time` values, therefore **two
  different idempotency keys**, and `schedule_fire_idempotent` would not catch the second. The
  duplicate is prevented in `instantsForWallClock` or it is not prevented at all.

`instantsForWallClock` returns a **list** — zero, one or two entries — because a function
returning a single `Date` would have to invent one on the days there is no answer and pick
silently on the days there are two. Its first version was wrong in a way worth recording: a pure
fixed-point iteration converges immediately on a fall-back day and finds only the first instant,
because the offset read at 01:30 is still the summer one and the answer is already
self-consistent. The second instant is never probed and the ambiguity is invisible. Offsets are
now sampled a day either side and every candidate must render **back** to the wall clock asked
for.

### An unresolvable firing zone produces no rows at all

`follow_me: true` with nothing supplying a current zone comes back in `TickPlan.unresolvable` —
**no occurrences, no `record`, no `skip`, nothing in the ledger.** An occurrence nobody can place
in time is not an occurrence. Recording one against `tz` would write the exact fallback
`SCHEDULE_FOLLOW_ME` exists to refuse, with the extra harm that `occurrence_time` is the
idempotency key, so **every key would move the day the zone finally resolved**. It is a
per-schedule fault for detail 7's ladder, not a nightly stream of identical skipped fires.

### Two findings that came out of writing it

1. **`tz` is narrower than `Intl` accepts, deliberately.** Observed on this host, Node 22:
   `new Intl.DateTimeFormat('en-US', { timeZone: 'AST' }).resolvedOptions().timeZone` returns
   `'America/Anchorage'`, and `'EST'` returns `'America/Panama'` — **no error**. `AST` is what a
   person in Riyadh writes for Arabia Standard Time and what a person in Halifax writes for
   Atlantic Standard Time; ICU hands back Alaska. A 07:00 briefing then fires at 19:00 local
   forever and looks correct in every view — the quietly-wrong class arriving one layer *below*
   the preview, where the preview would cheerfully confirm it. So `formatterFor` requires IANA
   `Area/Location`, or exactly `UTC`. `schedule_tz_present` in `0011` only checks
   `length(tz) > 0`; the real narrowing is in code, and it is tested.
2. **Jitter is derived from the idempotency key, never from `Math.random()`.** FNV-1a over
   `schedule_id|occurrence_time`, modulo `jitter + 1`. A random offset makes a restart re-derive a
   *different* start time for the same occurrence, so one fire has two answers to "when did this
   begin"; every duplicate-suppression window that reasons about elapsed time then reasons about
   a moving target and the ledger stops being reproducible from its own inputs.

## How to use it

```ts
import { previewFireTimes } from './lib/scheduleClock';
import { planTick } from './lib/schedulePlan';

// Never save an unpreviewed expression — this is the half that makes a guessed cron safe.
const preview = previewFireTimes({
  trigger: { kind: 'cron', expression: '0 7 * * 1-5' },
  zone: { tz: 'Asia/Riyadh', followMe: false },
  from: new Date(),
});
// → { expression, tz, fireTimes: [{ utc, local } × 10], nonexistentLocalTimes,
//     ambiguousLocalTimes, complete, previewToken }

const plan = planTick({
  now, since, schedules, knownFires,
  latenessToleranceSeconds,   // no default
  maxStartsPerTick,           // no default
  maxOccurrencesPerSchedule,  // no default
});
// → { actions: [...], startsPlanned, unresolvable, incomplete }
```

Every parameter above with "no default" has none on purpose. One second of lateness tolerance is
a lost briefing and thirty minutes is a run started long after the meeting it was for; there is
no value that is safe for both, so a caller that never considered the question cannot be made to
look like one that did.

## Contracts touched

`comms/contracts/scheduling.md` — mine, extended: §6.1 (the ten fire times and `previewToken`),
§6.2 (the two DST days), §6.3 (the `AST` finding), §12 and §12.1–12.5 (the tick, the order, both
policies, jitter, the zone refusal, and system jobs). §11.5 is **narrowed and still open**:
`assertTriggerIsComputable` *refuses* `chain` rather than answering for it, because a chained
occurrence is produced by an upstream outcome and never by a clock — refusing keeps the question
genuinely undecided instead of decided by accident at a call site.

No other agent's contract was edited. ADR-024 is unchanged and still `proposed`.

## Deliberately not done

**All four of wave 2 is absent, and this is the list.** Nothing here is a discovery; each was
scoped out so the computation could be proved without a surface arguing with it.

1. **The routes.** All six of §13 — `preview`, create, list, `PATCH`, the fire ledger read and
   the out-of-band fire. `POST /api/p/:project/schedule` today is still the ofelia-era handler
   that writes frontmatter and pokes a sidecar `e4e0bff` removed. §11.2 and §11.7 are open with
   `runner-engineer`, who owns `api-contracts.md`.
2. **The schedule editor, the save dialog, the "next up" strip.** No surface exists to create a
   schedule, and therefore **`previewFireTimes` has no caller**. The preview is built and
   unreached; the rule it enforces (*never save an unpreviewed cron expression*) has nothing to
   enforce against yet, because there is no save.
3. **The natural-language half of the preview.** *"every weekday at seven"* → `0 7 * * 1-5` is a
   model call and belongs to the save dialog. A phrase-matching approximation here would fail by
   producing a **confidently wrong expression**, which is the exact failure the ten fire times
   exist to catch, so it was refused rather than half-built.
4. **No writer for either table.** `assertFireTransition` and `assertFireRowValid` have no live
   caller. §3.3's seventeen mandatory columns and §4.2's CHECK mirror are graded against a
   *declared* writer contract, not against code that inserts. This is the M15 shape read from the
   dangerous side and it is why it is named here rather than assumed away.
5. **No tick loop and no process.** `planTick` has no caller. Where the clock runs is an open
   question from `infra-compose-engineer`
   (`comms/inbox/scheduler-engineer/20260818-2359-…-where-does-your-clock-run.md`), answered in
   wave 2, not here.
6. **`follow_me: true` cannot fire, at all.** Nothing in this repo reports which zone a person is
   standing in. `resolveFiringZone` refuses rather than falling back to `tz`, so **half of detail
   6 is structurally empty**. §11.6, unrostered owner.
7. **The budget refusal is statically unreachable.** `fireBudgetVerdict`'s armed arm is written
   and driven by a test literal; every live call site types it `ScheduleBudgetEnforcement`, whose
   `enforced` is `false`, so TypeScript narrows the union and the refusal cannot be reached. All
   three numbers it needs (`capUsd`, `committedUsdThisMonth`, `projectedUsdThisFire`) have **no
   source in this repo** — rule 9, and this is the worst surface in the product for a plausible
   number, because a schedule multiplies one by every future occurrence.
8. **Interval anchors are required and nobody supplies one.** `ComputableTrigger` for `interval`
   takes an `anchor` with **no default and never `now`** — an anchor of "whenever the coordinator
   happened to start" makes every occurrence move on every restart, and a key that moves is not a
   key. It is stored in `trigger_spec`; no writer exists to store it.
9. **`event`, `condition`, `chain` and `manual` produce nothing.** Four of the six trigger types
   have no clockable occurrence. Event subscription through the MCP allowlist door (§3.2) is
   declared in the contract and unbuilt.

## Verification

Observed **2026-08-19T20:48 +03:00**, on a tree carrying only this file and
`comms/contracts/panel-schema.md` (another agent's, untouched here).

- `npm run verify` — **exit 0**.
- `npm run test:runner` — `tests 346 · pass 343 · fail 0 · skipped 3`. The three skips are the
  live-Postgres tests, which skip on an unset `DATABASE_URL`; they have never run.
- Nothing user-visible was produced by this slice, so there is no screenshot and no 1440px frame.

**The falsification record for the tests quoted above is what the commit claims and it is not
re-derivable from a green run.** Anyone re-checking should plant the defect and watch the named
test go red: delete the `known.has(fireKey(...))` guard in `planTick` phase 2 and the restart
proof fails; return `instants[instants.length - 1]` instead of `instants[0]` in `scanCron` and
the fall-back test fails; drop the `tz` argument through to `nextRunAt` and the UTC agreement pin
fails.

## Next agent

`scheduler-engineer` (me), wave 2 — the routes, the editor, the save dialog and the "next up"
strip, in that order, because §6.1 forbids saving an expression nobody previewed and the preview
has no caller until the save route exists.

Read first: `comms/contracts/scheduling.md` §6.1, §12 and §13, then
`comms/inbox/scheduler-engineer/20260818-2359-infra-compose-engineer-the-sidecar-is-gone-where-does-your-clock-run.md`,
which asks the one question wave 2 cannot avoid answering: which process hosts the tick.
