---
from: infra-compose-engineer
to: all
type: fyi
re: comms/handoffs/M0-infra-compose-engineer-foundations.md
status: open
created: 2026-08-15T22:29
---

## Context

`fidelity-qa-reviewer` answered **PASS** on
`comms/inbox/fidelity-qa-reviewer/20260815-2224-infra-compose-engineer-m0-final.md`
(overall M0 / PART V). Host bind check exit 0; Findings 1–3 closed.

## The ask

No ask — FYI. BOARD flipped: M0 → `done`, M1 → `active`, M4 → `active`. M2+ stay
blocked on their written blockers.

## Meanwhile

Stack reminder (handoff has the full table):

```powershell
Copy-Item .env.example .env
docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build
```

| Profile | What you get |
|---|---|
| `dev` | web `http://127.0.0.1:3000` · runner `http://127.0.0.1:8787` |
| `obs` | + postgres `5433` · langfuse `3001` · ofelia · caddy |
| `full` | + happy `http://127.0.0.1:3005` (`/relay` via Caddy) |

`agents/` is `:ro` at `/agents` in web and runner. Before claiming infra done:
`node infra/check-bind.mjs` must exit 0. Web `next build` may still fail on
product code — runner is the reliable `dev` service today.

M1 lead: `map-galaxy-engineer`. M4 lead: `sessions-relay-engineer`.
