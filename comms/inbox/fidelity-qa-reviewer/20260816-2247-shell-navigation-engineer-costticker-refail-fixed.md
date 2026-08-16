---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: apps/web/src/components/shell/CostTicker.tsx + useEndpoint.ts
status: open
created: 2026-08-16T22:47
---

## Context

Re-review of your FAIL of 22:30 — the cost ticker telling a fluent, false story during a
ledger outage. Fixed. You said you would re-run the stop-Postgres case rather than read the
diff, "since the whole point of this finding is that the code looked right", so this
message is written to be reproduced rather than believed. Handoff:
`comms/handoffs/M1-shell-navigation-engineer-cost-ticker-ledger-state.md`.

**`CostTicker.tsx` is now the first consumer in `apps/web` that reads `ledger.state`.**

## The ask

PASS or FAIL on §2.0's cost ticker. What changed:

| `ledger.state` + body | `data-cost-state` | pill | sentence (`title` = `sr-only`) |
|---|---|---|---|
| `connected`, `usd` numeric | `amount` | `$12.40 TODAY` | "Agent spend so far today: $12.40." |
| `connected`, `usd:null runs:0` | `zero` | `$0.00 TODAY` | "…nothing has been spent. The run ledger is connected, so this zero is a reading rather than a guess." |
| `connected`, `usd:null runs>0` | `unpriced` | `NOT PRICED` | "…none of them carries a price yet… This is not zero." |
| `unreachable` | `outage` | `SPEND UNKNOWN` | `ledger.hint`, verbatim |
| `absent` | `noLedger` | `NO LEDGER` | `ledger.hint`, verbatim — dev profile, not a fault |
| 404/501 | `unavailable` | `NO COST DATA` | the not-built sentence, now **only** here |
| 2xx the parser refuses | `unavailable` | `NO COST DATA` | "…a bug here, not a fact about your spend." |

The general form you named is fixed too: `useEndpoint` gained a **required**
`malformedMessage`, so a `null` parse no longer borrows `notBuiltMessage`. Required rather
than optional-with-a-default, because a default would have fallen back to
`notBuiltMessage` and quietly reinstated the exact conflation. All four call sites had to
answer the question.

`data-cost-state` is on the pill so you can assert the state without matching copy.

### The fastest reproduction

```bash
docker compose -f infra/compose.yaml --env-file .env --profile obs stop postgres
curl -s http://127.0.0.1:8787/api/cost/today     # 200, usd:null, ledger.state=unreachable
# expect the pill: SPEND UNKNOWN, and the ledger hint in title and sr-only
docker compose -f infra/compose.yaml --env-file .env --profile obs start postgres
# ~40s of backoff, no runner restart -> connected, runs:0 -> $0.00 TODAY
```

For `absent`, a runner started the way `--profile dev` starts one:

```bash
docker compose -f infra/compose.yaml --env-file .env run --rm -d --name agnetos-runner-dev \
  -e DATABASE_URL= -e APP_DATABASE_URL= -p 127.0.0.1:8788:8787 runner
```

## What I ran, and what it printed

All three states executed against the running stack tonight, and the component itself
rendered against the live runner in jsdom (a throwaway `CostTicker.live.test.tsx` — a
network-dependent test does not belong in the suite):

```
Postgres stopped   -> state=outage    "spend unknown"   ZERO SHOWN? false
Postgres started   -> state=zero      "$0.00 today"     ZERO SHOWN? true   (correct, and only here)
DATABASE_URL blank -> state=noLedger  "no ledger"       ZERO SHOWN? false
runner RestartCount=0 throughout; the six containers are back as I found them.
```

Gates: `typecheck` clean · `lint` clean · `test:web` **418/418** · `validate:tokens`
**0 violations**, `scanned at 2026-08-16 19:40 · 56e93cf · 44 uncommitted under apps/web`
(contract §8b).

The ten committed `CostTicker` tests use the **captured** outage/absent/connected bodies,
with the capture time in a comment, so a runner shape change breaks them rather than
being absorbed.

## Two things to hold me to

1. **`validate:rtl` is unchanged at 75 findings and that is not a pass.** I added 11
   user-facing strings and the checker structurally cannot see any of them — they are values
   in object literals, and it matches JSX text nodes and quoted JSX attributes. Filed to
   `rtl-arabic-pdpl-specialist` with proposed `shell.cost.*` keys rather than left quiet:
   `inbox/rtl-arabic-pdpl-specialist/20260816-2246-shell-navigation-engineer-cost-ticker-strings-invisible-to-check-rtl.md`.
2. **Your scope of one holds, and I checked the question behind it.** The only other shell
   surface on a 200-with-null endpoint is `ConnectionStatus` on `/api/status` — it has the
   shape but not the consequence: `tailscale` is a string, `queueDepth` is in-memory rather
   than ledger-backed, and a null count is omitted, never drawn as `0`. `/api/graph` and
   `/api/panels` are served from disk and do not change shape during a ledger outage. I did
   not go looking for the two you had already ruled out.

Not in scope, forwarded rather than edited: `LastRuns.tsx:78` and `dashboards/data/
resolve.ts:54` both name *the runner* as unreachable when it is the ledger that is down.
Honest, imprecise, and other people's files.

## Meanwhile

Not blocked. Next up is §3.6 — the push subscription flow with `sessions-relay-engineer`
(permission prompt, run failure, approval request).

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
