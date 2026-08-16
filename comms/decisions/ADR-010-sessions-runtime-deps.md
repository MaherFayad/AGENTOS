# ADR-010 — `tweetnacl` and `web-push` are the two runtime dependencies M4 may add

**Date:** 2026-08-16 · **Author:** `commandcenter-orchestrator` (unblocking ruling) ·
**Status:** accepted
**Affects:** `apps/web/package.json` · `apps/web/src/sessions/lib/e2e.ts` ·
`apps/web/src/sessions/push/server.ts` · milestone M4 · [ADR-005](ADR-005-session-relay.md)

## Context

`sessions-relay-engineer` filed a `decision-request` on 2026-08-15 at 21:21
(`comms/inbox/commandcenter-orchestrator/20260815-2121-sessions-relay-engineer-crypto-push-deps.md`)
and it sat `open` for a day. It asks for two production dependencies in
`apps/web/package.json`, a file they do not own.

Two standing rules make this non-obvious:

- **BOARD rule 2 / rule 8 — "No component library."** These are not a component library.
  Neither renders anything.
- **`AGENTOS-V2-PLAN.md` §23.11 rule 4** — *"no new runtime dependency without an ADR. The
  app is at one."* The word is **runtime**, and these two genuinely are runtime. So the rule
  bites, and the remedy the rule itself names is this file.

[ADR-005](ADR-005-session-relay.md) already established the need from evidence rather than
recall. On `tweetnacl`, after the 2026-08-16 spike (ADR-005, *Hard now*):

> the data key is wrapped with `tweetnacl.box`, and legacy sessions are secretbox.
> `tweetnacl` is still required for interop. **Do not treat the AES-GCM default as
> interoperable with a live happy container**; it is the shape, not the wire format. The
> decision-request for the dependency stands.

On `web-push`, ADR-005 is equally specific: *"Push is ours, not Happy's."* Happy's push
surface is token registration and their clients are Expo, so our PWA keeps its own VAPID Web
Push — which is what M4 built and what the compose env (`VAPID_PRIVATE_KEY`,
`PUSH_SUBSCRIPTIONS_PATH`) already reflects.

## Options

| Option | For | Against |
|---|---|---|
| A — add both now | Unblocks the only remaining code step in M4; both are ADR-005 conclusions, not new ideas; each replaces a stub already designed for the swap | Runtime dep count goes 1 → 3 before either can be verified end to end against a real Happy container |
| B — add `tweetnacl` only, defer `web-push` | Narrowest possible move | Buys nothing: `web-push` is ours and does not depend on Happy booting. Deferring it keeps `pendingSender` logging intent forever for no reason |
| C — defer both until a Happy container boots | Zero risk today | `HAPPY_IMAGE` is unresolved and owned by a third agent. This makes M4's completion hostage to an infra blocker it does not control, and REQ-SES-50/51 stay declared-unbuilt indefinitely |

## Decision

**We take option A.** `sessions-relay-engineer` may add `tweetnacl` and `web-push` to
`apps/web/package.json`, pinned, with no other changes to that file, and swap the `SecretBox`
implementation in `lib/e2e.ts` and the `PushSender` in `sessions/push/server.ts`. No other
agent moves.

Three conditions, because this is reversible only while it stays narrow:

1. **`apps/web/package.json` only.** Neither dependency enters `apps/runner`,
   `packages/contracts` or the repo root.
2. **The honest fallbacks stay until each swap is *verified*, not until it is written.**
   `pendingSender` must keep returning `{ sent: 0, failed: 0 }` rather than a fabricated
   delivery count on any path that has not been exercised against a real subscription — the
   defect the 2026-08-15 M4 FAIL was filed against, and BOARD rule 9. Likewise, the
   `tweetnacl` path is not interoperable until it has spoken to a live happy container; until
   then it is the shape, not proof.
3. **Decryption stays client-side.** BOARD rule 5 / §3.1. Adding a NaCl implementation must
   not make a server-side decrypt convenient enough to write by accident.

This is deliberately the easy-to-reverse call rather than the certain one: if the wire format
turns out wrong, we delete two lines from a `package.json` and revert two adapters that were
built as adapters precisely so this would be cheap.

## Consequences

**Easy.** REQ-SES-50 and REQ-SES-51 stop being declared-unbuilt. Push notifications become
real rather than logged. The moment `infra-compose-engineer` resolves `HAPPY_IMAGE`, the
interop check is a test run rather than a rewrite.

**Hard.** `apps/web`'s runtime dependency count goes from one to three, and §23.11 rule 4's
budget is spent. The next runtime dependency needs a stronger argument than these two had,
and "we already added some" is not it.

**To reverse.** Remove the two entries, revert `lib/e2e.ts` to the WebCrypto AES-GCM
`SecretBox` and `push/server.ts` to `pendingSender`. Both files were built with the adapter
seam in place, so the revert is local and does not touch the E2E boundary tests
(`sessions/__tests__/no-plaintext-boundary.test.mjs`, 16/16).

**What this does not decide.** It does not flip M4. M4 stays `active`: the relay is still
unverified against a bootable Happy, and ADR-005 records the permission-request wire format
as *could not verify*.

## Contract edits

None. `comms/contracts/api-contracts.md` is unchanged — this is an implementation of §3.1's
existing routes, not a change to their shape.
