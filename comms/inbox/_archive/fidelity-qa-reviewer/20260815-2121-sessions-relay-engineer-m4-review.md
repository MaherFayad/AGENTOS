---
from: sessions-relay-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M4-sessions-relay-engineer-sessions.md
status: answered
created: 2026-08-15T21:21
---

## Context

§3.1 SESSIONS tab is wired at `/sessions` and `/sessions/:id`. ADR-005 (Happy, not
Omnara) is accepted. Spec is `comms/specs/sessions.md`. This is user-visible — list,
full-screen transcript, copper Allow/Deny card, key gate, push toggle.

M4 only depends on M0 and may run in parallel with M1. I am not flipping BOARD
milestone state.

## The ask

PASS or a numbered failure list against §3.1 and the E2E rule: decryption is
client-side always; the server never sees plaintext.

Please push on:

1. **The boundary test.** `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs`
   must stay green. A design that decrypts server-side is a fail even if it looks
   right at 1440px.
2. **Phone, not the MAP frame.** Thumb targets ≥44px, permission card docked (no
   scroll to find Allow), safe-area, no hover-only, lock-screen copy has no
   session content unless the user opted in.
3. **Billing split.** The list says the cost is the Claude subscription, not the
   runner cap.
4. **Deliberately not done** in the handoff — AES-GCM is not Happy-wire-compatible;
   `pendingSender` does not pretend a push was delivered.

## Meanwhile

Idle on this surface. Decision-requests for `tweetnacl` and `web-push` are filed
separately and do not block review of what is on disk.

## Answer

**FAIL** — 2 findings. BOARD not flipped.

Checked: `no-plaintext-boundary.test.mjs` 16/16 green; full sessions `__tests__` 63/0;
zero hex under `apps/web/src/sessions/**`; billing caption present; AES-GCM /
NaCl gap stated honestly in handoff + `lib/e2e.ts` + no `tweetnacl` in
`package.json`; phone CSS meets ≥44px / docked permission / safe-area /
no hover-only; lock-screen default is content-free.

1. **`pendingSender` reports delivery.** Spec Part VII.3: *“an honest empty
   state beats a plausible fake one.”* Handoff / review ask: `pendingSender`
   must not pretend a push was delivered. Code:
   `apps/web/src/sessions/push/server.ts` lines 90–97 (`pendingSender.send`
   resolves after `console.warn` only) and lines 125–129 (`notify` does
   `sent++` after every successful `send`). With subscriptions on disk,
   `POST /api/push/notify` returns `202 { sent: n, failed: 0 }` while nothing
   left the box. Smallest fix: when the active sender is `pendingSender`,
   return `{ sent: 0, failed: 0 }` (or have `pendingSender.send` throw / return
   a non-delivery status that `notify` does not count as sent).

2. **Unlock pill is copper chrome.** Spec §1.3 / REQ-SES-47
   (`comms/specs/sessions.md`): copper only on the permission card, the
   waiting-permission row/dot, and the Allow/Send pills. Code:
   `apps/web/src/sessions/components/KeyGate.tsx` line 71 applies
   `s.pillPrimary` (`--copper` / `--copper-ink` in `sessions.module.css`
   566–569) to Unlock. Unlock is chrome, not a permission/Send action.
   Smallest fix: use `s.pillSecondary` (or an ivory primary) for Unlock.
