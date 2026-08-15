# Spec — SESSIONS tab, Happy relay, client-side E2E

> The implementation spec for §3.1 of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`sessions-relay-engineer`

## Spec sections covered

§3.1

## Boundaries

These neighbouring sections are **not** claimed here. The coverage checker treats
every `§n.n` under `## Spec sections covered` as an ownership claim, so they stay
out of that heading.

- **§3.6 Phone / PWA** — `shell-navigation-engineer` owns the manifest, `sw.js`,
  safe-area chrome, install flow and the browser half of the push handshake
  (`src/lib/pwa.ts`). This spec owns `/sw-push.js` and `POST /api/push/*` because
  §3.1's payloads are end-to-end encrypted and must be opened client-side. `sw.js`
  pulls our module in with `importScripts('/sw-push.js')` and registers no `push`
  listener of its own (their decision 9).
- **§3.2 runner routes** — `runner-engineer`. We expose `POST /api/push/notify`
  `{kind, id}` so they can buzz a phone for approvals and run failures without
  composing copy. We do not mount `/api/run*`.
- **PART V compose / Caddy** — `infra-compose-engineer`. They run the `happy`
  container and match `/api/sessions*` `/api/push*` to `web` before `/api/*`.
  The E2E protocol and the key stay ours.

## Decisions

1. **Self-hosted Happy, not Omnara.** [ADR-005](../decisions/ADR-005-session-relay.md)
   accepted. Omnara's product is a server-rendered dashboard of agent activity —
   it has to hold plaintext. Happy stores sealed boxes. Least custom code that
   keeps the threat model.

2. **The relay is transport.** Our Next routes are a stateless, credential-free
   proxy: they forward the browser's `Authorization` header, rebuild every row
   from an envelope allowlist, and never hold a key. Decryption is
   `lib/e2e.ts` in the browser, always. A feature that needs plaintext the
   server cannot have changes the feature, not the threat model.

3. **The list is sorted in the browser.** Happy encrypts session metadata, so
   name / repo / model / state / cost are not readable by the proxy. Waiting-
   permission-first is a client sort (`lib/sort.ts`), not a query.

4. **The key is a non-extractable `CryptoKey`.** Derived with PBKDF2, imported
   `extractable: false`, stored as a handle in IndexedDB. `exportKey` rejects.
   That is a platform property, not a convention.

5. **Push payloads carry no content by default.** `{k, id, at}` plus an optional
   sealed box. Fixed copy per kind. The service worker decrypts the box only
   when the user has opted into `detail: 'full'`.

6. **AES-GCM is the shipped suite, not the Happy wire format.** Upstream uses
   NaCl secretbox. `apps/web/package.json` does not yet carry `tweetnacl`. The
   `SecretBox` slot in `lib/e2e.ts` is the one place the suite moves. Do not
   treat the AES-GCM default as interoperable with a live happy container.

7. **The stream is a cursor poll behind SSE, not a Socket.IO bridge.** A phone
   that slept for four hours resumes from `Last-Event-ID`. Latency vs. a socket
   is the trade; reconnect-by-construction is the reason.

8. **Interactive cost is the human's Claude subscription.** Hardcoded
   `billing: 'claude-subscription'` in the adapter. Upstream does not get a
   vote. The runner's capped API-key workspace is a different pot of money and
   the list header says so.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-SES-01 | §3.1 | `/sessions` is the fourth tab and mounts `SessionsTab`, not a `ViewMount` placeholder | `apps/web/src/app/(views)/sessions/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SES-02 | §3.1 | A session is addressable at `/sessions/:id` and renders from the id alone — the server has nothing readable to look up | `apps/web/src/app/(views)/sessions/[id]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SES-03 | §3.1 | The list shows name, repo, model, state, elapsed and cost for each session | `apps/web/src/sessions/components/SessionsTab.tsx` | `apps/web/src/sessions/__tests__/list.test.mjs` |
| REQ-SES-04 | §3.1 | State is exactly `working` \| `waiting-permission` \| `idle` | `apps/web/src/sessions/types.ts` | `apps/web/src/sessions/__tests__/list.test.mjs` |
| REQ-SES-05 | §3.1 | The list is sorted waiting-permission first, then working, then idle; within a group, most recently updated first | `apps/web/src/sessions/lib/sort.ts` | `apps/web/src/sessions/__tests__/list.test.mjs` |
| REQ-SES-06 | §3.1 | Sorting happens in the browser after decryption — the proxy cannot sort by state | `apps/web/src/sessions/data/useSessionList.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-07 | §3.1 | A row waiting on permission is visually raised (copper line + fill) before you parse the label | `apps/web/src/sessions/sessions.module.css` | manual — phone checklist |
| REQ-SES-08 | §3.1 | Elapsed is at most two units and cost is two decimals with `tabular-nums`, so the column does not twitch | `apps/web/src/sessions/lib/format.ts` | `apps/web/src/sessions/__tests__/list.test.mjs` |
| REQ-SES-09 | §3.1 | Cost truncates rather than rounding up — the tab never claims a session spent more than it did | `apps/web/src/sessions/lib/format.ts` | `apps/web/src/sessions/__tests__/list.test.mjs` |
| REQ-SES-10 | §3.1 | The list header states that cost is billed to the human's Claude subscription, not the runner cap | `apps/web/src/sessions/components/SessionsTab.tsx` | manual — visual |
| REQ-SES-11 | §3.1 | `billing` is hardcoded to `claude-subscription`; a relay field cannot change it | `apps/web/src/sessions/relay/happy-adapter.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-12 | §3.1 | Clicking a row opens the full-screen session view | `apps/web/src/sessions/components/SessionsTab.tsx` | manual — visual |
| REQ-SES-13 | §3.1 | The session view is a streaming transcript, monospace on `--screen` | `apps/web/src/sessions/components/Transcript.tsx` · `apps/web/src/sessions/sessions.module.css` | manual — visual |
| REQ-SES-14 | §3.1 | The transcript is virtualized — only rows near the viewport exist in the DOM | `apps/web/src/sessions/lib/virtual.ts` · `apps/web/src/sessions/components/Transcript.tsx` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-15 | §3.1 | Auto-scroll follows the stream only when the reader is already at the bottom | `apps/web/src/sessions/lib/virtual.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-16 | §3.1 | Speaker is carried by weight and grey level, never by hue — no terminal-theme rainbow | `apps/web/src/sessions/sessions.module.css` | `scripts/check-tokens.mjs` |
| REQ-SES-17 | §3.1 | Permission prompts render as copper action cards showing the tool and the command verbatim | `apps/web/src/sessions/components/PermissionCard.tsx` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-18 | §3.1 | Allow and Deny are equal-size pills, both ≥48px, neither styled as destructive | `apps/web/src/sessions/sessions.module.css` | manual — phone checklist |
| REQ-SES-19 | §3.1 | The live permission card is docked above the composer and reachable without scrolling | `apps/web/src/sessions/components/SessionView.tsx` | manual — phone checklist |
| REQ-SES-20 | §3.1 | An input box steers the session; what the user typed is sealed in the browser before POST | `apps/web/src/sessions/data/useTranscript.ts` · `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-21 | §3.1 | The composer is ≥44px and 16px type so iOS does not zoom the viewport on focus | `apps/web/src/sessions/sessions.module.css` | manual — phone checklist |
| REQ-SES-22 | §3.1 | This is a thin proxy over happy-server: `GET /api/sessions`, `GET /api/sessions/:id/stream`, `POST /api/sessions/:id/input`, `POST /api/sessions/:id/permission` | `apps/web/src/app/api/sessions/route.ts` · `apps/web/src/app/api/sessions/[id]/stream/route.ts` · `apps/web/src/app/api/sessions/[id]/input/route.ts` · `apps/web/src/app/api/sessions/[id]/permission/route.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-23 | §3.1 | The proxy holds no key and no token of its own — it forwards the browser's `Authorization` header | `apps/web/src/sessions/relay/proxy.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-24 | §3.1 | Every session row leaving the proxy is rebuilt from `{id, seq, updatedAt, active, encryptedMetadata}` — unknown keys are dropped | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-25 | §3.1 | Every transcript row leaving the proxy is rebuilt from `{id, seq, at, ciphertext}` | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-26 | §3.1 | A poisoned upstream row with plaintext `title` / `path` / `text` / `command` loses every one of those fields | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-27 | §3.1 | The input body has no slot for prose — `{ciphertext}` only | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-28 | §3.1 | The permission body is `{requestId, allow}` — a decision, never its subject | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-29 | §3.1 | Decryption happens client-side with the user's key, always | `apps/web/src/lib/e2e.ts` · `apps/web/src/sessions/data/useSessionList.ts` · `apps/web/src/sessions/data/useTranscript.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-30 | §3.1 | The derived key is non-extractable; `crypto.subtle.exportKey` rejects | `apps/web/src/lib/e2e.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-31 | §3.1 | A different key cannot open the box — the relay operator is a different key | `apps/web/src/lib/e2e.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-32 | §3.1 | A device without the key shows `KeyGate`, not an empty list pretending to be decrypted | `apps/web/src/sessions/components/KeyGate.tsx` | manual — visual |
| REQ-SES-33 | §3.1 | A row that cannot be decrypted is counted, not silently dropped | `apps/web/src/sessions/data/useSessionList.ts` | manual — see Test plan |
| REQ-SES-34 | §3.1 | Happy-specific shapes are confined to `happy-adapter.ts`; components speak our types | `apps/web/src/sessions/relay/happy-adapter.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-35 | §3.1 | `waiting-permission` wins over `working` when both are true | `apps/web/src/sessions/relay/happy-adapter.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-36 | §3.1 | The stream reconnects from `Last-Event-ID` / the highest `seq` held; replay is merged without duplicates | `apps/web/src/sessions/lib/replay.ts` · `apps/web/src/sessions/relay/client.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-37 | §3.1 | A gap in `seq` is shown as a sentence, not pretended complete | `apps/web/src/sessions/lib/replay.ts` · `apps/web/src/sessions/components/Transcript.tsx` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-38 | §3.1 | Reconnect backoff caps at 15s with jitter — a phone leaving a tunnel must not sulk | `apps/web/src/sessions/lib/replay.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-39 | §3.1 | SSE keepalives parse to nothing; a malformed data line does not throw | `apps/web/src/sessions/relay/client.ts` | `apps/web/src/sessions/__tests__/stream.test.mjs` |
| REQ-SES-40 | §3.1 | Permission prompts also arrive as push notifications | `apps/web/public/sw-push.js` · `apps/web/src/sessions/push/payload.ts` | `apps/web/src/sessions/__tests__/push.test.mjs` |
| REQ-SES-41 | §3.1 | A push payload is rebuilt as `{k, id, at}` (optional sealed `c`) — caller-supplied titles, commands and names are dropped | `apps/web/src/sessions/push/payload.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-42 | §3.1 | Default notification copy names a decision, never its subject; detailed copy is opt-in and decrypted in the service worker | `apps/web/public/sw-push.js` · `apps/web/src/lib/push.ts` | `apps/web/src/sessions/__tests__/push.test.mjs` |
| REQ-SES-43 | §3.1 | Tapping a permission notification deep-links to `/sessions/:id` | `apps/web/src/sessions/push/payload.ts` · `apps/web/public/sw-push.js` | `apps/web/src/sessions/__tests__/push.test.mjs` |
| REQ-SES-44 | §3.1 | The SESSIONS tab owns the button that enables push (never on mount) | `apps/web/src/sessions/components/PushSettings.tsx` | manual — phone checklist |
| REQ-SES-45 | §3.1 | `POST /api/push/subscribe` stores the endpoint on a local volume; `POST /api/push/notify` accepts `{kind, id}` only | `apps/web/src/app/api/push/subscribe/route.ts` · `apps/web/src/app/api/push/notify/route.ts` | `apps/web/src/sessions/__tests__/push.test.mjs` |
| REQ-SES-46 | §3.1 | Interactive taps in this tab are ≥44px; safe-area insets are honoured; no hover-only affordance | `apps/web/src/sessions/sessions.module.css` | manual — phone checklist |
| REQ-SES-47 | §3.1 | Copper appears only on the permission card, the waiting-permission row/dot, and the Allow/Send pills — chrome is otherwise monochrome | `apps/web/src/sessions/sessions.module.css` | `scripts/check-tokens.mjs` |
| REQ-SES-48 | §3.1 | `+ New session` (`?new=1`) does not spawn from the browser — it says a paired machine running Claude Code does | `apps/web/src/app/(views)/sessions/page.tsx` · `apps/web/src/sessions/components/SessionsTab.tsx` | manual — visual |
| REQ-SES-49 | §3.1 | Server logs from this feature are an id and a byte count, never ciphertext or plaintext | `apps/web/src/sessions/relay/envelope.ts` | `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` |
| REQ-SES-50 | §3.1 | Byte-compatible NaCl secretbox against live happy-server | — | — |
| REQ-SES-51 | §3.1 | RFC 8291 Web Push delivery via a `web-push` sender (the seam exists; delivery is pending the dependency) | — | — |
| REQ-SES-52 | §3.1 | Happy `/v1/auth` public-key challenge pairing (token paste is the stand-in until the container is live) | — | — |

## Interfaces we expose

From `apps/web/src/sessions/index.ts`:

- `<SessionsTab spawnRequested?>` — the fourth tab. Already mounted at `/sessions`.
- `<SessionView sessionId>` — full-screen transcript. Already mounted at `/sessions/:id`.
- `PushKind`, `PushPayload`, `PUSH_KINDS`, `deepLinkFor` — the agreed push shape.
  `runner-engineer` posts `{kind, id}` to `POST /api/push/notify`; we drop everything
  else.

Routes (also in `comms/contracts/api-contracts.md`):

- `GET /api/sessions`
- `GET /api/sessions/:id/stream`
- `POST /api/sessions/:id/input` `{ciphertext}`
- `POST /api/sessions/:id/permission` `{requestId, allow}`
- `POST /api/push/subscribe` · `DELETE /api/push/subscribe`
- `POST /api/push/notify` `{kind, id}` → 202 `{sent, failed}`

`apps/web/public/sw-push.js` — the only push/notificationclick handlers. Shell
must not add a second pair.

Not public: `lib/e2e.ts`, `relay/proxy.ts`, `relay/envelope.ts`. A boundary with
several front doors is not a boundary.

## Interfaces we consume

- `comms/contracts/api-contracts.md` — the §3.1 route table we fill in. Owner:
  `runner-engineer` for the file; we own the §3.1 half in prose.
- `comms/contracts/design-tokens.md` — every colour is `var(--token)`. Copper
  data-ink (`--ink-copper*`) for waiting-on-you; `--copper` / `--copper-ink` for
  the Allow/Send pills.
- `apps/web/src/lib/pwa.ts` (`shell-navigation-engineer`) — `enablePushNotifications`
  is their handshake; we also ship `src/lib/push.ts` which the tab button calls,
  posting to our `/api/push/subscribe`.
- `infra/compose.yaml` / `infra/Caddyfile` — `happy:3005`, `/relay/*`, and the
  first-match `/api/sessions*` `/api/push*` → `web` rules (ADR-005).
- Happy upstream shapes, version-pinned in `happy-adapter.ts` only.

## Test plan

- **Boundary (load-bearing).** `node --experimental-strip-types --test apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs`
  — poisoned plaintext must not survive relay→client, client→relay, server→OS,
  or the key itself. This test is the threat model. Keep it green.
- **List / stream / push.** The other three files in `__tests__/`: sort, format,
  replay, windowing, adapter, SSE parse, copy-drift vs `sw-push.js`.
- **Tokens.** `node scripts/check-tokens.mjs` — zero hex in `src/sessions/**`.
- **Not automatable here.** (a) A real permission card on a phone in sunlight —
  thumb targets, safe-area, no hover. (b) A real Web Push while the app is
  closed, which needs VAPID keys and the `web-push` dependency (REQ-SES-51).
  (c) Byte-compat with a live `happy` container (REQ-SES-50). (d) The 1440px
  side-by-side — `fidelity-qa-reviewer`, PART VI.

## Deliberately not done

- **NaCl secretbox / `tweetnacl`.** ADR-005 "hard now". AES-GCM behind `SecretBox`
  is the shape; it is not the Happy wire format. Decision-request filed for the
  dependency. Do not point a live happy container at this client and expect
  transcripts to open.
- **`web-push` delivery.** `pendingSender` records the intent and never pretends
  a notification was delivered (Part VII.3). RFC 8291 without an integration
  test against a real push service is the kind of crypto that fails on a phone
  at 2am.
- **Happy `/v1/auth` public-key challenge.** KeyGate accepts an optional pasted
  relay token until the container is on the compose `full` profile and the
  challenge can be tested. The decryption key and the relay credential stay
  different things.
- **Spawning a session from the browser.** `+ New session` routes to
  `/sessions?new=1` and the tab tells the truth: Claude Code has to be running
  on a paired machine. A button that POSTed a spawn would lie.
- **Server-side search, previews, or "just the session titles".** The server
  cannot read them. If a future feature needs that, it decrypts in the browser
  or it does not ship.
- **Omnara.** ADR-005 rejected it. Swapping relays later is `happy-adapter.ts`
  plus compose.
- **PWA install, `sw.js`, manifest, offline page.** Shell. We own `sw-push.js`.
- **Runner routes, Langfuse, the cost ticker.** Not ours. The cost *in this tab*
  is the subscription; the ticker is the runner.
- **Socket.IO bridge to happy-server.** Cursor-poll SSE is the shipped reconnect
  story. Upgrade path is documented on `streamTranscript` and does not change
  the client contract.
- **Swapping `sessions.module.css` type literals onto the guardian's scale.**
  `check-tokens.mjs` flags `font-size` / `letter-spacing` literals here (and in
  drawer/map). Same situation they already recorded: owners' files, M8 polish,
  not a rewrite of a working tab. No hex. Composer stays 16px so iOS does not zoom.
