---
agent: infra-compose-engineer
milestone: M0
spec: PART V (cites §3.1, §3.2, §3.5, §3.6, PART IV, PART VII.4)
created: 2026-08-15T19:45
status: ready-for-review
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

## What exists now

```
infra/compose.yaml              all six Part V services + postgres + tailscale, 3+1 profiles
infra/Caddyfile                 / → web · /api → runner · /traces → langfuse · /relay → happy
infra/caddy/tls/internal.caddy  TLS_MODE=internal — Caddy's own CA, zero secrets (default)
infra/caddy/tls/tailscale.caddy TLS_MODE=tailscale — the real MagicDNS cert
infra/check-bind.mjs            §3.6 proof: no public listener, asked of Docker not of YAML
infra/web.Dockerfile            Next.js standalone, non-root, repo-root context
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

## Contracts touched

None changed. `infra/` consumes four and owns none:

- `contracts/api-contracts.md` (`runner-engineer`) — Caddy passes `/api/*` through
  **unstripped** because the contract declares full paths. Do not add `handle_path` there.
- `contracts/frontmatter-schema.md` (`agent-library-curator`) — the `schedule:` field is
  the sole source of ofelia jobs.
- ADR-002 (mine, accepted) — repo shape. This closed the BOARD's open M0 question.
- ADR-005 (`sessions-relay-engineer`, open) — compose reads `HAPPY_IMAGE` so the M4
  decision costs no edit here.

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
- **A verified `happy` healthcheck.** It probes `/`; the relay's real health path is unknown
  until ADR-005. A probe that always passes would be worse than one that is sometimes
  wrong. `sessions-relay-engineer` owns correcting it.
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
- **Docker Desktop was not running during this session**, so the bind check's
  running-container probe reported `SKIP`, not `ok`. The declared-port lint passed. See
  Verification — this is the one gap the human must close on the real host.

## Verification

What I ran, and what it printed:

```
$ docker compose -f infra/compose.yaml config --quiet        → exit 0
$ node scripts/check-comms.mjs                                → exit 0
    roster agents 14 · inbox messages 3 · contracts 5 · decisions 7
$ node scripts/check-spec-coverage.mjs
    spec sections 27 (15 claimed) · requirements 261 · implemented 255 (98%)
    declared, unbuilt 6                                       → PART V no longer unclaimed
$ node infra/check-bind.mjs                                   → exit 0
    SKIP running-container probe — docker daemon not reachable
    ok compose caddy/happy/langfuse/postgres/runner/web — 8 ports, all loopback
```

`check-spec-coverage.mjs` still exits 1, on eight sections owned by other agents (§2.0,
§2.1, §2.4, §2.5, §2.7, §3.1, §3.5, §3.6, PART II, PART III, PART VI, PART VII). **PART V
is claimed and every path this spec cites resolves** — the row that was mine is clear.

I also fixed a syntax error that made `scripts/check-spec-coverage.mjs` fail to parse at
all: a doc comment contained the literal `*/` inside a regex example, closing the block
early. One-line fix, no behaviour change; `commandcenter-orchestrator` should know it
happened.

**The walkthrough the human runs once, on the real machine** (M0 deliverable 1 — no YAML
proves a phone can reach anything):

1. `tailscale ip -4` → put it in `.env` as `TAILSCALE_IP`. Never `0.0.0.0`.
2. `tailscale status` → take the MagicDNS name into `CC_HOST`; add a second name for
   `TRACES_HOST`.
3. Create a reusable, tagged auth key → `TS_AUTHKEY`. Set `TLS_MODE=tailscale`.
4. `docker compose -f infra/compose.yaml --env-file .env --profile tls --profile obs up -d --build`
5. **`node infra/check-bind.mjs`** — with the daemon up this inspects every running
   container, not just this project's. It must print `ok`, never `SKIP`.
6. From the phone, on the tailnet: `https://{CC_HOST}/` → install the PWA.
7. `docker compose exec runner sh -c 'touch /agents/x'` must fail read-only. Asserting the
   `:ro` string in YAML is not the same test.

## Next agent

`fidelity-qa-reviewer` for the M0 gate. Then, in parallel:

- `map-galaxy-engineer` (M1 lead) — start with `--profile dev`; read the URL table above
  and `comms/specs/infrastructure.md` § "Interfaces we expose".
- `sessions-relay-engineer` (M4, only needs M0) — read Decision 7 in
  `comms/specs/infrastructure.md` before touching `/api`: route order in the Caddyfile is
  load-bearing and a mistake there shows up as a 404 on the phone, not an error in the
  proxy. Your first task is ADR-005; `HAPPY_IMAGE` and the healthcheck are yours after.
- `runner-engineer` (M3) — `REPO_WRITE_ROOT=/repo/agents` is wired and waiting for the path
  check that enforces it. `infra/ofelia/config.ini` documents the exact job shape your M7
  generator must emit.
