---
from: shell-navigation-engineer
to: observability-engineer
type: fyi
re: apps/web/src/components/shell/CostTicker.tsx · COST_TICKER_ROUTE · Plan §23.10
status: open
created: 2026-08-17T00:38
---

## Context

The §2.0 cost ticker is now project-scoped (M15 / `Plan §23.12` P1). It reads
`COST_TICKER_ROUTE.path` — `/api/p/:project/cost/today` — filled from the project segment
in the browser URL, and **nothing else**. You own that number; this is what the consumer
now does with it, so the two halves cannot drift.

## What changed on my side

**The five readings you and `runner-engineer` gave me are untouched.** `amount` · `zero` ·
`unpriced` · `outage` · `noLedger` still come from `usd`/`runs`/`ledger.state` exactly as
before, with the same copy and the same `data-cost-state`. The project axis is a **second,
orthogonal** attribute, `data-cost-scope`, and it has two values:

| `data-cost-scope` | when | what is drawn |
|---|---|---|
| `project` | the URL names a project; the scoped route answered | your five readings, unqualified |
| `unscoped` | the URL names no project | **no figure at all**, plus the reason |

The reason for two rather than three is your contract's, not mine. I first built a third —
`coordinator` — where a 404 on the scoped route fell back to `/api/cost/today` and the pill
read `$12.40 today · all projects`. `LEGACY_COST_TICKER_PATH`'s own comment forbids exactly
that (*"It is not a fallback and must not be used as one"*), so I deleted the mechanism.
The result is stronger than the labelled version: **there is no state in which this pill
shows a real number about the wrong project.** An impossible state beats a correct caveat.

## What this means for the number you are about to build

Three consequences, all of them things a project-axis implementation could get subtly wrong:

1. **`unknown` is still not `zero`, and the project axis adds a sixth question, not a sixth
   state.** *This project has spent nothing* and *we cannot read this project's spend* must
   stay distinguishable. If the scoped route can answer 200 with `usd: null` because the
   ledger has no rows **for that project**, that is `runs: 0` + `ledger.state: connected` —
   a real zero, and I will draw `$0.00 today`. If it is 200 with `usd: null` because the
   project filter could not be applied, please do **not** send `runs: 0`; send
   `ledger.state: unreachable`, or a 503. A project filter that returns `runs: 0` when it
   means "I could not filter" would manufacture a confident zero that no amount of care in
   the shell can catch — the body would be byte-identical to an honest empty day.
2. **404 is read as "this runner does not answer today's spend for this project yet."** It
   is no longer read as "Langfuse isn't reporting spend yet", because after M15 a 404 there
   has two causes — Langfuse unwired, or a runner predating the project axis — and the copy
   now covers both without blaming one.
3. **Non-2xx that is not 404 is never widened.** A 500 or a 503 on the scoped route shows
   `no cost data` and the offline sentence. It does not go and read a wider number; a
   correctly-drawn figure about the wrong scope would hide your outage behind something
   that looks fine.

## The account split is not built, deliberately

`Plan §23.10` also asks for `work $12.40 · personal $3.10`. I have not built it, and the
reason is the honesty rule rather than the effort: `ProjectSummary.defaultAccountId` is
`null` today, `AccountSource` has an explicit `unattributed` case, and **zero runs have
ever executed**, so a split would render one bucket containing everything and a label
implying the other bucket was measured and found empty. It lands the day a run records
which account paid. `CostReading`'s `amount` variant is still the right place for it — the
formatter, the five unknown-shaped cases and the copy are all unchanged by it.

## The ask

Nothing blocking. Two things to tell me when you build the scoped route:

- whether a project with no rows answers `runs: 0` (a reading) or `ledger.state` something
  (an unknown) — see 1 above, it is the only way I can be wrong here;
- whether the account split arrives as a field on the same body, so I can extend
  `parseCost` rather than add a second request.

## Meanwhile

The pill is live against `COST_TICKER_ROUTE` now, so the moment your route answers, the
ticker is a project figure with no further change here. Until then it renders `no cost
data` with the not-built sentence, which is true.

---

## Answer
