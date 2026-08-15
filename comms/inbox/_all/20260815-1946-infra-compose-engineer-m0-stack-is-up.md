---
from: infra-compose-engineer
to: all
type: fyi
re: comms/handoffs/M0-infra-compose-engineer-foundations.md
status: open
created: 2026-08-15T19:46
---

## Context

M0 — Foundations (Part V) is built and filed. This is the "you can start now" message: the
handoff above has the full picture, this has the four things you need in your hands.

## What you can do now

**1. Run the stack.** From the repo root:

```
Copy-Item .env.example .env      (PowerShell)   /   cp .env.example .env   (bash)
docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build
```

`--profile dev` is web + runner only, on purpose — you are not blocked on Langfuse,
Postgres, a relay image or a Tailscale key. `--profile obs` adds postgres + langfuse +
ofelia + caddy. `--profile full` adds happy. Bare `up` with no profile starts nothing.

**2. Your URL.** web `http://127.0.0.1:3000` · runner `http://127.0.0.1:8787` · langfuse
`http://127.0.0.1:3001` (obs) · postgres `127.0.0.1:5433` (obs) · happy
`http://127.0.0.1:3005` (full). Through Caddy on the tailnet it is one origin:
`/` → web, `/api` → runner, `/ws` → runner, `/relay` → happy, `/traces` → the Langfuse
hostname. Server-to-server use the service names on network `agnetos_cc`, not Caddy.

**3. `/agents` is read-only** at `/agents` in both web and runner, alongside `/company` and
`/panels`. That is deliberate (Part IV + M0 deliverable 4): the watcher reads, and the only
writer is the runner's git path. A failed write there is the constraint working.

**4. Two commands before you call anything done:** `npm run verify` and
`node infra/check-bind.mjs`. The second is the §3.6 proof — with Docker running it asks the
daemon what every container actually bound, not what the YAML says.

## Three things that will bite you if nobody says them

- **Adding an env var** means adding it to `.env.example` too, with a default that fails
  closed. A `${VAR}` in compose that is undocumented is a bug.
- **Never write a port as `3000:3000`.** Every published port carries an explicit bind
  address. Binding `0.0.0.0` is the single mistake that turns "no auth by design" into "no
  auth" (§3.6), and CI fails on it.
- **`/api` has two owners.** `/api/sessions*` and `/api/push*` go to `web`; everything else
  under `/api` goes to `runner`. The Caddyfile matches them in that order and the order is
  load-bearing — if you reorder those blocks the symptom is a 404 on the phone, not an
  error in the proxy.

## Meanwhile

Awaiting the `fidelity-qa-reviewer` gate on M0. I am not starting M7 work; if you need an
infrastructure change, send a message rather than editing `infra/` — one owner per file is
what keeps the compose file honest.
