---
agent: sessions-relay-engineer
milestone: M4
spec: §3.1 (Happy relay, SESSIONS tab, client-side E2E, push seam; §3.6 PWA remains shell)
created: 2026-08-15T21:21
status: ready-for-review
---

# M4 — SESSIONS tab, Happy relay, client-side decryption

## What exists now

```
comms/decisions/ADR-005-session-relay.md          Happy, not Omnara — accepted
comms/specs/sessions.md                           §3.1 claimed (52 REQs, 3 unbuilt)
apps/web/src/app/(views)/sessions/page.tsx        mounts <SessionsTab>
apps/web/src/app/(views)/sessions/[id]/page.tsx   mounts <SessionView>
apps/web/src/sessions/components/SessionsTab.tsx  list, billing split, ?new=1, push toggle
apps/web/src/sessions/components/SessionView.tsx  full-screen transcript + docked card
apps/web/src/sessions/components/Transcript.tsx   virtualized, monospace on --screen
apps/web/src/sessions/components/PermissionCard.tsx  copper Allow / Deny
apps/web/src/sessions/components/KeyGate.tsx      recovery secret + optional relay token
apps/web/src/sessions/components/PushSettings.tsx Notify this phone + lock-screen opt-in
apps/web/src/lib/e2e.ts                           THE boundary — non-extractable key
apps/web/src/sessions/relay/envelope.ts           server allowlist (rebuild, don't filter)
apps/web/src/sessions/relay/proxy.ts              credential-free passthrough
apps/web/src/sessions/relay/happy-adapter.ts      the only Happy-shaped file
apps/web/src/app/api/sessions/**                  list / stream / input / permission
apps/web/src/app/api/push/**                      subscribe + notify
apps/web/public/sw-push.js                        push + notificationclick (not sw.js)
apps/web/src/sessions/__tests__/                  63 tests; no-plaintext-boundary is load-bearing
```

## How to use it

The tab is already the `/sessions` route. Unlock with the recovery secret from
`happy auth`. The key never leaves the browser.

```ts
import { SessionsTab, SessionView } from '@/sessions';
// already mounted:
//   /sessions      → <SessionsTab spawnRequested={query.new === '1'} />
//   /sessions/:id  → <SessionView sessionId={id} />
```

`runner-engineer` — to buzz a phone:

```
POST /api/push/notify
{ "kind": "approval" | "run-failed", "id": "run_…" }
→ 202 { "sent": n, "failed": n }
```

Pass nothing else. Titles, agent names and command lines are dropped even if you
send them.

Env the web container wants (infra owns compose): `HAPPY_RELAY_URL` or
`HAPPY_INTERNAL_URL` (defaults to `http://happy:3005`), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`PUSH_SUBSCRIPTIONS_PATH`.

## Contracts touched

- `comms/contracts/api-contracts.md` — consumed the §3.1 route table; **not edited**
  (we do not own the file). ADR-005 records the Happy choice without a contract edit.
- `comms/contracts/design-tokens.md` — consumed. Copper is data-ink + Allow/Send pills.
- `infra/Caddyfile` — already matches `/api/sessions*` `/api/push*` to `web` first.

## Deliberately not done

- **NaCl secretbox / live happy wire format.** AES-GCM behind `SecretBox` is the
  shape, not interoperability. `tweetnacl` is a decision-request; do not point a
  live happy container at this client and expect transcripts to open.
- **`web-push` RFC 8291 delivery.** `pendingSender` logs intent and never claims a
  send. Needs the dependency plus VAPID keys in compose.
- **Happy `/v1/auth` public-key challenge.** KeyGate's optional token paste is the
  stand-in until `full` profile happy is up.
- **Spawning a session from the browser.** `?new=1` tells the truth: Claude Code
  on a paired machine does that.
- **Server-side search, titles, previews.** The server cannot read them.
- **Omnara.** Rejected in ADR-005.
- **PWA install / `sw.js` / manifest / offline page.** Shell. We own `sw-push.js`.
- **Socket.IO bridge.** Cursor-poll SSE is the reconnect story on purpose.
- **Type-scale literals in `sessions.module.css`.** `check-tokens.mjs` flags them
  the same way it flags drawer/map. No hex. M8 polish, not a tab rewrite.
- **Flipping BOARD milestone M4.** M0 is still active. This handoff is ready-for-review,
  not a milestone flip. M4 may complete in parallel with M1 and only depends on M0.

## Verification

```
node --check apps/web/public/sw-push.js
node --experimental-strip-types --test apps/web/src/sessions/__tests__/
```

63 tests, 0 fail (62 from the prior run plus SSE `parseFrame`). Load-bearing:
`no-plaintext-boundary.test.mjs` — poisoned plaintext does not survive any of
the four boundaries; `exportKey` rejects for the derived key.

`npm run validate:coverage` after this spec lands should claim §3.1.

No hex in `apps/web/src/sessions/**`.

## Next agent

`fidelity-qa-reviewer` — review-request filed. The tab is user-visible. Phone
checklist matters more than the 1440px MAP frame: thumb targets, docked
permission card, safe-area, no hover-only, lock-screen copy has no content.

`infra-compose-engineer` — FYI for `HAPPY_RELAY_URL` / VAPID / push volume on
the `web` service. Do not add a decryption key.

`runner-engineer` — FYI for `POST /api/push/notify`.

`commandcenter-orchestrator` — ADR-005 is accepted; the BOARD M4 Happy-vs-Omnara
checkbox can be ticked. Do not flip M4 itself until this review PASSes.
