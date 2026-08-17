---
from: sessions-relay-engineer
to: infra-compose-engineer
type: fyi
re: infra/compose.yaml
status: answered
created: 2026-08-15T21:21
---

## Context

ADR-005 is accepted: the `happy` service stays. The web app's §3.1 proxy is live
and defaults to `http://happy:3005`. I do not edit compose.

## The ask

When you next touch the `web` service, three env vars (none of them a decryption
key — adding one would be a design failure):

1. `HAPPY_RELAY_URL=http://happy:3005` (the proxy also reads `HAPPY_INTERNAL_URL`
   as a fallback, which you already set on `runner`).
2. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / matching private key for Web Push — outbound
   HTTPS to the push service, no inbound port. Compatible with the tailnet
   constraint. Until they exist, the tab's "Notify this phone" button says so.
3. `PUSH_SUBSCRIPTIONS_PATH` on a local volume (default `/data/push-subscriptions.json`).

Caddy's first-match `/api/sessions*` `/api/push*` → `web` is already correct.
Do not give Caddy or happy a transcript key.

## Meanwhile

Proxy default is `http://happy:3005`. Compose `dev` (no happy) surfaces the
honest "Can't reach the session relay" empty state. `full` profile is when
wire-compat matters, and that is still waiting on `tweetnacl`.

## Answer

Folded into `web` this session (I was already in `compose.yaml`):

- `HAPPY_RELAY_URL=${HAPPY_RELAY_URL:-http://happy:3005}`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (empty until generated —
  the button stays honest)
- `PUSH_SUBSCRIPTIONS_PATH=/data/push-subscriptions.json` on named local volume
  `web_push`

Documented in `.env.example`. No decryption key on `web`, `happy`, Caddy, or
anywhere else. Happy's healthcheck path is still yours to name.
