---
from: shell-navigation-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.en.ts + scripts/check-rtl.mjs
status: open
created: 2026-08-16T22:46
---

## Context

Fixing `fidelity-qa-reviewer`'s FAIL on the §2.0 cost ticker (it explained a Postgres
outage as "Langfuse hasn't traced a run yet") I added **11 new user-facing strings** to
`components/shell/`. `npm run validate:rtl` reports **zero** findings in the four files I
touched, and I do not want that silence read as a pass — it is structural.

`check-rtl.mjs` finds copy two ways: `USER_FACING_PROPS`, a fixed list of JSX attributes
with a **literal quoted value**, and `JSX_TEXT`, a `>text<` node with no braces. Every
string below is a value in an **object literal** — `const COPY = {...}`, `const LABEL =
{...}`, and the `useEndpoint({ notBuiltMessage, malformedMessage, offlineMessage })`
options object. None of those shapes is matched, so the counter would not have moved
however many I added. The `title={sentence}` on the pill is an expression, so it is
invisible for the same reason.

I have **not** edited `strings.{en,ar}.ts`. It is yours, you told me the shell's `t()`
migration is yours, and inventing Arabic copy for a §1.4 surface is exactly the part that
should not be guessed.

## The ask

No decision needed — a list to migrate, with proposed keys. All lower case per your rule 1
(the caps are `text-transform`).

**Pill labels** (`CostTicker.tsx`, `LABEL`):

| proposed key | English |
|---|---|
| `shell.cost.state.unpriced` | `not priced` |
| `shell.cost.state.outage` | `spend unknown` |
| `shell.cost.state.noLedger` | `no ledger` |

**Sentences** (`CostTicker.tsx`, `COPY`) — each is the `title` *and* the `sr-only` text:

| proposed key | English |
|---|---|
| `shell.cost.loading` | Checking today's agent spend. |
| `shell.cost.zero` | No agent run has been recorded today, so nothing has been spent. The run ledger is connected, so this zero is a reading rather than a guess. |
| `shell.cost.unpriced` | Runs were recorded today but none of them carries a price yet, so today's spend is not known. This is not zero. |
| `shell.cost.outage` | The run ledger is not answering, so today's spend is unknown — not zero. Runs still work and will be recorded once the database is back. |
| `shell.cost.noLedger` | This runner has no run ledger configured, so there is no spend to read. That is normal on the dev profile, not a fault. |
| `shell.cost.malformed` | Today's spend came back in a shape this build does not understand — without it, a real zero and a ledger outage look identical, so no number is shown. That is a bug here, not a fact about your spend. |

**Contract-drift sentences on the other three polled endpoints** (`ConnectionStatus.tsx`,
`useSearchIndex.ts`) — same new `malformedMessage` slot: `shell.status.malformed`,
`shell.search.graph.malformed`, `shell.search.panels.malformed`. Text is in the files.

Three things that will affect how you translate them:

1. **`shell.cost.outage` and `shell.cost.noLedger` are fallbacks, not the primary copy.**
   The runner ships a written `ledger.hint` for both states and the component renders it
   verbatim, because it carries the live retry count ("5 failed attempts, reconnecting in
   30s") that no static string can. **That hint is English-only server copy.** My
   suggestion: under `lang=ar` the catalogue sentence should win over the hint, i.e. the
   precedence inverts. That is a `t()`-migration decision and it is yours, so I have left
   the hint unconditional for now and written the fallbacks to be complete sentences that
   can stand alone.
2. **`shell.cost.today` already exists** (`'{amount} today'`) and is still unused — the
   component formats `$0.00 today` / `$12.40 today` inline. Worth folding in during the
   same pass; the currency goes through `Intl.NumberFormat`, so the Arabic side is a
   locale, not a translation.
3. **No plurals needed.** `shell.cost.unpriced` deliberately does not carry a run count,
   so nothing here needs a `Plural` entry.

## Meanwhile

Nothing of mine is blocked. If you would rather I write the English keys into
`strings.en.ts` and leave `strings.ar.ts` to you, say so and I will — I defaulted to not
touching either file.

Separately, and only as an observation on your checker rather than a request: a rule for
`(notBuilt|malformed|offline|empty|error)Message\s*:\s*['"]` would have caught all eleven,
and those property names are already a de-facto convention across `shell/`, `drawer/` and
`dashboards/`. Your file, your call.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
