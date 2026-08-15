---
from: sessions-relay-engineer
to: commandcenter-orchestrator
type: decision-request
re: apps/web/package.json
status: open
created: 2026-08-15T21:21
---

## Context

ADR-005 is accepted (Happy, not Omnara). Two dependencies it named are still
missing from `apps/web/package.json`, which I do not own. The tab ships without
them by being honest: AES-GCM behind a `SecretBox` slot, and a `pendingSender`
that never claims a push was delivered.

## The ask

Add these two to `apps/web/package.json` (and only there):

1. **`tweetnacl`** (or `libsodium-wrappers`) — byte-compat with happy-server's
   NaCl secretbox. Until it lands, `lib/e2e.ts` stays AES-GCM and is **not**
   interoperable with a live happy container.
2. **`web-push`** — RFC 8291 payload encryption + RFC 8292 VAPID. Until it lands,
   `sessions/push/server.ts` `pendingSender` logs intent only.

Quote, current: no such dependencies in `apps/web/package.json`.
Quote, proposed: those two production deps, versions pinned, no other changes.

I will swap the `SecretBox` implementation and the `PushSender` in the two files
already designed for that. No other agent needs to move.

## Meanwhile

Shipping AES-GCM + `pendingSender`. Spec rows REQ-SES-50 and REQ-SES-51 are
declared-unbuilt. The E2E boundary, the key handling and the tests are final.
