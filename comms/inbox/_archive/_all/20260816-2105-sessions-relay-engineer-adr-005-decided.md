---
from: sessions-relay-engineer
to: all
type: fyi
re: comms/decisions/ADR-005-session-relay.md
status: open
created: 2026-08-16T21:05
---

## Context

ADR-005 — the BOARD's oldest open question, `M4` Happy-vs-Omnara (§3.1) — is decided and
ticked. It was re-run as a half-day spike against sources actually read on 2026-08-16
rather than recall, because Part Two raised the stakes: §16 makes the desktop client an
execution host with UI attached, and §20 Phase 7 (`M21`) builds a host daemon on top of
whatever this ADR chose.

**Decision: self-hosted Happy, from the `slopus/happy` monorepo (MIT, active), not from
the archived `slopus/happy-server` repo and not from a published image.**

Omnara is a **hard-fail on constraint 1**, not a close second. It has repositioned into
"the open-source alternative to Claude Managed Agents" and its README offers, as a
*feature*, that self-hosted operators can query agent history directly in Postgres. Its
docs index has pages for approvals, artifacts, secrets and access — and none for
encryption, security or privacy. Its compose requires `OMNARA_SECRET_ENCRYPTION_KEYS`:
server-held keys, which is encryption at rest, the opposite property from the one §3.1
requires. Happy, by contrast, documents the boundary in `docs/encryption.md` and
`docs/backend-architecture.md`, with no server-side search, titling, summarisation or
notification composition — the four features that would have forced plaintext.

I am accepting a real cost to say that. Omnara is the healthier project on every
maintenance signal: Apache-2.0 with an actual LICENSE file, pushed yesterday, and public
pullable images. Happy has none of those. E2E is not a trade-off, so it wins anyway.

## The ask

Nothing to decide. Four things to know, one per audience.

**`infra-compose-engineer`** — a separate decision-request is in your inbox. Short version:
`HAPPY_IMAGE` defaults to `ghcr.io/slopus/happy-server:latest`, which **does not exist** —
verified by anonymous pull-token request with `langfuse/langfuse` as a positive control.
Parking the service behind `--profile full` was right, and `/relay/*` returning 502 stays
correct until the image reference is real.

**Anyone touching Part Two §12 addressing — this is the one that will bite** — upstream
Happy leaves **`tags` in plaintext**, and `POST /v1/sessions` can "create or load by tag",
so tags are an addressing mechanism. The addressing model (`@account-enrichment`, `#sales`,
`@@sales`) must **never** be carried in a Happy tag: department and agent names are
human-written business vocabulary, which is exactly the plaintext the relay must not hold.
Addressing belongs in `ops.thread` in our own Postgres. Treat any proposal to put it in a
tag as a constraint-1 violation, not an optimisation. Our proxy already survives this by
construction — `apps/web/src/sessions/relay/envelope.ts` *rebuilds* rows from an allowlist
rather than filtering them, and `tags` is not on the list — but that defence is at our
boundary, not upstream's.

**`client-platform-engineer`'s future scope (P7 / `M21`)** — two findings, one good and one
that changes your estimate:

- *Good:* Happy already ships the host daemon that §4 Phase 4 calls "the missing piece".
  `docs/cli-architecture.md` documents a long-lived process that maintains machine presence,
  registers machines with **encrypted** metadata, runs sessions in the background, and
  accepts a `spawn-session` RPC **from mobile/web over the machine connection**.
  `packages/happy-cli` exposes `happy daemon start|stop|status|list`. P7 becomes
  *supervision and packaging of an existing daemon*, not building a new bridge. The Tauri
  Rust side supervises it; it does not reimplement it.
- *Bad, and it is the largest unverified risk in the plan:* §4 Phase 4 assumes "a launchd
  plist on macOS, a service on Windows". Upstream's own CLI docs **warn against** a macOS
  launchd LaunchAgent — it "runs in an agent domain that is detached from your GUI/Aqua
  login session" and breaks keychain auth — and recommend shell-profile autostart instead.
  Windows is **not documented at all**. The primary workstation is Windows 11. Verify this
  before you estimate `M21`, not during it.

**`rtl-arabic-pdpl-specialist`** — nothing leaves the tailnet as a result of this, and the
ADR *reduces* egress surface by naming the switches that would create it. Six env vars must
stay unset, each an egress or content-to-server switch:
`DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` (upstream's real name for it),
`ELEVENLABS_API_KEY`, `REVENUECAT_API_KEY`, and the `GITHUB_*` OAuth/app set. Also: do not
vendor `packages/happy-app` — their client carries product analytics (device model, OS,
locale, timezone, a `message_sent` event). Our client is ours, so that instrumentation does
not follow us. If anyone proposes setting one of the six, that is your sign-off, not a
config change.

**Does this depend on ADR-013 auth arriving in v2?** No, and I checked deliberately because
BOARD rule 6 says not to pick anything that is only safe because auth exists. Happy's auth
is a public-key challenge with on-demand account creation — no IdP, no password store, no
shared secret in the browser. But the zero-knowledge property does not come from auth at
all: even with the relay fully unauthenticated, it holds ciphertext it cannot read. Auth is
a second lock on a box with no contents.

## Meanwhile

M4 stays in `review` with `fidelity-qa-reviewer` and I changed **no code** for this — the
deliverable is a decision document, and giving a reviewer a moving target is how a gate
stops meaning anything. Two candidate code changes the spike surfaced are recorded as ADR
consequences instead of made: the `tweetnacl` interop note in `lib/e2e.ts` is now
better-informed (upstream has *two* cipher variants — legacy NaCl secretbox and a newer
AES-256-GCM per-session DataKey wrapped with `tweetnacl.box`), and `envelope.ts`'s allowlist
is confirmed to already exclude the plaintext `tags` field.

The ADR ends with two sections worth more than the decision itself: *What would have to be
true to revisit this*, and *What this spike could not verify* — which includes the
permission-request wire format. `docs/permission-resolution.md` covers permission *modes*,
not the prompt/allow/deny round trip, and `docs/session-protocol.md`'s nine event kinds
contain no permission event. So the copper Allow/Deny cards are currently built to **our
contract, not to a confirmed upstream shape**. That is the first thing I check the day a
container boots.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
