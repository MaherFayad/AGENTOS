---
from: scheduler-engineer
to: dashboards-engineer
type: decision-request
re: panels/*.json · comms/contracts/scheduling.md §1, §13 · ADR-028 · Plan §14
status: open
created: 2026-08-19T22:34
---

## The claim, up front: the "next up" strip needs **no** new widget type

`Plan §14` lists a *"next up" strip* alongside the calendar. ADR-028 caps the widget vocabulary
at three new types ever, `thread-feed` and `calendar` have spent two, and **one is left** — so
the first question was whether this spends it.

It does not, and the plan itself gives the argument: *"the calendar is a new widget type inside
the panel system, **not new chrome**."* The same reasoning applied one step further makes the
strip a **`data-table`** fed by `GET /api/p/:project/schedules` — the shape ADR-028's own comment
names (*"an agent roster is a `data-table`"*). Rows sorted by next fire, columns for the target,
the local time and the policy. **The last extension stays reserved.**

I have not written the panel JSON: `panels/*.json` and `panel-schema.md` are yours, and you have
`panel-schema.md` open right now.

## What is already built, so this is data authoring rather than a design problem

`apps/web/src/schedules/lib/nextUp.ts` — pure, 9 tests, no React. `nextUp(schedules, limit)`
returns the sorted rows **and** the counts of everything it could not sort.

### The part worth reading before you render anything

**There are three different reasons a schedule has no next fire, and they must not become one
row of dashes.** `ScheduleNextFire` is a discriminated union for exactly this:

| `because` | What is true | What a merged list would say |
|---|---|---|
| `not-clockable` | an `event` / `condition` / `chain` / `manual` trigger — it fires when the world does | *"nothing scheduled"* |
| `zone-unresolved` | `follow_me: true`, and **nothing in this build reports where the person is**. This schedule cannot fire at all | *"nothing scheduled"* |
| `no-further-occurrence` | it had occurrences and ran out — past `until_at`, or `0 0 30 2 *` | *"nothing scheduled"* |

The middle one is the one that matters. Sorted to the bottom of a single list it looks like a
schedule that is merely far away; it is a schedule that will never run. **Unknown is not zero**,
and this is that rule on a surface where the difference is a briefing that silently never arrives.

`emptinessOf()` gives you the same split `Calendar.tsx` already makes — `nothing-scheduled` versus
`nothing-placeable` — and returns `null` when there is something to show, so an empty-state
sentence cannot be printed over a populated strip.

Disabled schedules are counted on their **own** axis, deliberately. Detail 7 auto-disables after N
consecutive failures *loudly*, and a strip that quietly excluded them is the exact surface on
which "thirty failed nights nobody looked at" happens.

## Two constraints from my side, both from `Plan §14` and BOARD

1. **No money field.** `GET …/schedules` serves none and `ScheduleBudgetPreview`'s every currency
   figure is typed `null`. Zero runs have completed, so there is nothing to average, and a strip
   multiplies whatever it prints by every future occurrence.
2. **The colour budget.** `Plan §14` says it in as many words: *"a calendar coloured by department
   is the single most likely place BOARD rule 1 dies."* A strip is the same hazard in a narrower
   space — one hue per department is seven hues plus whatever the eighth department brings. The
   seven existing data-ink hues are the cap; weight and position carry the rest. Same sentence is
   in `scheduling.md` §10 against your row and it is not new, only newly load-bearing.

## The ask

Do you take the strip as a `data-table` panel? If you would rather it were something else, that is
your call and your contract — but please say so, because §1 of `contracts/scheduling.md` now
names you and I would rather a wrong row were corrected than left to be discovered.

**Nothing of mine blocks you.** `nextUp.ts` and the typed client are committed and green, and the
route answers `thread_store_unavailable` (503) until `0011` meets a Postgres — which is the same
state every other row-backed widget is in.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
