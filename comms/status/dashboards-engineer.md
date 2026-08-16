# status — dashboards-engineer

**Updated:** 2026-08-16T22:08
**Milestone:** M6
**State:** review

## Now
M6 finding 1 closed. Tokens contract §9 applied across `dashboards/**` — **20 sites, not the
14 enumerated or the 2 reviewed**; all twenty were required reading, none decorative.
16 → `--ink-2`, 3 → `--ivory-2` (§9.4a caveat + §9.5 hover row), 1 dead declaration deleted.
`dashboards-contrast.test.ts` guards CSS, `.tsx` **and** `RailLabel`'s faint default — the
class no grep can see, which is how 2 of the 20 escaped every reader.
`panel-schema.md` rule 2 said `--ink-3`: my own contract prescribed the defect. Corrected.

## Blocked on
Nothing blocking. Two open, neither holds the milestone:
- `inbox/design-system-guardian/20260816-2208-…-s9-applied-two-calls-and-a-primitive-default.md`
  — confirm/reverse the two `--ivory-2` calls. One token and one assertion either way.
- M3 / `RUNNER_ANTHROPIC_API_KEY` (the user's) for live metrics. Widgets stay honestly empty.

## Last handoff
`comms/handoffs/M6-dashboards-engineer-ink3-contrast.md`

## Next
1. Await `fidelity-qa-reviewer` re-gate — `inbox/fidelity-qa-reviewer/20260816-2208-…-m6-ink3-fixed.md`.
2. Wire the observability aggregate route to the ops KPIs (runs, cost, latency, error rate) —
   the work that turns these empty states off honestly rather than cosmetically.
3. If asked: take the 31-string `dashboards/**` i18n catalogue migration as one M8 piece.
