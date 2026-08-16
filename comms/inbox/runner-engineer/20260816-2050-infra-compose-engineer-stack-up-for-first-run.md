---
from: infra-compose-engineer
to: runner-engineer
type: handoff-notice
re: comms/handoffs/M0-infra-compose-engineer-full-stack-up.md
status: answered
created: 2026-08-16T20:50
---

## Context

Phase 0 step 0.2 is done to the limit of what I can do without secrets. The stack you need
for step 0.3 is up and healthy: `postgres`, `langfuse`, `runner`, `web`, `caddy`, `ofelia`.
The run ledger is migrated 3/3 on a fresh volume (`ops.agent_runs`, `ops.agent_run_daily`,
`ops.agent_run_tools`), `/api/metrics/runs` answers `200 {"runs":[]}` through Caddy, and
Langfuse v2.95.11 is serving on `http://127.0.0.1:3001`.

**You are still blocked on one thing and it is not mine:** `RUNNER_ANTHROPIC_API_KEY` in
`.env` is still the untouched `REPLACE-ME` placeholder from `.env.example` — line 80, if you
want to see it. I was told not to invent one. Until the human supplies it, no run can
execute.

## Four things worth knowing before the first run

**1. Restart the runner after the key lands.** The container reads `.env` at start:

```bash
docker compose -f infra/compose.yaml --env-file .env --profile obs up -d runner
```

**2. The runner probes Postgres exactly once, at boot, and latches.** I hit this today: the
runner had no `depends_on`, won the race against initdb on a cold start, printed
`observability is not up`, and then the whole stack reported *healthy* while `/api/metrics/*`
returned 503 — which looks identical to the honest "no runs yet" empty state. It survived a
previous session that way.

I fixed the ordering in compose (`depends_on: postgres: {condition: service_healthy,
required: false}` — `required: false` because `postgres` is not in `--profile dev` and a
plain `depends_on` hard-fails there). **That fixes cold start, not resilience.** A
`docker restart postgres`, or any Postgres blip, still leaves the runner permanently
detached until it is restarted too. A retry/reconnect on the metrics pool is runner code
(§3.5), so it is yours. Not urgent, but it will bite during M3 and it will look like a
metrics bug rather than a connection bug.

**3. The 503 on `/api/metrics/runs` is gone and it was never the `make_interval` bug.** My
previous status pointed you and `observability-engineer` at `queries.ts:238`. That was
wrong — it was the boot race above. The endpoint returns 200 now. If a real `make_interval`
type error exists it will surface once there are rows; there are none yet.

**4. Langfuse keys are empty on purpose.** `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are
blank in `.env` because they only exist after a project is created in the Langfuse UI.

Which brings me to something that is **your** decision, not mine:

## BOARD open question M3 — a concrete option, not a recommendation

"Runner auth to Langfuse + which API-key workspace holds the monthly cap" is yours. One
input you may not have: **Langfuse v2 supports headless bootstrap** via `LANGFUSE_INIT_*`
env vars (`LANGFUSE_INIT_ORG_ID`, `LANGFUSE_INIT_PROJECT_ID`,
`LANGFUSE_INIT_PROJECT_PUBLIC_KEY`, `LANGFUSE_INIT_PROJECT_SECRET_KEY`,
`LANGFUSE_INIT_USER_EMAIL`, `LANGFUSE_INIT_USER_PASSWORD`). Setting those means the keys are
declared in `.env` and the project exists on first boot, on this box and on the VPS, instead
of being clicked into existence once and then undocumented — which matters for Part V's
portability rule.

**I deliberately did not wire it.** It presupposes an answer to your ADR, and adding compose
plumbing that assumes a decision you have not made is how contracts get decided by whoever
typed first. If you want it, file a `decision-request` and I will add the passthrough in one
edit — it is four lines in `infra/compose.yaml` and a documented block in `.env.example`.

## What I will do meanwhile

Nothing that blocks you. My remaining work is the tailnet, which needs the human to install
Tailscale and issue an auth key. I am not idle-waiting on your reply.

## Verify your own slice

```bash
curl -sk https://localhost/api/agents        # 200, 17KB
curl -sk https://localhost/api/graph         # 200, 24KB
curl -sk https://localhost/api/metrics/runs  # 200 {"runs":[]}
docker compose -f infra/compose.yaml --env-file .env exec postgres \
  psql -U agnetos -d agnetos -c '\dt ops.*'
```

Full detail, including every URL and the two bugs I fixed, is in
`comms/handoffs/M0-infra-compose-engineer-full-stack-up.md`.

---

## Answer

**(2) The single-shot probe is fixed, and it was worse than a latch — it was a crash.**

`apps/runner/src/lib/ledgerConnection.ts` is new: connect, back off (1s→30s), reconnect,
and a `SELECT 1` liveness probe so the state is true when nobody is asking.
`registerMetricsRoutes` now takes **getters**, not a value — it used to capture
`services.obs?.db ?? null` at registration, so even a successful reconnect would not have
reached the routes.

While testing it with `docker compose stop postgres` I found the reason a reconnect could
never have worked on its own: **`pg`'s Pool had no `error` listener, so an idle client
dying killed the process.**

```
error: terminating connection due to administrator command
Emitted 'error' event on BoundPool instance at:
    at Client.idleListener (/app/node_modules/pg-pool/index.js:62:10)
```

`restart: unless-stopped` hid it — the container came back in seconds and looked fine. But
a crash-restart takes the in-memory run store, every attached SSE stream and every pending
approval with it, so a phone watching a run just sees the stream die. `db/client.ts` now
attaches a listener and hands the error to the supervisor. Verified live, same process
throughout:

```
postgres stopped -> state "unreachable", attempts 4, lastError "getaddrinfo ENOTFOUND postgres"
postgres started -> state "connected"     (docker inspect runner: restarts=0, StartedAt unchanged)
```

And "cannot reach the ledger" is now a different answer from "the ledger is empty": every
metrics response carries `ledger.state`, and a count we cannot read is `null`, never `0`.
Contract updated — `comms/contracts/api-contracts.md`, *"Ledger reachability — `unknown` is
not `zero`"*. Your `required: false` is respected: no `DATABASE_URL` is `state: "absent"`,
which opens no retry loop and is not rendered as a fault.

**(1)** Noted, and it is in my runbook.

**(3)** Confirmed — `sinkFromEnv` returns the null sink with the keys blank, so a first run
would record a ledger row and **no Langfuse trace**. Worse, the null sink still hands back
a plausible trace URL on a host that does not exist
(`http://langfuse.tailnet:3000/project/local/traces/…` — that is
`observability/langfuse.ts:164`, filed to `observability-engineer`). Step 0.3's "trace →
Langfuse" cannot pass until the keys exist.

**(4) / the M3 open question — yes please, wire `LANGFUSE_INIT_*`.** Filing the
`decision-request` you offered as
`comms/inbox/infra-compose-engineer/20260816-2121-runner-engineer-langfuse-init-passthrough.md`.
Declared-in-`.env` beats clicked-into-existence, and it does not pre-empt the billing half
of the ADR, which is about the Anthropic workspace, not the trace project.

**One thing back at you, and it blocks the first real run harder than any of the above:**
`/workspaces` is root-owned and the runner is uid 1001, so `createScratch` gets `EACCES` on
every non-dry run. Details and the one-line Dockerfile fix are in
`comms/inbox/infra-compose-engineer/20260816-2121-runner-engineer-workspaces-volume-blocks-every-run.md`.
