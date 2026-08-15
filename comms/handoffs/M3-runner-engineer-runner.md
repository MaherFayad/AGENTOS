---
agent: runner-engineer
milestone: M3
spec: PART III · §3.2 · §3.3
created: 2026-08-15T21:36
status: ready-for-review
---

# M3 — Runner: run / schedule / approvals / Second Brain

## What exists now

- `apps/runner/src/server.ts` + `apps/runner/src/index.ts` — boot. Routes actually mount.
- `apps/runner/src/routes/api.ts` — every `RUNNER_ROUTES` entry.
- `apps/runner/src/lib/runService.ts` — SKILL.md + COMPANY.md prompt, scratch cwd, SSE, artifact, delivery, interview write-back.
- `apps/runner/src/lib/allowlist.ts` — **the enforcement point** (`isToolAllowed` / `canUseTool`). Exactly `wired_into`.
- `apps/runner/src/lib/agentSession.ts` — headless `@anthropic-ai/claude-agent-sdk`.
- `apps/runner/src/lib/sse.ts` — buffer + `Last-Event-ID` + `GET /api/run/:runId/stream`.
- `apps/runner/src/lib/schedule.ts` + `apps/runner/src/lib/git.ts` + `scripts/sync-ofelia.mjs` — frontmatter commit, then ofelia config regenerate.
- `apps/runner/src/lib/runStore.ts` — approvals gate.
- `apps/runner/src/lib/brain.ts` — completeness, COMPANY.md injection, interview write-back (ADR-007).
- `apps/runner/src/lib/watcher.ts` + `WS /ws/graph` — chokidar deltas, or `{type:stale}`.
- `apps/runner/src/lib/graph.ts` — stored artifact + honest `core.brainCompleteness` overlay.
- `comms/contracts/api-contracts.md` + `packages/contracts/src/api.ts` — unchanged this session.
- `comms/specs/runner.md` — claims PART III · §3.2 · §3.3 only.

## How to use it

```
POST /api/run                    { "agent": "sales/account-enrichment", "inputs": {…}, "dryRun": false }
GET  /api/run/:runId/stream      Last-Event-ID: n   (or ?lastEventId=n)
GET  /api/run/:runId/artifact
POST /api/schedule               { "agent": "sales/account-enrichment", "cron": "0 6 * * 1" }
GET  /api/approvals
POST /api/approvals/:runId       { "decision": "approve" | "deny", "note": "…" }
GET  /api/graph
GET  /api/agents/sales/account-enrichment
GET  /api/runs?agent=&limit=5
GET  /api/panels  ·  GET /api/panels/:id
GET  /api/status
WS   /ws/graph
GET  /healthz
```

Env: `ANTHROPIC_API_KEY` (runner workspace, never the human's), `RUNNER_MONTHLY_CAP_USD`, `AGNETOS_REPO_ROOT` or compose `/repo`, `OFELIA_SYNC_URL` / `OFELIA_HUP_COMMAND` for reload, `SLACK_WEBHOOK_URL` for delivery. Compose already sets `REPO_WRITE_ROOT=/repo/agents`.

`dryRun: true` resolves the agent, builds the prompt, echoes `wired_into` on `start`, and does not spawn a session or charge.

## Contracts touched

- `comms/contracts/api-contracts.md` — owned, not edited this session.
- `packages/contracts/src/api.ts` — not edited (prose did not change).
- Consumed: frontmatter-schema, graph-layout (overlay only), panel-schema (verbatim), ADR-002, ADR-003, ADR-007.

## Deliberately not done

- **§3.1 `/api/sessions*` and `/api/push*`.** Caddy routes those to web. Not mounted here.
- **`GET /api/cost/today` as a runner-owned route.** Observability's `COST_TICKER_ROUTE`. This process forwards it via `registerMetricsRoutes` (honest `{usd:null}` when Postgres is down). Absent from `RUNNER_ROUTES`.
- **ofelia HUP from this container.** Generator rewrites `infra/ofelia/config.ini`. The runner image has no docker.sock, so reload needs `OFELIA_SYNC_URL` or `OFELIA_HUP_COMMAND`. Until infra wires one, `ofeliaSynced: false` after a truthful rewrite — stale, not wrong.
- **Email delivery.** No SMTP in compose. Slack is best-effort. Failures are console tokens, not failed runs.
- **Push on the approval gate.** Hook exists (`notifyApproval`); payload is sessions-relay's. Queue + amber overlay still work.
- **Layout-engine signature for `brainCompleteness`.** Open decision-request to map-galaxy. Overlay stays until they answer. Do not change `scripts/lib/layout.mjs` from here.
- **Durable LAST RUNS across restarts.** `GET /api/runs` is this process's live view. Observability's ledger is `/api/metrics/runs`. An empty list after a restart is honest.
- **MCP servers / connector credentials.** The registry names tools; wiring Exa/Firecrawl/Slack is not this milestone.
- **Auth.** Tailnet-only, none in v1 (§3.6).
- **A live SDK session against Anthropic.** Unit tests use `dryRun` and an injectable session factory. The capped key is not in this checkout.

## Verification

- `npm run typecheck --workspace=@agnetos/runner` — pass.
- `npm run test --workspace=@agnetos/runner` — 57 pass (allowlist, SSE replay, dryRun, HTTP inject, plus observability's suite).
- `node --test scripts/__tests__/sync-ofelia.test.mjs` — pass.
- `node scripts/check-spec-coverage.mjs` — pass (PART III · §3.2 · §3.3 claimed here; 3.1 / 3.5 not claimed).

## Next agent

- `drawer-engineer` — SSE console against `RunStreamEvent`; reconnect on `GET /api/run/:runId/stream`.
- `infra-compose-engineer` — ofelia HUP (`OFELIA_SYNC_URL` or `OFELIA_HUP_COMMAND`).
- `map-galaxy-engineer` — answer `comms/inbox/map-galaxy-engineer/20260815-1858-runner-engineer-brain-completeness-in-layout.md`.
- `observability-engineer` — already mounting `GET /api/cost/today` through `registerMetricsRoutes`; `GET /api/runs` stays the live view.
- `agent-library-curator` — `intelligence/company-interview` needs `workspace` in `wired_into` to write `output.md` (the runner copies that file to COMPANY.md; git-only cannot produce it).
