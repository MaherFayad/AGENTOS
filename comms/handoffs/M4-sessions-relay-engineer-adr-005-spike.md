---
agent: sessions-relay-engineer
milestone: M4
spec: §3.1 · §3.6 · Part V (billing split) · AGENTOS-V2-PLAN §4 Phase 4, §12, §16, §20 P7
created: 2026-08-16T21:05
status: accepted
---

# M4 — ADR-005 spike: Happy vs Omnara, decided on evidence

## What exists now

- `comms/decisions/ADR-005-session-relay.md` — rewritten. Same decision (self-hosted
  Happy), re-derived from sources read on 2026-08-16 rather than recall. New sections:
  *What would have to be true to revisit this* and *What this spike could not verify*.
- `comms/BOARD.md` — the `M4` open question is ticked with its one-line outcome, in the
  same shape as ADR-001/002/003.
- `comms/inbox/infra-compose-engineer/20260816-2105-sessions-relay-engineer-happy-image-does-not-exist.md`
  — decision-request: the compose default image is unpullable.
- `comms/inbox/_all/20260816-2105-sessions-relay-engineer-adr-005-decided.md` — broadcast,
  including the forward-looking constraint for `client-platform-engineer`'s future scope.

**No code changed.** M4 is in `review` with `fidelity-qa-reviewer` and this task was
scoped as a decision document. No spike container was built.

## How to use it

Read the ADR's *Consequences* before touching the relay. The three that bind other people:

1. `HAPPY_IMAGE` in `infra/compose.yaml` defaults to `ghcr.io/slopus/happy-server:latest`,
   which **does not exist as a public package**. The supported path is the official npm
   package `happy-server-self-host` (MIT, 1.1.11) or a build from `packages/happy-server`
   in the `slopus/happy` monorepo. Not my file — message filed.
2. Upstream leaves **`tags` in plaintext**. Part Two §12's addressing (`@agent`,
   `#department`, `@@department`) must never ride in a Happy tag — department and agent
   names are human-written business vocabulary. Addressing belongs in `ops.thread` in our
   own Postgres.
3. These env vars must stay unset, each for a data-egress reason:
   `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`, `ELEVENLABS_API_KEY`,
   `REVENUECAT_API_KEY`, the five `GITHUB_*` vars. Do not vendor `packages/happy-app`.

## Contracts touched

`comms/contracts/api-contracts.md` — read, **not changed**. The §3.1 route table and the
E2E clause already say what this ADR resolves. Two edits are requested by message rather
than made: the compose image default (`infra-compose-engineer`), and Caddy ordering of
`/api/sessions*` + `/api/push*` before `/api/*` → `runner` (carried forward).

## Deliberately not done

- **No M4 code change**, though the spike produced two candidates for one. The AES-GCM /
  `tweetnacl` interop note in `lib/e2e.ts` is now better-informed (upstream has *two*
  cipher variants — legacy secretbox and a newer AES-256-GCM DataKey wrapped with
  `tweetnacl.box`), and `envelope.ts`'s allowlist is confirmed to already exclude the
  plaintext `tags` field. Both are recorded as ADR consequences. Editing files under
  active review would make the gate meaningless.
- **No compose edit.** `infra/compose.yaml` is `infra-compose-engineer`'s file. I found the
  bug, I did not fix it.
- **No spike container.** I did not boot `happy-server-self-host` to confirm it runs in
  Docker, or to confirm the permission-request wire format. Both are listed under *could
  not verify* with the second flagged as the first thing to check the day it boots.
- **No source audit.** All upstream evidence is documentation and package manifests, not a
  read of `packages/happy-server/sources`. Our own boundary tests are the defence against
  a server that documents blindness and implements otherwise.
- **PDPL sign-off not sought.** Nothing here leaves the tailnet — the decision *reduces*
  egress surface by naming the vars that would create it. If anyone sets one,
  `rtl-arabic-pdpl-specialist` signs off first.

## Verification

Registry facts were tested, not assumed — anonymous pull-token request against ghcr.io,
with `ghcr.io/langfuse/langfuse` as a positive control to prove the method:

```
slopus/happy-server  -> NO TOKEN (denied)      docker.io/slopus/happy-server -> 404
slopus/happy         -> NO TOKEN (denied)      docker.io/slopus/happy        -> 404
omnara-ai/omnara-api -> manifest HTTP 200
langfuse/langfuse    -> manifest HTTP 200      (control)
```

GitHub API: `slopus/happy-server` `archived: true`, `pushed_at 2026-02-14`, `license: null`,
no LICENSE file. `slopus/happy` `archived: false`, `pushed_at 2026-08-10`, MIT, 23.4k stars,
974 open issues. `omnara-ai/omnara` `archived: false`, `pushed_at 2026-08-15`, Apache-2.0.
npm: `happy-server-self-host@1.1.11` MIT (2026-06-10), `happy@1.2.0` MIT,
`@slopus/happy-wire@0.1.0` MIT (2026-02-13, untouched since).

Docs read in full: `docs/encryption.md`, `protocol.md`, `backend-architecture.md`,
`user-identity.md`, `deployment.md`, `cli-architecture.md`, `api.md`, `session-protocol.md`,
`product-analytics.md`, `permission-resolution.md`; `packages/happy-server/package.json`,
`packages/happy-server-self-host/README.md`, `packages/happy-wire/README.md`,
`packages/happy-cli/README.md`; Omnara `README.md`, `SECURITY.md`, `compose.yaml`,
`docs.omnara.com/llms.txt`.

No test suite was run — no code changed.

## Next agent

`infra-compose-engineer` first: read the ADR's *hard operational fact* table, then the
message in your inbox. The `happy` service cannot come up until `HAPPY_IMAGE` points at
something real, and `--profile full` staying parked is correct until then.

Then whoever owns `M21` in Part Two: read the ADR's *Consequences → P7* and *could not
verify → Windows daemon support* before estimating. Happy already ships the daemon that
§4 Phase 4 calls "the missing piece", including remote `spawn-session` — but its own docs
warn against macOS launchd and say nothing at all about Windows.
