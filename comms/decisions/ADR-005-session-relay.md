# ADR-005 — Session relay: self-hosted Happy, not Omnara

**Date:** 2026-08-15 · **Revised:** 2026-08-16 (spike; evidence replaced recall) ·
**Author:** `sessions-relay-engineer` · **Status:** accepted
**Affects:** `comms/contracts/api-contracts.md` (§3.1 routes) · `infra/compose.yaml` (the
parked `happy` service) · milestone M4 · BOARD open question **M4** ·
`AGENTOS-V2-PLAN.md` §4 Phase 4, §12, §16, §20 Phase 7 (`M21` host daemon)

> **Revision note.** The 2026-08-15 version of this file reached the right decision from
> the wrong facts: it assumed `slopus/happy-server` was a live standalone repo shipping a
> Postgres+Redis container image, and that NaCl secretbox was the only cipher. All three
> were wrong. This revision re-runs the decision against sources actually read on
> 2026-08-16 (cited inline). The decision does not change; three consequences do, and one
> of them un-parks the compose profile differently than planned.

## Context

§3.1 leaves the relay open — "from **Happy** self-hosted relay, or Omnara" — while Part V
names `slopus/happy-server` in the compose stack. The question has been open since M4 and
now blocks more than the SESSIONS tab:

- `infra-compose-engineer` reports `happy` is **not started**. It sits behind
  `--profile full` with the comment "the happy-server image is unverified until
  `sessions-relay-engineer` files the Happy-vs-Omnara ADR at M4". `/relay/*` correctly
  returns 502. This ADR is what un-parks it.
- `AGENTOS-V2-PLAN.md` §4 Phase 4 says plainly: "settle ADR-005 (Happy vs Omnara) — it is
  still open on the BOARD and it blocks this whole item."
- Part Two changes what is being chosen. §16 makes the desktop client an **execution host
  with UI attached** (Tauri + a Rust daemon), and §20 Phase 7 (`M21`) builds a host daemon
  on top of whatever this ADR picks. §12 folds sessions, runs and tasks into one `thread`.
  So the relay is no longer "the transport behind one tab" — it is the substrate a later
  phase assumes.

### The constraints, and which are hard-fails

| # | Constraint | Kind |
|---|---|---|
| 1 | E2E stays intact; decryption is client-side, always (BOARD/CLAUDE.md rule 5, §3.1) | **Hard-fail.** An option whose server can read session plaintext is disqualified, not penalised. |
| 2 | No public ports, tailnet only, no auth in v1; nothing that is *only* safe because auth exists (rule 6, §3.6) | **Hard-fail.** |
| 3 | Traces and volumes stay local; PII redacted at instrumentation; any hosted component or telemetry callback is a data-egress decision (rule 7, Part VII.4) | **Hard-fail** for a *required* callback; a trade-off for an optional one that we can leave unconfigured. |
| 4 | Self-hosted on our own Docker over our own network; anything leaving the tailnet needs `rtl-arabic-pdpl-specialist` PDPL sign-off | Hard-fail for "cannot be self-hosted"; trade-off for "self-hosting is awkward". |

Tie-breaker between two options that pass all four: **least custom code**.

## Options

### Option A — Happy, self-hosted (`slopus/happy`, MIT)

**E2E (constraint 1): passes, and the claim is checkable rather than marketing.**
`docs/encryption.md` states the design goal as "Keep the server blind to user content
(end-to-end encryption on clients)" and enumerates both sides of the boundary:

- Encrypted client-side: session metadata, agent state, session messages, machine metadata
  and daemon state, artifact headers and bodies, KV values, access-key data.
- Plaintext and therefore server-visible: **ids, versions, timestamps (epoch ms), tags, and
  HTTP endpoint/field names**.
- Two cipher variants, not one: legacy **NaCl secretbox (XSalsa20-Poly1305**, 24-byte nonce,
  32-byte shared key) and a newer per-session **DataKey (AES-256-GCM**, 12-byte nonce,
  16-byte tag), with the data key wrapped via `tweetnacl.box` and an ephemeral keypair.
- The only server-side encryption is of **third-party service tokens** (GitHub OAuth,
  vendor credentials) under a `KeyTree` derived from `HANDY_MASTER_SECRET`. That key
  decrypts integration tokens; it does not decrypt a transcript.

`docs/protocol.md` corroborates it from the transport side: "The server never needs to
understand plaintext. The protocol therefore treats most payloads as opaque strings or
base64 blobs." `docs/backend-architecture.md` separates client-side encryption (all user
content) from server-side encryption (integration tokens only), and documents **no**
server-side search, title generation, summarisation, or notification composition — the
four features that would have forced plaintext.

**Auth (constraint 2): passes without depending on auth.** `docs/user-identity.md`:
clients sign a server-issued challenge with a private key and `POST /v1/auth`; the account
is `upsert`ed on first valid signature. No pre-registration, no external IdP, no password
store, no shared secret in the browser. This matters for the phrasing of rule 6 — we are
not choosing something that is *only safe because auth exists*. Even with the relay fully
unauthenticated, it holds ciphertext it cannot read. Auth is a second lock on a box with
no contents.

**Egress (constraint 3): passes, with named things to leave unset.** `docs/deployment.md`
lists external integrations as **optional**: `GITHUB_CLIENT_ID`/`SECRET`/app keys,
`ELEVENLABS_API_KEY` (voice), `REVENUECAT_API_KEY` (subscriptions). There is also a debug
flag named `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`. None are required to boot.
`docs/product-analytics.md` describes analytics events (device model, OS, screen size,
locale, timezone; `message_sent` as the canonical outbound event) — but that instrumentation
lives in **`packages/happy-app`, their client**, which we do not ship. Our client is ours.

**Self-hosting (constraint 4): passes, by a route we had wrong.** There is an official
package `happy-server-self-host` (npm `1.1.11`, MIT, published 2026-06-10) — "run
`happy server`" — which bundles the sync server with an embedded web app and, in its own
words, runs on "embedded PGlite storage and local filesystem uploads — no Postgres, no
Redis, no S3". `packages/happy-server/package.json` confirms it: `@electric-sql/pglite`
and `pglite-prisma-adapter` sit alongside `ioredis` and `minio`.

**Fit with Part Two: the strongest single argument.** `docs/cli-architecture.md` documents
a persistent **daemon** — "a long-lived process responsible for running sessions in the
background and maintaining machine presence" — that registers machines with encrypted
metadata (host, platform, CLI version), holds machine-scoped Socket.IO connections, and
accepts a `spawn-session` RPC "from mobile/web via machine connection". Sessions can be
started by the CLI in the foreground, by the daemon in the background, **or remotely**.
`packages/happy-cli` exposes `happy daemon start|stop|status|list`. That is most of the
"missing piece" §4 Phase 4 describes and most of what §20 Phase 7 schedules 8–12 days to
build.

**Against.** No published container image (see the hard fact below). The standalone
`slopus/happy-server` repo that Part V names is **archived** (2026-02-14) and carries **no
LICENSE file**; the code moved into the `slopus/happy` monorepo, which *is* MIT and active
(last push 2026-08-10). Route shapes and cipher variants are version-pinned facts, not a
stable public API. `@slopus/happy-wire` — the package that would give us schema parity —
is at `0.1.0`, published 2026-02-13 and untouched since.

### Option B — Omnara (`omnara-ai/omnara`, Apache-2.0)

**E2E (constraint 1): hard-fail.** Omnara has repositioned since the question was first
asked: it is now "the open-source alternative to Claude Managed Agents" — an execution
platform for managed agents. Its README states "Agent state is committed atomically to
Postgres" and offers, as a *feature*, that self-hosted operators can query agent history
directly in the database for analytics and evaluation datasets. Its documentation index
(`docs.omnara.com/llms.txt`) has pages for approvals, streaming events, artifacts, tools,
secrets, members and access — and **no page for encryption, security, self-hosting privacy,
or E2E**. `SECURITY.md` is a vulnerability-disclosure policy and says nothing about
encryption at rest, in transit, or end-to-end. Its compose file requires
`OMNARA_SECRET_ENCRYPTION_KEYS` — **server-held** keys, which is encryption at rest, the
opposite property from the one we need.

This is not a gap in their engineering; it is their product. A server-rendered dashboard of
agent activity, server-side approvals, and a Slack connector all require the server to hold
plaintext. There is no configuration that turns that off.

**The other three.** Constraint 2: no evidence either way, and moot. Constraint 3: its
compose pulls `SENDGRID_API_KEY` (outbound email) and `EXA_API_KEY` (worker egress), and it
runs a nine-service stack (Postgres 18, Valkey, MinIO, nginx, api, worker, maintenance,
migrate, web) — more surface than our whole current stack. Constraint 4: passes cleanly, and
better than Happy — see below.

**Against, and it is real.** Choosing Omnara means either abandoning §3.1's standing
constraint, or writing an encryption layer *on top of* a system designed to read the data.
The second is more custom code, not less, and it is a layer any upstream feature can quietly
bypass — the next release that adds server-side search or a summary line in a Slack message
re-breaks it, silently, on a `docker compose pull`.

**For, honestly stated.** Omnara is the healthier project by every maintenance signal:
active (pushed 2026-08-15), 2,732 stars, 13 open issues, Apache-2.0 with a LICENSE file, and
**public, anonymously pullable images** at `ghcr.io/omnara-ai/omnara-{api,web,worker,...}`.

### The hard operational fact that changes the plan

Verified 2026-08-16 by anonymous registry token request against ghcr.io and Docker Hub:

| Reference | Result |
|---|---|
| `ghcr.io/slopus/happy-server:latest` (**our compose default**) | token **denied** — not a public package |
| `ghcr.io/slopus/happy` | token denied |
| `docker.io/slopus/happy-server`, `docker.io/slopus/happy` | 404 |
| `ghcr.io/omnara-ai/omnara-api`, `-web`, `-worker` | manifest **HTTP 200** |
| `ghcr.io/langfuse/langfuse` (control, to prove the method) | manifest **HTTP 200** |

So `infra-compose-engineer` was right to park the service, and now we know precisely why:
**the image it points at does not exist.** That is a compose fix, not a decision reversal —
the supported path is a small Node image running the official `happy-server-self-host`
package, or a build from `packages/happy-server` in the monorepo.

## Decision

**We use self-hosted Happy as the session relay, sourced from the `slopus/happy` monorepo
(MIT), not from the archived `slopus/happy-server` repo and not from a published image.**

It runs as the `happy` service on our Docker network, reachable only through Caddy on the
Tailscale IP. Our web app remains a **thin, stateless, credential-free proxy** in front of
it: it forwards the browser's own `Authorization` header, holds no key and no token, and
passes transcript ciphertext through untouched. Decryption happens in the browser with the
user's key.

Option B is disqualified on constraint 1, which is a hard-fail, and would also lose the
tie-breaker: there is no version of "Omnara with E2E" that is less code than "Happy, which
already has it". We accept Option B's better maintenance and packaging as the price.

Three design consequences follow directly and remain binding on the implementation. All
three were verified against upstream in this spike rather than assumed:

1. **The session list is decrypted client-side.** Confirmed: session *metadata* is in the
   client-encrypted set. Name / repo / model / state / cost are not readable by the relay or
   by our proxy. The list arrives as ciphertext rows with a plaintext envelope and is
   decrypted and **sorted in the browser** — which is why "waiting-permission first" is
   client-side sorting, not a server query. `UpdatePayload.seq` is a per-user monotonic
   counter, so reconnect-and-replay is a protocol property we consume, not something we
   invent.
2. **The key is a non-extractable `CryptoKey`.** Derived in the browser, imported with
   `extractable: false`, stored in IndexedDB, with a test asserting `exportKey` rejects.
   Unchanged, and unaffected by the cipher findings.
3. **Push payloads carry no content.** Our server only ever holds ciphertext, so it could
   not compose a content-ful notification if asked. This also survives Part Two: §16's push
   design ("the payload carries only `wake: thread_42`") is the same rule.

## Consequences

**Easy now.**
- The compose profile un-parks. The relay needs one service plus a master secret, and — via
  `happy-server-self-host` — it may not need the Postgres database we reserved for it at
  all, because PGlite is embedded. That is a smaller footprint than planned, and one fewer
  shared-Postgres coupling.
- The billing split of Part V holds without extra work: Happy wraps the user's Claude CLI,
  so interactive sessions bill to the **human's Claude subscription**, entirely separate
  from the runner's capped API-key workspace. The SESSIONS cost figure and the runner cost
  ticker are different money and must never be summed.
- **P7 (`M21`) gets smaller.** The Happy daemon already provides machine registration and
  presence, background sessions, and remote `spawn-session` over RPC from web/mobile. P7's
  host daemon becomes *supervision and packaging of an existing daemon*, not a new bridge.
  The Tauri Rust side supervises `happy daemon`; it does not reimplement it.
- §12's thread model is unaffected. A `session` thread kind maps onto a Happy session id;
  `ops.thread` stores the id, never the content.

**Hard now.**
- **Compose must stop pointing at a non-existent image.** `HAPPY_IMAGE` defaults to
  `ghcr.io/slopus/happy-server:latest`, which cannot be pulled by anyone. This ADR does not
  change it — `infra/compose.yaml` is `infra-compose-engineer`'s file and M4 is under review.
  A message is routed instead. Until it changes, `--profile full` cannot come up and 502 on
  `/relay/*` remains the correct behaviour.
- **The cipher work is smaller but still real.** `lib/e2e.ts` ships WebCrypto AES-GCM behind
  a `SecretBox` interface with an adapter slot. The spike shows AES-256-GCM *is* in the
  upstream protocol (the DataKey variant), so the shape is closer to right than the previous
  version of this ADR feared — but the data key is wrapped with `tweetnacl.box`, and legacy
  sessions are secretbox. `tweetnacl` is still required for interop. **Do not treat the
  AES-GCM default as interoperable with a live happy container**; it is the shape, not the
  wire format. The decision-request for the dependency stands.
- **Upstream leaves `tags` in plaintext**, and `POST /v1/sessions` can "create or load by
  tag" — tags are an addressing mechanism. Our proxy already survives this by construction:
  `apps/web/src/sessions/relay/envelope.ts` **rebuilds** rows from
  `SESSION_ENVELOPE_KEYS` rather than filtering them, and `tags` is not in the list, so it
  cannot reach our client even if upstream starts sending it. **Forward-looking hazard for
  Part Two:** §12's addressing model (`@agent`, `#department`, `@@department`) must never be
  carried in a Happy tag. Department and agent names are human-written business
  vocabulary — exactly the plaintext the relay must not hold. Route addressing through
  `ops.thread` in our own Postgres, and treat any proposal to put it in a tag as a
  constraint-1 violation.
- **Push is ours, not Happy's.** Happy's push surface is token-registration
  (`POST /v1/push-tokens`, `DELETE /v1/push-tokens/:token`, `GET /v1/push-tokens`) and the
  API docs do not name the provider; their own clients are Expo, so it is very unlikely to
  be Web Push/VAPID. Our PWA therefore keeps its own VAPID Web Push in `web`, which is what
  M4 built and what the compose env (`VAPID_PRIVATE_KEY`, `PUSH_SUBSCRIPTIONS_PATH`) already
  reflects. This is a confirmation of the built design, not a change to it.
- **Named env vars that must stay unset**, and this is a PDPL point, not a preference:
  `ELEVENLABS_API_KEY`, `REVENUECAT_API_KEY`, `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/
  `GITHUB_APP_ID`/`GITHUB_PRIVATE_KEY`/`GITHUB_WEBHOOK_SECRET`, and above all
  `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`. Each is an egress or a
  content-to-server switch. Setting any of them is a data-egress decision requiring
  `rtl-arabic-pdpl-specialist` sign-off (Part VII.4). Do not vendor `packages/happy-app`;
  its analytics instrumentation is the reason.
- **Upstream health is the accepted risk.** The repo Part V names is archived and
  unlicensed; the monorepo is MIT and active but carries 974 open issues, and the wire
  package we would depend on for schema parity has not moved since February. §4 Phase 4
  already calls this "the highest external-dependency risk in the plan" and this spike
  agrees.

**Does the choice depend on auth arriving in v2?** No. It survives without ADR-013.
The zero-knowledge property is a function of where decryption happens, not of who is
allowed to connect. ADR-013's identity work adds an `account_id` to the session grouping —
per §4 Phase 4, that is an **addition to the envelope key list, made deliberately by ADR**,
exactly as `envelope.ts`'s comment demands. It is not a loosening of the boundary.

**If we reverse this.** Everything upstream-specific stays in
`apps/web/src/sessions/relay/happy-adapter.ts`, which maps upstream rows onto our own
`SessionEnvelope` / `SessionMeta` types. Swapping relays is that file plus compose. The
components, the crypto boundary, the push flow and the contract routes do not move. What we
could not recover cheaply is the zero-knowledge property — which is why it is the first
constraint and not the last.

## What would have to be true to revisit this

Any one of these reopens the ADR:

1. **Happy adds server-visible content.** A release that puts plaintext titles, search, or
   server-composed notifications in the server. Detection is already automated: the
   allowlist rebuild in `envelope.ts` plus `no-plaintext-boundary.test.mjs` fail closed when
   upstream sends a plaintext field we did not authorise.
2. **The `slopus/happy` monorepo is archived too, or relicensed away from MIT.** The
   standalone server repo going read-only in February is the precedent; if the monorepo
   follows, we are maintaining a fork and the calculus changes.
3. **Omnara ships genuine client-side E2E** — client-held keys, a server that stores opaque
   blobs, and documentation that says what the server can read. Then it wins on every
   remaining axis (licence, images, maintenance) and this ADR should be superseded.
4. **`happy-server-self-host` proves unrunnable in a container**, or the daemon proves
   unusable on Windows (see the unverified list), and the wrapping cost exceeds the cost of
   writing a minimal relay of our own against the documented protocol. A relay that stores
   opaque blobs keyed by `(session_id, seq)` is genuinely small; it is *not* the least-code
   option today, but it is the fallback that keeps constraint 1 intact.
5. **P7 discovers the Happy daemon cannot be supervised** as a Windows service or a macOS
   login item. That would not change the relay choice, but it would change P7's estimate.

## What this spike could not verify

Stated plainly, because an ADR that admits uncertainty is worth more than one that
manufactures confidence.

- **Windows daemon support.** `packages/happy-cli` documents `~/.zshrc`/`~/.bashrc`
  autostart and explicitly warns *against* a macOS launchd LaunchAgent (it "runs in an agent
  domain that is detached from your GUI/Aqua login session" and breaks keychain auth).
  Windows is **not documented at all**. `AGENTOS-V2-PLAN.md` §4 Phase 4 assumes "a launchd
  plist on macOS, a service on Windows" — upstream's own docs contradict the first half and
  are silent on the second. This is the largest unverified risk to P7, and the primary
  workstation is Windows 11.
- **Whether the self-host package runs cleanly in a container.** The README describes a
  global npm install and a `happy server` command, not a container. Nothing says it cannot,
  but nobody has run it here. No spike container was built — M4 is under review and this
  task is a decision document.
- **A documentation conflict I could not resolve.** `docs/deployment.md` lists Postgres,
  Redis and S3 as required (`DATABASE_URL`, `REDIS_URL`, `S3_*`); `packages/happy-server-self-host/README.md`
  says none are needed. The likeliest reading is that `deployment.md` describes their hosted
  production deployment and the self-host wrapper substitutes PGlite and local files. Treat
  the footprint as **unconfirmed** until someone boots it.
- **Push provider and payload shape.** `docs/api.md` lists the push-token endpoints but does
  not name the provider or document the payload. Moot for us, since our Web Push is our own,
  but it means "Happy's encrypted push payloads" cannot be cited as fact.
- **Permission-request wire format.** `docs/permission-resolution.md` covers permission
  *modes* (`default`, `bypassPermissions`, `read-only`), not prompt/allow/deny flow, and
  `docs/session-protocol.md`'s nine event kinds contain no permission event. The
  allow/deny round trip that the copper action cards drive is therefore **specified by our
  contract, not confirmed against upstream**. This is the highest-priority thing to verify
  the day the container boots.
- **Omnara's absence of E2E is evidenced by silence**, which is weaker than a statement.
  No page in its docs index, README, or SECURITY.md claims or denies it. The affirmative
  evidence is `OMNARA_SECRET_ENCRYPTION_KEYS` (server-held), "agent state is committed
  atomically to Postgres", and self-hosted DB querying offered as a feature. That is strong
  circumstantial evidence and I am treating it as decisive; it is not a quotation of them
  saying "the server can read your messages".
- **All upstream evidence is documentation, not code review.** I read `docs/encryption.md`,
  `protocol.md`, `backend-architecture.md`, `user-identity.md`, `deployment.md`,
  `cli-architecture.md`, `api.md`, `session-protocol.md`, `product-analytics.md`, two
  `package.json` files and two READMEs. I did not audit `packages/happy-server/sources`. A
  server that documents blindness and implements otherwise would not be caught by this
  spike — it would be caught by our own boundary tests, which is the reason those exist.

## Contract edits

None. `comms/contracts/api-contracts.md` already carries the §3.1 route table and the
"E2E stays intact" clause; this ADR resolves *which relay sits behind it*. Two changes are
**requested by message, not made here**, because M4 is in review and neither file is mine:

1. `infra/compose.yaml` — `HAPPY_IMAGE` must stop defaulting to
   `ghcr.io/slopus/happy-server:latest`, which does not exist. → `infra-compose-engineer`.
2. Caddy must route `/api/sessions*` and `/api/push*` to `web` **before** the general
   `/api/*` → `runner` rule, so the two owners' halves of `/api` do not collide. (Carried
   forward from the original version of this ADR.)
