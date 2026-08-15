---
agent: infra-compose-engineer
milestone: M0
spec: PART V (cites §3.1, §3.2, §3.5, §3.6, PART IV, PART VII.4)
created: 2026-08-15T19:45
updated: 2026-08-15T22:29
status: done
---

# M0 — Foundations: the stack, and how the other twelve run it

**Read this section if you read nothing else.** Two commands and a table.

```powershell
Copy-Item .env.example .env          # then edit nothing — the defaults boot
docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build
```

```sh
cp .env.example .env                 # bash / Git Bash
docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build
```

That gives you `web` on <http://127.0.0.1:3000> and `runner` on <http://127.0.0.1:8787>,
and nothing else — which is the point (M0 deliverable 3: front-end agents are not blocked
on Langfuse, Postgres, a relay image or a Tailscale key).

**This session (FAIL correction):** `web` currently fails `next build` on product-code
errors in `dashboards/` and `map/` (not infra). `--profile dev` therefore starts
**runner only** until those owners compile. Runner is up on `127.0.0.1:8787`.

## Your service's URL

| You are | Your service | Local (profile) | Through Caddy, on the tailnet |
|---|---|---|---|
| `shell-navigation-engineer`, `map-galaxy-engineer`, `drawer-engineer`, `chart-matrix-engineer`, `dashboards-engineer`, `design-system-guardian` | web | `http://127.0.0.1:3000` (`dev`) | `https://{CC_HOST}/` |
| `runner-engineer` | runner | `http://127.0.0.1:8787` (`dev`) | `https://{CC_HOST}/api/*` |
| `map-galaxy-engineer` (watcher deltas) | runner WS | `ws://127.0.0.1:8787` (`dev`) | `wss://{CC_HOST}/ws/*` |
| `observability-engineer` | langfuse | `http://127.0.0.1:3001` (`obs`) | `https://{TRACES_HOST}/` — `/traces` redirects there |
| `observability-engineer` | postgres | `127.0.0.1:5433` (`obs`) | not proxied — go through the app |
| `sessions-relay-engineer` | happy | `http://127.0.0.1:3005` (`full`) | `https://{CC_HOST}/relay/*` (prefix stripped) |
| `agent-library-curator` | — | `agents/` is a `:ro` mount at `/agents` in both apps | — |

Server-to-server, on the compose network `agnetos_cc`, never through Caddy:
`web:3000` · `runner:8787` · `happy:3005` · `langfuse:3000` · `postgres:5432`.

Three profiles: `dev` (web + runner) · `obs` (dev + postgres + langfuse + ofelia + caddy) ·
`full` (obs + happy). Plus `tls` (the tailscale service). **`up` with no profile starts
nothing** — booting six services should be a sentence you meant to type.

## What changed this session (FAIL findings)

1. **REQ-INF-25/28 live probe.** Docker Desktop is up. The daemon SKIP is gone.
   `agnetos-runner-1` publishes `127.0.0.1:8787`. Human stopped the host leftover
   (`penpotdev-infra-mailer-1`). `node infra/check-bind.mjs` now **exits 0** — all
   ok / no public listeners. Finding 1 remainder CLOSED.
2. **REQ-INF-39.** `CC_HOST: ${CC_HOST:-localhost}` is on the `tailscale` service
   `environment:` (the MagicDNS FQDN `tailscale cert` needs — not `TS_HOSTNAME`).
   Resolved config: `CC_HOST=agnetos.tailXXXX.ts.net`.
3. **Happy healthcheck.** Closed. Probe is `GET /health` as named by
   `sessions-relay-engineer` (unauthenticated; 503 if Postgres is down). Metrics
   port 9090 unused.
4. **Web env (FYI, cheap).** `HAPPY_RELAY_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `PUSH_SUBSCRIPTIONS_PATH` on `web`, plus named local volume
   `web_push` at `/data`. No decryption key on any service.

## What exists now

```
infra/compose.yaml              all six Part V services + postgres + tailscale, 3+1 profiles
infra/Caddyfile                 / → web · /api → runner · /traces → langfuse · /relay → happy
infra/caddy/tls/internal.caddy  TLS_MODE=internal — Caddy's own CA, zero secrets (default)
infra/caddy/tls/tailscale.caddy TLS_MODE=tailscale — the real MagicDNS cert
infra/check-bind.mjs            §3.6 proof: no public listener, asked of Docker not of YAML
infra/web.Dockerfile            Next.js standalone, non-root, repo-root context; /data for push
infra/runner.Dockerfile         Node + git + ca-certificates, non-root, repo-root context
infra/ofelia/config.ini         GENERATED-file contract + the exact job shape, no live job
infra/BACKUP.md                 encrypted pg_dumpall + restore, entirely in containers
.env.example                    every key compose interpolates, documented
.dockerignore .gitattributes    build-context hygiene · LF for anything a container runs
.github/workflows/ci.yml        token grep → verify → typecheck → lint | compose + bind
comms/specs/infrastructure.md   PART V, 75 atomic REQ-INF- rows
comms/decisions/ADR-002-repo-shape.md   the M0 open question, answered
```

Repo skeleton (ADR-002): `apps/web` · `apps/runner` · `packages/contracts` · `agents/` ·
`company/` · `panels/` · `audit/` · `scripts/` · `comms/` · `backups/`, one root lockfile.

## How to use it

**Add an env var.** Document it in `.env.example` under the right numbered section, then
reference it in `compose.yaml` as `${NAME:-safe-default}`. A key in compose that is not in
`.env.example` is a bug. The default must fail *closed*.

**Change an image tag.** Edit `.env`, not `compose.yaml`. Every image is
`${SOMETHING_IMAGE:-pinned-default}` for exactly this reason — `sessions-relay-engineer`
can swap the relay at M4 without touching a file I own.

**Read the agent library.** It is at `/agents` inside both `web` and `runner`, mounted
`:ro`. The watcher reads it; the only writer is the runner's git path at `/repo`, bounded
by `REPO_WRITE_ROOT=/repo/agents`. If you find yourself wanting to write to `/agents`
directly, that is the constraint working, not a mount misconfiguration.

**Before you claim anything is done:** `npm run verify` and `node infra/check-bind.mjs`.
`verify` does not run the bind check (CI's `infra` job does). A SKIP on an unreachable
daemon is still exit 0 — REQ-INF-28 asks for a loud SKIP, not a silent pass. That was
not changed.

## Contracts touched

None changed. `infra/` consumes four and owns none:

- `contracts/api-contracts.md` (`runner-engineer`) — Caddy passes `/api/*` through
  **unstripped** because the contract declares full paths. Do not add `handle_path` there.
- `contracts/frontmatter-schema.md` (`agent-library-curator`) — the `schedule:` field is
  the sole source of ofelia jobs.
- ADR-002 (mine, accepted) — repo shape. This closed the BOARD's open M0 question.
- ADR-005 (`sessions-relay-engineer`, **accepted**) — Happy, not Omnara. Compose still
  reads `HAPPY_IMAGE`. The healthcheck path is still theirs to name.

## Deliberately not done

- **The real tailnet.** `TLS_MODE=internal` and `TS_AUTHKEY=` empty ship today, so the
  stack boots and binds correctly on loopback with zero secrets. Joining the mesh needs
  credentials no agent should hold. The human runs the walkthrough below once.
- **Automated backups.** `infra/BACKUP.md` documents an encrypted dump and a restore, both
  container-only. Nothing fires them. Which image, what retention, where the ciphertext
  goes and who holds the passphrase are four real decisions that belong with M7's schedule
  work. A cron that silently produced unencrypted or unrestorable files would be worse than
  a documented manual procedure. **Automate and test a restore before any client data
  touches this stack.** An untested backup is a belief.
- **`scripts/sync-ofelia.mjs`.** The generated-file contract, the emitted job shape and the
  reload trigger are written into `infra/ofelia/config.ini`. The generator is
  `runner-engineer`'s at M7 because it must run in the same transaction as the frontmatter
  commit that causes it. Two writers for one file is worse than a later file.
- **An ofelia drift check.** "A job in the config but not in frontmatter is a bug" is today
  enforced only by the file being wholly regenerated — true once the generator exists.
  Until then it is a comment, and comments are not checks. REQ-INF-71.
- **A verified `happy` healthcheck.** Done this session. Probe is `GET /health`
  (named by `sessions-relay-engineer`; unauthenticated; 503 if Postgres is down).
  Metrics port 9090 unused.
- **Langfuse v3.** Part V describes "langfuse + postgres". v3 needs ClickHouse, Redis and
  S3/MinIO — three more services to keep local under Part VII.4. That is an ADR, not an
  image bump.
- **Resource limits.** Compose honours `deploy.resources` only partially without Swarm, and
  a guessed memory ceiling produces OOM kills that read as application bugs. Revisit at M3
  with real numbers.
- **A VPS overlay.** Portability is *respected* — no absolute host paths, no host tools,
  every mount relative to the compose file — but respected is not proven. Proof needs a
  second host; inventing `compose.vps.yaml` now would produce an untested file that reads
  as tested.
- **Secret management beyond a gitignored `.env`.** No vault, no SOPS, no Docker secrets.
  One tailnet-only host, one operator: a 0600 file is the honest boundary. More would imply
  a threat model nobody has written down.
- **`--profile dev` web image.** `next build` fails on `dashboards/data/use-resolved.ts`
  (JSX parse) and missing `map/` imports (`motion`, `drawer/events`, `lib/shell-bus`).
  Those files are not infra. Runner is up; web is not.
- **ADR-008 nightly `ops.prune()` ofelia job.** Function is SQL; `config.ini` is
  frontmatter-generated. Observability names the invoke path; infra mounts it in
  compose. Not M7.

## Verification

What I ran this session, and what it printed:

```
$ docker info --format "{{.ServerVersion}}"                   → 29.2.0
$ docker compose -f infra/compose.yaml --env-file .env config --quiet
                                                              → exit 0
$ docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build
    web: next build FAILED (dashboards JSX + map missing modules) — not infra
    runner: built and started  127.0.0.1:8787->8787/tcp
$ node infra/check-bind.mjs                                   → exit 0
    ok   running  agnetos-runner-1         127.0.0.1:8787/tcp  (loopback)
    ok   compose caddy/happy/langfuse/postgres/runner/web — 8 ports, all loopback
    8 declared + 1 running port(s) bound to loopback or the tailnet. No public listeners.
$ docker compose --profile tls config  → tailscale.environment.CC_HOST=agnetos.tailXXXX.ts.net
```

SKIP-as-non-zero was **not** done: REQ-INF-28 asks for a loud SKIP, not a failing one, and
`npm run verify` does not invoke this script.

**The walkthrough the human runs once, on the real machine** (M0 deliverable 1 — no YAML
proves a phone can reach anything):

1. `tailscale ip -4` → put it in `.env` as `TAILSCALE_IP`. Never `0.0.0.0`.
2. `tailscale status` → take the MagicDNS name into `CC_HOST`; add a second name for
   `TRACES_HOST`.
3. Create a reusable, tagged auth key → `TS_AUTHKEY`. Set `TLS_MODE=tailscale`.
4. `docker compose -f infra/compose.yaml --env-file .env --profile tls --profile obs up -d --build`
5. **`node infra/check-bind.mjs`** — with the daemon up this inspects every running
   container, not just this project's. It must print `ok`, never `SKIP`, and must not
   FAIL a leftover public bind.
6. From the phone, on the tailnet: `https://{CC_HOST}/` → install the PWA.
7. `docker compose exec runner sh -c 'touch /agents/x'` must fail read-only. Asserting the
   `:ro` string in YAML is not the same test.

## Next agent

`fidelity-qa-reviewer` for overall M0 / PART V PASS
(`comms/inbox/fidelity-qa-reviewer/20260815-2224-infra-compose-engineer-m0-final.md`).
Findings 1–3 all closed. Web image build remains a product-code issue, not infra.

- `map-galaxy-engineer` / `dashboards-engineer` — web image will not build until the
  JSX parse and missing imports above compile.
- `sessions-relay-engineer` — `HAPPY_RELAY_URL` / VAPID / `web_push` are on the `web`
  service. Healthcheck is `GET /health`. No decryption key was added.
- `observability-engineer` — ADR-008 accepted; name how ofelia should invoke
  `ops.prune()` (not a frontmatter schedule row).
- `runner-engineer` (M3) — `REPO_WRITE_ROOT=/repo/agents` is wired and waiting for the
  path check that enforces it. `infra/ofelia/config.ini` documents the exact job shape
  your M7 generator must emit.
