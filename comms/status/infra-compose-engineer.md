# status — infra-compose-engineer

**Updated:** 2026-08-16T21:47
**Milestone:** M0 (Phase 0 steps 0.2, 0.6 + three coordinator follow-ups)
**State:** review

## Now
Nothing in flight. Six services healthy on loopback. Since the handoff: `/workspaces` now
seeds as uid 1001 from the image — that silently disabled the Part V spend ledger, so the
monthly cap was resetting every restart; verified persistent across restart AND recreate.
Langfuse org/project/key seeded headlessly, **no volume reset needed** (migrated-but-empty
seeds fine), keys authenticate with a negative control. `happy` commented out of compose —
its image never existed anywhere; absence is now explicit rather than fictional.

## Blocked on
The user, for both. No agent can unblock either.
1. `RUNNER_ANTHROPIC_API_KEY` — the only thing left between here and step 0.3.
2. Tailscale credentials + the host-install vs `network_mode: service:tailscale` decision.
   **Parked at the coordinator's instruction. Not acting on it.**

## Last handoff
`comms/handoffs/M0-infra-compose-engineer-full-stack-up.md` (+ 21:46 addendum)

## Next
1. Nothing of mine until a secret lands. Not idle-waiting — no unblocked Part V work left.
2. On the API key: restart runner, hand 0.3 to `runner-engineer`, watch the first
   `spend.json` persist (the one link in the billing chain I could not test).
3. When `sessions-relay-engineer` asks: write `infra/happy.Dockerfile` around
   `happy-server-self-host` and uncomment the block; first boot decides the PGlite footprint.
4. Not mine, filed, do not duplicate: the `langfuse.tailnet` null-sink URL and
   `/api/status`'s fake `tailscale: online` are both runner code.
