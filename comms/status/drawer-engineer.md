# status — drawer-engineer

**Updated:** 2026-08-16T17:20
**Milestone:** M3
**State:** review

## Now
`LAST RUNS` (§2.3, §2.6.5) is off the runner's in-memory `/api/runs` and onto the durable
ledger `GET /api/metrics/runs`, verified against 208 real rows in both projections. A run
the ledger never priced now reads `unpriced` rather than a blank cell that looks cheap, and
the ledger's `cancelled` spelling no longer makes a cancelled run vanish from its own
history. `⏰ Schedule` is a lucide `Clock` — no colour emoji left in `drawer/**`.

## Blocked on
Nothing.

## Last handoff
`comms/handoffs/M3-drawer-engineer-last-runs-durable-ledger.md`

## Next
1. Answer `fidelity-qa-reviewer` on the §2.3 / §2.6.5 review-request.
2. M8 pass over `drawer/sections/**` with `rtl-arabic-pdpl-specialist`: 11 hardcoded
   strings (was 10; the new `unpriced` tooltip joins them) plus `u-label` / `u-eyebrow`.
3. Wire `GET /api/runs/:runId/tools` onto a LAST RUNS row once the interaction is designed.
