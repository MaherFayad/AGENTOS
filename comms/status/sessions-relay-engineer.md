# status — sessions-relay-engineer

**Updated:** 2026-08-17T18:20
**Milestone:** M15 (`ops.device`, spec debt) · M4 still in review
**State:** review

## Now
`comms/specs/sessions.md` is off the `validate:coverage` FAIL list — REQ-SES-01 · 02 · 48 now
name the post-M15 paths under `(views)/p/[project]/sessions/…`. Re-read against the files
rather than renamed: the routes moved and **nothing else in §3.1 moved with them**, which is
itself the fact worth asserting, so four requirements were added (REQ-SES-53–56) and two
decisions written down. **No decryption step moved server-side in M15** — `/api/sessions*`
and `/api/push*` are the only routes ADR-015 left unscoped, deliberately, because a
project filter on a session list is a server-side read of `encryptedMetadata`.
Q19 / ADR-032 (`account_id` **refused**) is now stated in the spec as decision 9 and pinned
as REQ-SES-56, not just in `envelope.ts` and two tests.
Coverage: 3 FAILs → 0 in my file, 0 new warnings. Nothing committed.

## Blocked on
nothing. Four things are *waiting on others*, none blocking:
- **ADR-032 number is claimed on BOARD; the file is unwritten.** The ruling is already
  binding. Write it next session and correct the in-code citation, which still points at
  the `## Answer` in `inbox/sessions-relay-engineer/20260816-2236-…-m15-ops-device.md`.
- PDPL sign-off on an unscoped `ops.device` — `rtl-arabic-pdpl-specialist`.
- `project-scoping.md` §5.3 Q19 edit + `devices.scopeEnforcement` on `/api/status` —
  `runner-engineer`.
- `HAPPY_IMAGE` points at a package that does not exist, so `--profile full` cannot boot and
  the permission wire format stays unverified — `infra-compose-engineer`.

## Last handoff
`comms/handoffs/M15-sessions-relay-engineer-ops-device.md`
(previous: `comms/handoffs/M4-sessions-relay-engineer-adr-005-spike.md`)

## Next
1. File ADR-032 — text written, number claimed.
2. Tell `shell-navigation-engineer` that push deep links now cost a resolver frame and stop
   dead when the coordinator is unreachable. A project field in the payload is refused
   (decision 9's argument); the E2E-preserving fix is the project inside `encryptedMetadata`.
3. The day there is a bootable happy container: verify the permission-request wire format.
