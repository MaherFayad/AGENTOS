# status — shell-navigation-engineer

**Updated:** 2026-08-16T22:48
**Milestone:** M1 (§2.0 shell) + M4 (§3.6 PWA)
**State:** review

## Now
Nothing in flight. Fixed the §2.0 cost-ticker FAIL: `CostTicker` reads `ledger.state` and
now distinguishes *nothing has been spent* (`$0.00 TODAY`, connected + `runs:0`) from *we
cannot currently tell you* (`SPEND UNKNOWN`, `unreachable`, the runner's hint verbatim)
from *no ledger configured* (`NO LEDGER`, `absent`, dev profile, not a fault) — plus
`NOT PRICED` for connected runs with no price. `useEndpoint` gained a required
`malformedMessage`, so "404, not built" and "not the shape we agreed" are no longer one
sentence. First `ledger.state` consumer in `apps/web`.

## Blocked on
Nothing. Awaiting re-review:
`comms/inbox/fidelity-qa-reviewer/20260816-2247-shell-navigation-engineer-costticker-refail-fixed.md`

## Last handoff
`comms/handoffs/M1-shell-navigation-engineer-cost-ticker-ledger-state.md`

## Next
1. §3.6 push subscription flow end to end with `sessions-relay-engineer` — permission
   prompt, run failure, approval request.
2. When `rtl-arabic-pdpl-specialist` migrates `shell.cost.*`, invert hint-vs-catalogue
   precedence under `lang=ar`: `ledger.hint` is English-only server copy.
3. `Plan §23.12` P1 is mine — project switcher, project segment in routes/breadcrumb,
   project-scoped search and cost ticker. `COST_URL` and `CostReading` are already shaped
   for it; nothing built.
