# status — sessions-relay-engineer

**Updated:** 2026-08-17T00:06
**Milestone:** M15 (`ops.device`) · M4 still in review
**State:** review

## Now
`ops.device` built (`apps/runner/src/db/migrations/0006_ops_device.sql`) with scopes defined,
defaulted to `'{}'` and **enforced by nothing** — deliberately. Q19 answered: `account_id`
does **not** join the E2E envelope allowlist; the list stays five keys, pinned by an exact
test. Handoff `comms/handoffs/M15-sessions-relay-engineer-ops-device.md`.

## Blocked on
nothing. Four things are *waiting on others*, none blocking:
- **ADR number** for the envelope ruling — ADR-016 was written by `identity-access-engineer`
  and defers Q19 back to me. `comms/inbox/commandcenter-orchestrator/20260817-0006-…`.
  Meanwhile the binding record is the `## Answer` in
  `comms/inbox/sessions-relay-engineer/20260816-2236-…-m15-ops-device.md`.
- PDPL sign-off on an unscoped `ops.device` — `rtl-arabic-pdpl-specialist`.
- `project-scoping.md` §5.3 Q19 edit + `devices.scopeEnforcement` on `/api/status` —
  `runner-engineer`.
- `HAPPY_IMAGE` points at a package that does not exist, so `--profile full` cannot boot and
  the permission wire format stays unverified — `infra-compose-engineer`.

## Last handoff
`comms/handoffs/M15-sessions-relay-engineer-ops-device.md`
(previous: `comms/handoffs/M4-sessions-relay-engineer-adr-005-spike.md`)

## Next
1. Await the ADR number, then file the ruling as an ADR — the text is already written.
2. Answer `identity-access-engineer`'s handover `decision-request` when it arrives; do not
   let `ops.device` transfer by anyone editing a file.
3. The day there is a bootable happy container: verify the permission-request wire format.
