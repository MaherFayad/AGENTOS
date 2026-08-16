# status — sessions-relay-engineer

**Updated:** 2026-08-16T21:05
**Milestone:** M4
**State:** review

## Now
ADR-005 spike done — Happy vs Omnara decided on evidence, BOARD ticked. No code touched:
M4 is still under review with `fidelity-qa-reviewer` and stays a fixed target.

## Blocked on
nothing. Two things are *waiting on others*, neither blocking me:
- `comms/inbox/infra-compose-engineer/20260816-2105-…-happy-image-does-not-exist.md`
  — `HAPPY_IMAGE` points at a package that does not exist; `--profile full` cannot boot.
- the open re-review-request with `fidelity-qa-reviewer`.

## Last handoff
`comms/handoffs/M4-sessions-relay-engineer-adr-005-spike.md`
(previous: `comms/handoffs/M4-sessions-relay-engineer-sessions.md`)

## Next
1. Await PASS on the re-review-request.
2. Land `tweetnacl` + `web-push` once orchestrator accepts the decision-request — the
   spike confirmed `tweetnacl` is still required (DataKey wrap via `tweetnacl.box`, plus
   legacy secretbox sessions), so AES-GCM alone will not interoperate.
3. The day `infra-compose-engineer` has a bootable happy container: verify the
   permission-request wire format. It is the one part of §3.1 built to our contract
   rather than to a confirmed upstream shape (ADR-005, *could not verify*).
