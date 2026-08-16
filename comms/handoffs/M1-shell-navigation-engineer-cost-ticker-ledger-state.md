---
agent: shell-navigation-engineer
milestone: M1
spec: §2.0 (cost ticker, connection status), §3.5 (consumer side), Part VII.3 / BOARD rule 9
created: 2026-08-16T22:45
status: ready-for-review
---

# The cost ticker stops explaining an outage as an empty state

`fidelity-qa-reviewer`'s FAIL of 2026-08-16T22:30, and `runner-engineer`'s demonstration
of it at 22:10. With Postgres stopped, `GET /api/cost/today` answers **200** with
`{usd:null, runs:null, ledger:{state:"unreachable"}}`. `parseCost` read only `usd`,
`useEndpoint` mapped the resulting `null` to `notBuiltMessage`, and the shell said, in the
`title` and in the `sr-only` text:

> "Langfuse isn't reporting spend yet, so there is no number to show here. This fills in
> the first time an agent run is traced."

Every clause of that is false during an outage, and the sentence is worse than a wrong
number for the reason the reviewer gave: a wrong number invites doubt, a fluent
explanation closes the question. **`CostTicker.tsx` is now the first consumer anywhere in
`apps/web` that reads `ledger.state`.**

---

## What each of the three states now says

The runner's `ledger.state` decides which. Visible label first, then the sentence carried
by both `title` and `sr-only`; the pill also carries `data-cost-state` so the state can be
asserted without matching copy.

| state | body | `data-cost-state` | pill | sentence |
|---|---|---|---|---|
| `connected` | `usd` numeric | `amount` | `$12.40 TODAY` | "Agent spend so far today: $12.40." |
| `connected` | `usd:null, runs:0` | `zero` | `$0.00 TODAY` | "No agent run has been recorded today, so nothing has been spent. The run ledger is connected, so this zero is a reading rather than a guess." |
| `connected` | `usd:null, runs>0` | `unpriced` | `NOT PRICED` | "Runs were recorded today but none of them carries a price yet, so today's spend is not known. This is not zero." |
| `unreachable` | `usd:null, runs:null` | `outage` | `SPEND UNKNOWN` | `ledger.hint`, verbatim — "The run ledger is not answering (5 failed attempts, reconnecting in 30s). This is not \"no runs yet\" — the number you are looking for is unknown, not zero. Runs still work and will be recorded once the database is back." |
| `absent` | `usd:null, runs:null` | `noLedger` | `NO LEDGER` | `ledger.hint`, verbatim — "This runner has no run ledger configured (no DATABASE_URL), so there is no history to read. That is normal on the dev profile. Start the stack with --profile obs if you expected runs here. Runs still work; they are just not recorded." |

Three further readings that are not ledger states, kept apart because they were previously
one string:

| cause | pill | sentence |
|---|---|---|
| `404`/`501` — route not built | `NO COST DATA` | the old not-built sentence, now **only** here |
| 2xx the parser refuses, incl. `usd:null` with no readable `ledger` | `NO COST DATA` | "…a real zero and a ledger outage look identical, so no number is shown. That is a bug here, not a fact about your spend." |
| fetch threw | `NO COST DATA` | "Couldn't reach Langfuse for today's spend. This box may be off the tailnet." |

Four decisions inside that table worth naming:

1. **`$0.00 today` is drawn only for `connected` + `runs: 0`.** That is the honest state of
   this system today — no run has ever executed — and a real zero is information. It is
   never a stand-in for a number we lack.
2. **`absent` does not shout.** `depends_on: postgres: {required:false}` makes `--profile
   dev` a legitimate configuration, so the copy says "normal on the dev profile", carries
   no retry count, and reuses none of the outage wording. The test asserts the outage
   vocabulary is absent from this state.
3. **`unpriced` is a fourth case I added.** `connected` with runs but no prices is neither
   a number nor a zero, and under the old code it got the not-built sentence — the same
   defect, one branch away. `runs` is the field that separates it from a real zero, exactly
   as `runner-engineer`'s table said.
4. **The visible label carries the distinction, not just the tooltip.** A phone has no
   hover, so `title` reaches nobody on touch and `sr-only` reaches screen readers only. Had
   all five stayed `NO COST DATA`, the fix would have moved the false story somewhere
   quieter rather than removed it.

## Is any other shell surface reading a 200-with-null endpoint?

**One has the shape; none has the consequence.** Checked, not assumed:

- **`/api/status` → `ConnectionStatus`.** 200 in every state and it does carry nullable
  fields. But the two the shell reads are not ledger-backed: `tailscale` is a string
  observed from the process's own interfaces, and `queueDepth` comes from the in-memory run
  store. A `null` `queueDepth` is *omitted*, never drawn as `0`. `budget.spentUsd` and
  `brain` also ride this payload; the shell reads neither.
- **`/api/graph`, `/api/panels` → `useSearchIndex`, and the `N OF 22 LIVE` counter.** Both
  are served from disk — the precomputed layout and `panels/*.json`. Neither touches
  Postgres, so neither changes shape during a ledger outage. `liveCount` comes from
  `scripts/lib/layout.mjs:263` (frontmatter `status: live`), which is a separate question
  about what "live" means and belongs to `map-galaxy-engineer`; it is not this defect.
- **Outside the shell:** `grep -rn "ledger" apps/web/src` still returns nothing but
  comments, test fixtures and prose in `dashboards/` and `drawer/`. The reviewer's scoping
  holds — those two 503 and render written failure sentences.

## What exists now

- `apps/web/src/components/shell/CostTicker.tsx` — `CostReading`, a five-case discriminated
  union; `parseCost` reads `usd`, `runs` **and** `ledger.state`; `LABEL`/`COPY` const maps;
  `data-cost-state` on the pill.
- `apps/web/src/components/shell/useEndpoint.ts` — `malformedMessage` added and
  **required**. A `null` from `parse` no longer borrows `notBuiltMessage`. Made required
  rather than optional-with-a-default precisely so a default could not quietly reinstate
  the conflation; the four call sites each had to answer the question.
- `apps/web/src/components/shell/ConnectionStatus.tsx` — `malformedMessage`, plus
  `tailscaleHint` rendered in place of our one-liner (`runner-engineer`'s smaller ask 1).
  `UNKNOWN` on its own reads as "broken", and inside a container it is the correct answer.
- `apps/web/src/components/shell/useSearchIndex.ts` — `malformedMessage` on both endpoints.
- `apps/web/src/components/shell/CostTicker.test.tsx` — 10 tests. The three ledger bodies
  are **captured from the running stack**, not written by hand, with the capture time in a
  comment.
- `apps/web/src/components/shell/ConnectionStatus.test.tsx` — 2 tests added.

## How to use it

```ts
// Any polled endpoint in the shell:
useEndpoint<T>(url, { intervalMs, parse, notBuiltMessage, malformedMessage, offlineMessage });
```

`parse` returns `null` **only** for "this is not the body we agreed". If the endpoint
answered a legitimate *"I do not know"*, model it in `T` — that is what `CostReading`'s
`outage` and `noLedger` cases are, and it is why they can each carry their own sentence.

## Contracts touched

`comms/contracts/api-contracts.md` → *"Ledger reachability — `unknown` is not `zero`"*, and
`LedgerState` from `packages/contracts`, both **consumed, not edited**. No ADR: reading a
field a contract already publishes is compliance, not a decision.

## Deliberately not done

1. **No i18n catalogue keys, and this one needs saying out loud.** I added **11** new
   user-facing strings, and `check-rtl.mjs` reported **zero** findings in the four files I
   touched. That silence is structural, not a pass: the checker matches JSX text nodes and
   a fixed list of JSX attributes with literal quoted values, and every string I added is a
   value in an object literal (`COPY`, `LABEL`, the `useEndpoint` options object). It cannot
   see them, so the violation counter did not move and would not have moved however many I
   added. Filed to the owner with the proposed keys:
   `comms/inbox/rtl-arabic-pdpl-specialist/20260816-2246-shell-navigation-engineer-cost-ticker-strings-invisible-to-check-rtl.md`.
   I did not edit `strings.{en,ar}.ts` myself: it is their file, they said the shell's `t()`
   migration is theirs, and inventing Arabic copy for a §1.4 surface is the part of this
   that should not be guessed.
2. **`ledger.hint` is English server copy.** It is rendered verbatim because it is written
   for a phone and carries the retry count, which no static string can. Under `lang=ar` the
   catalogue sentence should win over the hint; the two fallbacks I wrote are already the
   right shape for that and are in the message above.
3. **`LastRuns.tsx:78` attributes a ledger outage to the runner** (`runner-engineer`'s
   smaller ask 2). Honest but imprecise, and it is `drawer-engineer`'s file. Forwarded with
   the evidence rather than edited:
   `comms/inbox/drawer-engineer/20260816-2246-shell-navigation-engineer-lastruns-attributes-ledger-outage-to-runner.md`.
4. **Dashboards' `resolve.ts:54` says the same thing about the runner.** Same reasoning,
   `dashboards-engineer`'s file, and they are mid-FAIL on §9 — I am not adding a second
   front to that.
5. **No project scope or account split** (`Plan §23.10`, M15/P1). Not built, but made
   cheaper rather than harder: the URL is a single `COST_URL` const because it becomes
   `/api/cost/today?project=…`, and the account split lands as a field on the `amount`
   variant — the formatter, the five unknown-shaped cases and the copy are unchanged by it.
   No conflict between this fix and §23.10 that I can find; the split changes what a *known*
   number looks like, and every case I added is about not having one.
6. **No visual change beyond the words.** No colour, no dimming, no icon for the outage
   state. Spend is not a status (§1.3), and an outage badge would be the easiest place in
   the shell to invent a colour. The distinction is carried by the text, which is also the
   accessible outcome.
7. **The 1440px side-by-side is still not run** — no reference frame, no headless browser
   (BOARD, *Awaiting the user*). This is a source-and-token change with live verification of
   behaviour, not a proportion check.

## Verification

Everything below I ran tonight, on the stack as it was running. **The standing acceptance
case, executed rather than quoted.**

**Token provenance (contract §8b):**
`scanned at 2026-08-16 19:40 · 56e93cf · 44 uncommitted under apps/web` · files scanned
291 · **violations 0** · 2 exemptions, both pre-existing (`Chip.tsx`, `Chip.test.tsx`).

### 1. Stop Postgres — the ledger is unreachable

```
docker compose -f infra/compose.yaml --env-file .env --profile obs stop postgres
GET /api/cost/today        -> 200 {"usd":null,"runs":null,"unpricedRuns":null,
                                   "ledger":{"state":"unreachable","attempts":5,
                                   "lastError":"getaddrinfo ENOTFOUND postgres",…}}
GET /api/metrics/runs      -> 503
GET https://localhost/api/cost/today   (through Caddy — the browser-facing origin) -> same body
```

Then the **component**, mounted in jsdom with `fetch` pointed at the live runner — a
throwaway `CostTicker.live.test.tsx`, since a network-dependent test does not belong in the
suite. Printed:

```
COST PILL   state = outage
COST TEXT   spend unknown
COST TITLE  The run ledger is not answering (7 failed attempts, reconnecting in 30s).
            This is not "no runs yet" — the number you are looking for is unknown, not
            zero. Runs still work and will be recorded once the database is back.
SR-ONLY     <the same sentence>
ZERO SHOWN? false
STATUS TEXT UNKNOWN · 0 QUEUED — "A tailnet address is configured in .env, but this process
            cannot see one on any of its own interfaces…"
```

Before this change the same render produced `no cost data` and *"This fills in the first
time an agent run is traced."*

### 2. Start Postgres — the honest zero, same runner process

```
docker compose … start postgres
docker inspect agnetos-runner-1 -> RestartCount=0, StartedAt 19:04:51   (no restart)
GET /api/cost/today -> 200 {"usd":null,"runs":0,"unpricedRuns":0,
                            "ledger":{"state":"connected","since":"…19:33:37",…}}

COST PILL   state = zero
COST TEXT   $0.00 today
COST TITLE  No agent run has been recorded today, so nothing has been spent. The run
            ledger is connected, so this zero is a reading rather than a guess.
ZERO SHOWN? true          <- correct here, and only here
```

### 3. `absent` — a runner deliberately started without a ledger

Not a fixture. A second runner on `:8788` with `DATABASE_URL` blanked, which is what
`--profile dev` is:

```
docker compose … run --rm -d --name agnetos-runner-dev -e DATABASE_URL= -e APP_DATABASE_URL= \
  -p 127.0.0.1:8788:8787 runner
GET :8788/api/cost/today -> 200 {"usd":null,"runs":null,
                                 "ledger":{"state":"absent","attempts":0,"lastError":null,…}}

COST PILL   state = noLedger
COST TEXT   no ledger
COST TITLE  This runner has no run ledger configured (no DATABASE_URL), so there is no
            history to read. That is normal on the dev profile. …
ZERO SHOWN? false
```

Container removed afterwards; `docker ps` back to the six it started with.

### 4. Gates

- `npm run typecheck` — clean, all three workspaces.
- `npm run lint` — "No ESLint warnings or errors".
- `npm run validate:tokens` — 0 violations, provenance line quoted above.
- `npm run test:web` — **418 passed / 418**, both halves (vitest + `node:test`). Shell
  alone: 9 files, 64 tests.
- `npm run validate:rtl` — still red at 75 findings, **unchanged by this work**, and zero
  of them in the four files I touched. See *Deliberately not done* 1 for why that silence
  is not a result.

## Next agent

**`fidelity-qa-reviewer`** — re-review requested. You said you would re-run the
stop-Postgres case rather than read the diff; the fastest reproduction is section 1 above,
and `data-cost-state` on the pill gives you the assertion without matching copy.

**`rtl-arabic-pdpl-specialist`** — 11 strings your checker cannot see, with proposed
`shell.cost.*` keys, in your inbox.

**`drawer-engineer`** — `LastRuns.tsx:78` names the wrong subsystem during a ledger outage.
One sentence, your file.
