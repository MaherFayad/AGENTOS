# ADR-005 — Session relay: self-hosted Happy, not Omnara

**Date:** 2026-08-15 · **Author:** `sessions-relay-engineer` · **Status:** accepted
**Affects:** `comms/contracts/api-contracts.md` (§3.1 routes) · `infra/compose.yaml` (the
`happy` service) · milestone M4 · BOARD open question **M4**

## Context

§3.1 leaves the relay open — "from **Happy** self-hosted relay, or Omnara" — while Part V
names `slopus/happy-server` in the compose stack. The SESSIONS tab cannot be built until
this is settled, because the two candidates imply *different threat models*, and the
threat model is the only part of this tab that is not negotiable:

> §3.1: "This is a thin UI over happy-server's API — the E2E encryption stays intact
> (decrypt client-side with your key)."

Three constraints decide it, in this order:

1. **E2E survives.** The relay must never be able to read a transcript. Not for search,
   not for previews, not for "just the session titles". If a feature needs plaintext the
   server cannot have, the feature changes — not the threat model.
2. **Self-hostable on our own Docker** next to `web`/`runner`/`langfuse` (Part V).
3. **Push works over a tailnet with no public ports** (§3.6, BOARD constraint 5).

The tie-breaker between two options that both satisfy these is *least custom code*.

## Options

| Option | For | Against |
|---|---|---|
| **A — `slopus/happy-server`, self-hosted** | Zero-knowledge by construction: the server stores encrypted blobs and cannot decrypt them. Purpose-built for Claude Code sessions (Session / SessionMessage / Machine / Artifact, permission requests included). MIT. Node + Prisma + Postgres + Redis — the same shape as the rest of our stack. Auth is a public-key challenge (`/v1/auth`), so no password store and no shared secret in the browser. Encrypted push payloads are already the upstream model. Part V already names it, so compose, Caddy and the BOARD all line up. | Upstream is young; route shapes and the cipher suite are version-pinned facts, not a stable public API. Uses NaCl secretbox rather than WebCrypto primitives, so byte-compatibility costs us one dependency. Self-host docs are thin — we own the compose file ourselves. |
| **B — `omnara-ai/omnara`, self-hosted** | Apache-2.0, self-hostable, Postgres-backed, broader agent-runner ambitions, and a notification story (SMS/email/push) that exists out of the box. | **Not end-to-end encrypted.** Its value proposition is a server-rendered dashboard of agent activity plus server-composed SMS/email notifications — both of which require the server to hold plaintext. That is not a configuration we can turn off; it is the product. Choosing it means either abandoning §3.1's standing constraint or writing an encryption layer *on top of* a system designed to read the data, which is more custom code, not less — and a layer that any upstream feature can quietly bypass. |

Option B fails constraint 1 on its own merits, and fails the tie-breaker as well. There is
no version of "Omnara with E2E" that is less code than "Happy, which already has it".

## Decision

**We use self-hosted `slopus/happy-server` as the session relay.** It runs as the `happy`
service on our Docker network, reachable only through Caddy on the Tailscale IP. Our web
app is a **thin, stateless, credential-free proxy** in front of it — the proxy forwards
the browser's own `Authorization` header, holds no key and no token, and passes
transcript ciphertext through untouched. Decryption happens in the browser with the
user's key.

Three design consequences follow directly and are binding on the implementation:

1. **The session list is decrypted client-side too.** Happy encrypts session *metadata*,
   so name / repo / model / state / cost are not readable by the relay or by our proxy.
   The list therefore arrives as ciphertext rows with a plaintext envelope
   (`id`, `seq`, `updatedAt`, `active`) and is decrypted and **sorted in the browser** —
   which is why "waiting-permission first" is client-side sorting, not a server query.
2. **The key is a non-extractable `CryptoKey`.** It is derived in the browser (PBKDF2
   over the user's recovery secret) and imported with `extractable: false`, then stored in
   IndexedDB. This makes "the key never leaves the browser" a property the platform
   enforces rather than a convention we promise: no script — ours, a dependency's, or an
   injected one — can serialise it into a request body or a log line. There is a test that
   asserts `crypto.subtle.exportKey` rejects for it.
3. **Push payloads carry no content.** Our server only ever holds ciphertext, so it could
   not compose a content-ful notification even if asked. Notifications carry
   `{kind, id, at}` and an optional ciphertext blob; the service worker renders fixed copy
   per `kind` by default and only decrypts the blob locally if the user has explicitly
   opted into detailed notifications. Web Push needs **outbound** HTTPS from our box to
   the push service and **no inbound port**, so it is compatible with the tailnet
   constraint (§3.6) — the phone must have internet, our box must not be exposed.

## Consequences

**Easy now.** Compose gains one service with a Postgres database and a master secret.
Caddy gains `/relay` (upstream websocket/REST) plus `/api/sessions*` and `/api/push*`
routed to `web`. The billing split of Part V holds without extra work: Happy wraps the
user's Claude CLI, so interactive sessions bill to the **human's Claude subscription**,
entirely separate from the runner's capped API-key workspace.

**Hard now.** Byte-compatibility with upstream's NaCl secretbox needs a crypto dependency
(`tweetnacl` or `libsodium-wrappers`) that `apps/web/package.json` does not yet have, and
that file is owned elsewhere. Until it lands, `lib/e2e.ts` ships a WebCrypto AES-GCM
implementation behind a `SecretBox` interface with a documented adapter slot — the
boundary, the key handling and the tests are real and final; only the cipher suite is
pending. A decision-request is filed. **Do not treat the AES-GCM default as
interoperable with a live happy container** — it is the shape, not the wire format.

**If we reverse this.** Everything upstream-specific is confined to
`apps/web/src/sessions/relay/happy-adapter.ts`, which maps upstream rows onto our own
`SessionEnvelope` / `SessionMeta` types. Swapping relays is that file plus compose. The
components, the crypto boundary, the push flow and the contract routes do not move. What
we could *not* recover cheaply is the zero-knowledge property, which is why it is the
first constraint and not the last.

## Contract edits

None. `comms/contracts/api-contracts.md` already specifies the §3.1 route table and the
"E2E stays intact" clause; this ADR resolves *which relay sits behind it* and records the
three design consequences above. One addition is requested by message rather than edited
directly: Caddy must route `/api/sessions*` and `/api/push*` to `web` **before** the
general `/api/*` → `runner` rule, so the two owners' halves of `/api` do not collide.
