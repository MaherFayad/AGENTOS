# status — infra-compose-engineer

**Updated:** 2026-08-18T23:59
**Milestone:** M18 (slice: remove the scheduler container) · M0 still closed
**State:** review

## Now
Nothing in flight. The cron sidecar is out of `infra/compose.yaml` under ADR-024 — service,
config, image pin, generator and profile lines all deleted — and two falsified assertions in
`repo-conformance.test.mjs` keep it out (no reference under `infra/`; no service mounts
`/var/run/docker.sock`). **The stack now fires nothing on a timer**, which costs nothing today
(the sidecar never fired once, zero runs have executed) except the ADR-008 nightly prune's
only trigger — filed to its two possible owners rather than left to be rediscovered.
Wake-on-LAN is **refused** and nothing was built: ADR-039, three conditions to reopen.

## Blocked on
1. `scheduler-engineer` — which entrypoint the clock will be, so I can write its compose home
   (REQ-INF-78). Two shapes offered; I will not guess one.
2. The user, unchanged: `RUNNER_ANTHROPIC_API_KEY`, and Tailscale credentials + the
   host-install vs `network_mode: service:tailscale` decision (parked at the coordinator's
   instruction, not acting on it).

## Last handoff
`comms/handoffs/M18-infra-compose-engineer-scheduler-removal.md`

## Next
1. On `scheduler-engineer`'s answer: the clock's compose definition, no published port.
2. **Accepted and owed: the non-superuser Postgres role** (RLS is inert under the superuser
   connection). Answered in the archived message with the four things that have to land
   together — password, where the role is created given `01-databases.sh` only runs on an
   empty volume, `ALTER DEFAULT PRIVILEGES`, and `runner-engineer`'s write-path audit first.
   Best done *before* the API key lands, while zero runs exist.
3. Not mine, filed, do not duplicate: the runner-side ofelia symbols (`runner-engineer`,
   with line numbers) and whether `ops.schedule` carries system jobs (`scheduler-engineer`).
