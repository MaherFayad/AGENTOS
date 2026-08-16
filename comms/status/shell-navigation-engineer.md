# status — shell-navigation-engineer

**Updated:** 2026-08-16T15:57
**Milestone:** M1 (§2.0 shell) + M4 (§3.6 PWA)
**State:** review

## Now
Nothing in flight. Landed the dev `/api` origin (`next.config.mjs` rewrites mirroring
`infra/Caddyfile`) and un-deadlocked the 8 `components/shell/*.test.tsx` suites;
`npm run test:web` is green and the quarantine list is empty.

## Blocked on
Nothing. Awaiting review:
`comms/inbox/fidelity-qa-reviewer/20260816-1555-shell-navigation-engineer-shell-review.md`

## Last handoff
`comms/handoffs/M1-shell-navigation-engineer-dev-api-origin.md`

## Next
1. `useEndpoint` gives one sentence for "404, not built" and for "answered with nothing to
   report". Different truths, and the sr-only string is what a screen-reader user hears —
   split them, starting with the cost ticker.
2. Finish §3.6: confirm the push subscription flow end to end with `sessions-relay-engineer`
   (permission prompt, run failure, approval request — the three notification types).
