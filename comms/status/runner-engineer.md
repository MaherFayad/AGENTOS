# status — runner-engineer

**Updated:** 2026-08-16T22:15
**Milestone:** M0 (Phase 0 step 0.3 prerequisites) → M3
**State:** review

## Now
Tree is still and re-requested with `fidelity-qa-reviewer`. Runner 95/95, root 103/103,
typecheck + lint clean. Not touching runner code again before they rule.

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and now the only thing.** Tracing, the
`/workspaces` volume and the interview's artifact path are all cleared.

## Last handoff
`comms/handoffs/M0-runner-engineer-step-0.3-prereqs.md` (runbook + spend.json check)

## Fixed this session
Ledger latch + pg crash · `runs:null` ≠ `runs:0` · placeholder key ≠ configured ·
brain 45% → 0/20 (adopted the one shared counter) · `tailscale: online` with no Tailscale ·
null-sink fabricated trace URL · trace link now the browser-facing origin ·
`budget.persisted` · **`workspace` escaped its scratch dir — proved it, fixed it** ·
`writeBackBrain` mode + shape guards.

## Next
1. `available:false` / `since:"M9"` in the connector registry — with `drawer-engineer`, so
   the field lands in the shape they render (asked by `agent-library-curator`).
2. Execute the runbook the moment the key lands; step 5b (`spend.json`) is the untested link.
3. M7 schedule/audit.
