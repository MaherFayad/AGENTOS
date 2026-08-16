---
from: infra-compose-engineer
to: all
type: handoff-notice
re: comms/handoffs/M0-infra-compose-engineer-full-stack-up.md
status: open
created: 2026-08-16T20:51
---

## Two things, both of which change how you work

### 1. `npm run build` no longer kills the dev server

The `.next` collision reported at 13:55 and 15:56 is fixed at the config layer.
`apps/web/next.config.mjs` gives `next build` its own `distDir`:

```
next dev            -> .next          (only next dev writes here)
next build / start  -> .next-build
```

**Drop the "build is exclusive, run it last, restart the server after" habit.** It is safe to
build while the dev server is running. Verified by doing exactly that: server up on 4321,
full build to completion, server still answering 200 afterwards.

Two knock-ons you will notice:

- `apps/web/next-env.d.ts` is now gitignored and untracked. Next rewrites its `reference
  path` line to whichever distDir ran last, so tracking it meant a permanent dirty line in
  everyone's worktree. Nothing depends on it — `tsc --noEmit` passes with it absent.
- **Start the dev server with `cd apps/web && npm run dev`**, not `npx next dev -p 4321`.
  The script is now `next dev -H 127.0.0.1 -p 4321`. Bare `next dev` binds `0.0.0.0`, and I
  found the server listening on `192.168.100.83:4321` — reachable by anything on the house
  wifi. Not a public port, but off-tailnet exposure of an app that has no auth by design
  (BOARD constraint 5, §3.6). It is running loopback-only now.

### 2. The full stack is up — here is your service's URL

```bash
docker compose -f infra/compose.yaml --env-file .env --profile obs up -d --build
```

Six services, all healthy: `web`, `runner`, `postgres`, `langfuse`, `ofelia`, `caddy`.
`--profile dev` still starts web + runner alone, so nobody is blocked on the full stack.

Through Caddy, one origin, `tls internal` (browser warns until you install Caddy's root CA):

| You own | Your URL |
|---|---|
| `shell-navigation-engineer`, `map-galaxy-engineer`, `drawer-engineer`, `dashboards-engineer`, `chart-matrix-engineer` | `https://localhost/` — and the live dev server at `http://127.0.0.1:4321` |
| `runner-engineer` | `https://localhost/api/*` and `/ws/*` → runner. Direct: `http://127.0.0.1:8787` |
| `sessions-relay-engineer` | `https://localhost/api/sessions*` and `/api/push*` → web's own handlers. `/relay/*` → happy, **502 today**, `--profile full` only, pending ADR-005 |
| `observability-engineer` | **`http://127.0.0.1:3001`** — Langfuse v2.95.11. Postgres at `127.0.0.1:5433`, db `agnetos`, ledger migrated 3/3 |
| `agent-library-curator` | `/agents` is mounted **read-only** into both runner and web — verified, a `touch` is refused in each. The runner's `/repo/agents` git path is the only write route |

**Langfuse: use `http://127.0.0.1:3001`, not `/traces`.** The `/traces` redirect goes to
`traces.localhost`, and Windows — unlike Linux and macOS — does not resolve `*.localhost`.
The redirect itself is correct and works once `TRACES_HOST` is a real MagicDNS name. Do not
"fix" it with a hosts-file entry; that is machine state outside compose.

### What is NOT true yet, so nobody builds on it

- **There is no tailnet.** No Tailscale on this host, no auth key. Every URL above is
  loopback-only. **No phone has been tested.** Step 0.2's acceptance ("open the PWA on your
  phone over Tailscale") is unmet and I am not claiming it.
- **No agent has ever run.** `RUNNER_ANTHROPIC_API_KEY` is still the `REPLACE-ME`
  placeholder. So the LIVE counter, the cost ticker and LAST RUNS are empty because they are
  *honest* (rule 9), not because they are broken. If your widget shows an empty state right
  now, that is the correct render — do not chase it.
- `ofelia` is scheduling 4 jobs (3 from frontmatter + the ADR-008 prune). They will start
  firing and failing the moment the key lands and a schedule is due. That is expected.

Full detail, both bugs I fixed (a nonexistent ofelia image tag; the runner racing Postgres at
boot), and what I need from the human:
`comms/handoffs/M0-infra-compose-engineer-full-stack-up.md`.
