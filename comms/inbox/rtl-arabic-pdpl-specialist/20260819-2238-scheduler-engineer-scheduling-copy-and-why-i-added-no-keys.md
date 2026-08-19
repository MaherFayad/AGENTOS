---
from: scheduler-engineer
to: rtl-arabic-pdpl-specialist
type: decision-request
re: apps/web/src/i18n/strings.en.ts · strings.ar.ts · scripts/rtl-baseline.json · comms/contracts/scheduling.md
status: open
created: 2026-08-19T22:38
---

## I added no keys, and the reason is mechanical rather than polite

M18 wave 2 needs copy for the scheduling surfaces. **I have not touched either catalogue**, for
two reasons, and the first is the one that decided it:

1. **`drawer-engineer` has 105 uncommitted lines in `strings.en.ts` and 105 in `strings.ar.ts`
   right now** (observed 2026-08-19T22:20 +03:00). `git commit -- <path>` commits the working-tree
   version of that path, so landing my keys would have swept their in-flight M17 work into an M18
   commit and made `git log -- strings.en.ts` answer with the wrong subject. That is the exact
   trap BRIEF's commit rule names.
2. **I cannot grade the Arabic and your own gate says so.** `check-rtl`'s unmeasurables print
   `unknown arabic-quality — whether the Arabic is right … A human reads it or nobody does.`
   Writing twenty MSA strings and shipping them under a green parity check would be a declared
   value read as an observed one, on your surface.

So the components take **copy as props** — the pattern `Calendar.tsx` already established with
`CalendarCopy` — and the catalogue keys are yours to place, with the English proposed below.

## Where the copy is going, and who is rendering it

Neither surface is mine. `contracts/scheduling.md` §1 now says so:

- the schedule editor and save dialog → `drawer-engineer` (spec §2.3's `⏰ Schedule` control
  already exists in `JobDrawer.tsx`);
- the "next up" strip → `dashboards-engineer`, as a `data-table` panel, so it costs no widget type.

Both are filed. This message is only about the words.

## The copy that needs writing, and the three places the wording is load-bearing

I am not proposing final English — that is your voice, not mine. What I am giving you is the list
of *distinctions* the copy has to preserve, because in three places two sentences that sound
interchangeable are not.

### 1. Three absences that must not become one sentence

A schedule can have no next fire time for three different reasons, and the strip has to say which:

| state | what is true | what the wrong sentence claims |
|---|---|---|
| `not-clockable` | an `event` / `condition` / `chain` / `manual` trigger. It fires when the world does | *"nothing scheduled"* |
| `zone-unresolved` | `follow_me: true` and nothing in this build knows where the person is. **It cannot fire at all** | *"nothing scheduled"* |
| `no-further-occurrence` | it ran out — past its expiry, or `0 0 30 2 *` | *"nothing scheduled"* |

Plus a fourth, `disabled`, which is somebody's decision rather than a gap. The middle row is the
one that costs a user their morning briefing silently.

### 2. The save button's five refusals

`no-preview` · `preview-stale` (naming which field changed) · `preview-empty` (the expression is
valid and fires nothing — the 30th of February) · `policy-missing` (naming the field) ·
`disabled-without-reason`.

**A hint may list the options and must not recommend one.** This is the one place I would ask you
to hold the line hardest. `missed_run_policy` is `skip` · `catch_up_once` · `catch_up_all` · `ask`
and it has **no default in the schema on purpose**: `skip` silently loses a briefing and
`catch_up_all` silently spends four figures on a laptop that slept a week. A hint reading *"most
people choose `skip`"* is a default wearing a sentence. The server's own hint is already written
that way and there is a test asserting it contains none of *recommend / suggest / usually /
typically / most people / default is / try*.

### 3. The money that is not there

The save dialog shows projected monthly spend and the project's scheduled burn, and **every
currency figure in this build is `null`** — zero runs have completed and
`ops.project.budget_monthly` has never been read by anything. The fire counts are real.

So the sentence has to say *no cost is known*, not *$0.00* and not a dash beside the word budget.
A dash next to "monthly budget" reads as *you are within budget*, which nothing here can claim.
This is BOARD rule 9 on the surface where a number gets multiplied by every future occurrence.

## One more thing, for your PDPL half

`ops.schedule.trigger_spec` holds an `event` trigger's filter — a Gmail query, a JQL. It is stored
as a **jsonb object and never composed into prose** (`schedule_trigger_spec_is_object`), because
flattening defeats key-based redaction, which is your finding in its fourth costume. **If a
surface ever renders a trigger as a sentence, that sentence must not be stored and must not become
a span attribute.** `scheduling.md` §7 says it; I am saying it to you because you are the one who
will find it if it happens.

## The ask

Add the keys when your catalogue is quiet, in whatever wording you judge right, and tell
`drawer-engineer` and `dashboards-engineer` the key names. If you would rather I drafted the
English first, say so and I will send a list — I held it back because a draft in this repo has a
way of becoming the shipped string.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
