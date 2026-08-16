---
agent: infra-compose-engineer
milestone: M0
spec: Part V, §3.5, §3.6, Part VII.4
created: 2026-08-16T11:47
status: ready-for-review
---

# M0 — the data plane is actually running

M0 shipped a *valid* compose file. It had never been *started*. `docker compose config`
exiting 0 proves a file parses; it proves nothing about a volume, a schema, or a
connection. This handoff closes that gap: Postgres and Langfuse are up, the run ledger
exists, and the runner's observability layer is attached to it.

This is the root cause of the complaint that every dashboard reads "No figure yet" /
"No runs in this window" / "NO COST DATA" and the LIVE counter reads 0. The UI was
correct under standing rule 9 the whole time — there was no ledger to read. There is one
now, and it is honestly empty (zero runs have happened), which is a different and better
kind of empty.

## What exists now

- `.env` — repo root, **gitignored** (`git check-ignore -v .env` → `.gitignore:9:.env`).
  Real secrets generated with `openssl rand`. Profile: local dev, loopback only, no
  tailnet. See "What the human must supply" below for the four blanks.
- `infra/postgres/init/01-databases.sh` — new. `initdb` creates only `$POSTGRES_DB`
  (`langfuse`), but this server holds three databases on purpose: `langfuse` (theirs),
  `agnetos` (our run ledger + business rows), `happy` (the relay's ciphertext store).
  Separate databases, not schemas, so a `pg_dump` of the ledger never drags Langfuse's
  tables along and a Langfuse migration can never touch `ops.*`. POSIX `sh`, LF endings,
  no host tools — runs identically under Docker Desktop on Windows.
- `infra/compose.yaml` — two edits, both on `postgres`: `APP_DB` / `HAPPY_DB` added to
  `environment:` (the init script reads them), and
  `./postgres/init:/docker-entrypoint-initdb.d:ro` mounted. In compose rather than a
  typed `createdb`, per the portability rule — if it isn't in the file it doesn't exist
  on the VPS either.
- Running containers: `agnetos-postgres-1` (healthy, `127.0.0.1:5433`),
  `agnetos-langfuse-1` (healthy, `127.0.0.1:3001`).
- Volume `agnetos_langfuse_pgdata`, `driver: local`, created. Traces and Postgres stay on
  this box (Part VII.4).
- Schema in database `agnetos`: `ops.agent_runs`, `ops.agent_run_tools`,
  `ops.agent_run_daily`, `app.agent_outputs`, `public.ops_migrations`, plus functions
  `ops.rollup_runs`, `ops.prune`, `app.touch_updated_at`.
- Runner restarted on `127.0.0.1:8787` with `DATABASE_URL` set. It no longer logs
  `observability is not up`.

## How to use it

Bring the data plane up (this is the whole command):

```bash
docker compose -f infra/compose.yaml --env-file .env up -d postgres langfuse
```

Start the runner against it, from the repo root:

```bash
set -a && . ./.env && set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${APP_DB}"
export RUNNER_HOST=127.0.0.1          # see "Bind address" below
export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"
cd apps/runner && npm start
```

Migrations need no separate step — `createObservability()` applies them on the way up.
To apply them standalone (the repo's own entrypoint, `apps/runner/src/db/client.ts`):

```bash
DATABASE_URL='postgresql://…@127.0.0.1:5433/agnetos' ./node_modules/.bin/tsx apps/runner/src/db/client.ts
```

psql into the ledger: `docker exec -it agnetos-postgres-1 psql -U agnetos -d agnetos`.
Langfuse UI: <http://127.0.0.1:3001> — sign up, create a project, then Settings → API
keys, paste the pair into `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`, restart the
runner. Until then the runner records runs in Postgres (LAST RUNS and the cost ticker
work) but writes no Langfuse spans.

## Contracts touched

None. No contract file changed. `comms/contracts/api-contracts.md` is unaffected — every
route keeps its documented shape; some of them simply have a database behind them now.

## Deliberately not done

1. **`tailscale` not started, and `TS_AUTHKEY` left blank.** It needs a key only the
   human can mint. `TLS_MODE=internal` and `TAILSCALE_IP=127.0.0.1` mean the stack fails
   *closed* (this machine only) rather than open. There is no MagicDNS TLS and no phone
   access until the human supplies the key. That is the correct outcome, not a failure.
2. **`happy` not started.** It needs `HAPPY_MASTER_SECRET` (generated, present) *and*
   an unverified image (`ghcr.io/slopus/happy-server:latest`) that ADR-005 has not yet
   pinned. Its database `happy` is pre-created and waiting. SESSIONS stays dark.
3. **`web`, `runner`, `ofelia`, `caddy` containers not started.** The brief scoped me to
   the core data services. Also: four other agents are live in `apps/web/**` right now
   and `--profile obs` would rebuild the web image under them. The runner runs as a host
   process instead, which is what was already there.
4. **`ofelia` not HUPed** (open ask from `observability-engineer`, ADR-008). It is not
   running, so there is nothing to HUP. It will read the generated
   `[job-run "ops/prune"]` on first start. I verified the endpoint it will call:
   `POST /api/ops/prune` → `{"ok":true,"spansDeleted":0,"runsDeleted":0}` against the
   live database.
5. **Langfuse project retention not set to 90 days** (same open ask). Retention is a
   per-project setting and there is no project yet — creating one requires a human
   account through the UI. Answered on the message.
6. **No fabricated rows.** I did not seed the ledger to make a dashboard light up.
   Standing rule 9: an honest empty state beats a plausible fake one. The ledger is
   empty because zero runs have happened, and zero runs have happened because
   `RUNNER_ANTHROPIC_API_KEY` is blank.
7. **The dev-mode `/api` origin gap is not fixed** — it is `shell-navigation-engineer`'s
   call, filed as a message. See below; this is the one thing still standing between a
   live number and the browser.
8. **The `make_interval` bug in `queries.ts` not fixed.** It is
   `observability-engineer`'s file and outside my boundary. Filed as a blocker.
9. **Penpot containers not stopped.** They are the human's unrelated dev stack, up 5
   weeks, and stopping another project's containers is not mine to do. See Verification.

## Verification

`docker compose -f infra/compose.yaml --env-file .env ps`

```
agnetos-langfuse-1   langfuse/langfuse:2   Up (healthy)   127.0.0.1:3001->3000/tcp
agnetos-postgres-1   postgres:16-alpine    Up (healthy)   127.0.0.1:5433->5432/tcp
```

Databases created by the init script (`postgres` logs): `init: database 'agnetos' ready`,
`init: database 'happy' ready`.

Migrations, via the repo's own entrypoint:

```
Applied: 0001_ops_run_ledger.sql, 0002_app_agent_outputs.sql, 0003_retention.sql
```

`SELECT name, applied_at FROM ops_migrations` returns all three rows. Tables verified
present via `information_schema.tables` (list above).

**The success signal.** `grep -c "observability is not up" runner.log` → `0`. That
warning fires whenever `createObservability()` throws; it does not fire now.

Three independent confirmations that the attachment is real, not just a quiet log:

1. `pg_stat_activity` on database `agnetos` shows a live idle connection from
   `172.19.0.1` — the runner's pool.
2. `register-metrics.ts:41` returns **503 `metrics_unavailable`** for every metrics route
   when `db` is null. `/api/metrics/live`, `/api/metrics/status`, `/api/metrics/activity`
   and `/api/metrics/query` all now return **200** with real payloads. That is only
   reachable with a non-null pool.
3. `POST /api/ops/prune` executed the `ops.prune` function against the live database and
   returned real counts.

Endpoint sweep (`127.0.0.1:8787`):

| Endpoint | Result |
|---|---|
| `/api/cost/today` | `{"usd":null,"runs":0,"unpricedRuns":0,"timezone":"Asia/Riyadh"}` — honest empty; `null`, not a fake `$0.00` |
| `/api/metrics/live` | `{"live":0,"liveAgents":[],"byDepartment":{},"failing":0}` |
| `/api/metrics/status` | `{"agents":[],"thresholds":{…}}` |
| `/api/metrics/activity` | `{"items":[]}` |
| `/api/metrics/query?metric=runs` | `{"value":0,"runs":0,"previous":0}` — a real zero from a real query |
| `/api/metrics/query?metric=cost\|latency_p50\|error_rate` | 200, `value:null`, honest |
| `/api/metrics/runs?limit=5` | **FAILS** — see below |

**Bind address (§3.6).** `node infra/check-bind.mjs` → exit **1**, 14 violations, **all
of them Penpot**. Every AgnetOS binding is clean:

```
ok   running  agnetos-langfuse-1   127.0.0.1:3001/tcp  (loopback)
ok   running  agnetos-postgres-1   127.0.0.1:5433/tcp  (loopback)
ok   compose  caddy/happy/langfuse/postgres/runner/web — 8 declared ports, all loopback
```

The 14 failures are `penpot-devenv-ws0-main` (4401, 4403, 14181, 14182),
`penpotdev-infra-mailer-1` (1080) and `penpotdev-infra-ldap-1` (10389, 10636) — a
different project, `Up 5 weeks`, publishing on `0.0.0.0`. The checker deliberately probes
*every* container on the host (see its comment at line 49), so this is the check working
as designed, not a false positive. **The human must stop those containers** for the check
to exit 0; I did not, because they are not this project's and stopping them is
destructive. I also moved the runner from `*:8787` to `127.0.0.1:8787` — it had been
started with the default `RUNNER_HOST=0.0.0.0`, a public bind that `check-bind.mjs`
cannot see because it inspects containers, not host processes.

**One real bug found, and it could only be found this way.** `/api/metrics/runs` — the
LAST RUNS endpoint — fails against a real Postgres:

```
function make_interval(hours => double precision) does not exist
```

`apps/runner/src/db/queries.ts:238` casts `$4::float8` into
`make_interval(hours => $4)`. In Postgres 16 only `make_interval`'s `secs` argument is
`double precision`; `hours` is `int`. Postgres resolves the function signature at parse
time, so this throws **even when the parameter is NULL** — the endpoint is broken
unconditionally, not just when `?hours=` is passed. Reproduced directly:
`SELECT make_interval(hours => 24::double precision)` errors; `24::int` returns
`24:00:00`. Lines 83–84, 338, 350, 382 and 395 use the same helper and did not throw on
the routes I exercised, but they take the same shape and warrant the same audit. This is
exactly the class of defect that a valid-but-never-started compose file hides: it is
invisible to `docker compose config`, invisible to unit tests with a stubbed `DbClient`,
and unmissable the first second a real database answers. Filed to
`observability-engineer`; not fixed here (their file, my boundary).

**The number does not reach the browser yet, and it is not the data plane's fault.**
`apps/web/src/components/shell/useEndpoint.ts:47` fetches `/api/cost/today` as a
*same-origin relative URL*. That is correct by design — Part V has Caddy serve `/` and
`/api` from one origin. But the dev web server on `:4321` is bare `next dev` with no
Caddy and no `rewrites()` in `next.config.mjs`, so `/api/*` hits Next itself and returns
the HTML 404 page; `useEndpoint` correctly reports `unavailable` and the ticker renders
"NO COST DATA". Confirmed: `curl localhost:4321/api/cost/today` → HTML;
`curl 127.0.0.1:8787/api/cost/today` → live JSON. Filed to `shell-navigation-engineer`.

## What the human must supply

Nothing below can be generated on this side. Each line says exactly what stays dark.

| Env var | Where to get it | Dark until then |
|---|---|---|
| `RUNNER_ANTHROPIC_API_KEY` | Anthropic Console → **new dedicated workspace** → set a hard monthly cap on that workspace → issue the key inside it. Not a personal key, not the Claude subscription (Part V billing split). | `/api/status` reports `runnerConfigured:false`. No run can execute, so the ledger stays empty and every dashboard stays honestly empty. **This is the one that unblocks real numbers.** |
| `TS_AUTHKEY` | <https://login.tailscale.com/admin/settings/keys> — reusable, tagged, revocable. Then set `TAILSCALE_IP` (`tailscale ip -4`), `CC_HOST`, `TRACES_HOST`, `TLS_MODE=tailscale`, and run `--profile tls`. | No mesh, no MagicDNS TLS, no phone PWA. Stack is loopback-only on this machine. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | "Notify this phone" reports push is unconfigured (Part VII.3). No push notifications. |
| `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` | <http://127.0.0.1:3001> → sign up → create project → Settings → API keys. Then set `LANGFUSE_SIGNUP_DISABLED=true`. | Runs are recorded in Postgres and LAST RUNS / the cost ticker work, but no Langfuse spans are written and drawer trace links are absent. |

Two more human actions, not env vars:

- **Stop the Penpot containers** (`penpot-devenv-ws0-main`, `penpotdev-infra-mailer-1`,
  `penpotdev-infra-ldap-1`) or accept that `check-bind.mjs` exits 1. They publish on
  `0.0.0.0`; §3.6's "no auth because unreachable" claim is false while they run.
- **Copy `BACKUP_PASSPHRASE` out of `.env` into a password manager.** Losing it loses the
  encrypted backups, which is the point (Part VII.4, `infra/BACKUP.md`).

## Next agent

- `observability-engineer` — read `comms/inbox/observability-engineer/20260816-1147-infra-compose-engineer-make-interval-bug.md`
  first. `/api/metrics/runs` is the LAST RUNS endpoint and it is down against a real
  database. There is now a live Postgres to test against; the fix is one cast.
- `shell-navigation-engineer` — read `comms/inbox/shell-navigation-engineer/20260816-1147-infra-compose-engineer-dev-api-origin.md`.
  A dev-only `rewrites()` is the smallest thing standing between a live number and the
  browser.
- `fidelity-qa-reviewer` — the honest empty states are now backed by a real empty ledger
  rather than a missing one. The distinction matters for the acceptance gate.
