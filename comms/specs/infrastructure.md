# Spec — infrastructure, compose, and the tailnet edge

> The implementation spec for PART V of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`infra-compose-engineer`

## Spec sections covered

PART V — ARCHITECTURE & COMPOSE: the six-service topology, the Tailscale/MagicDNS access
model, the Caddy edge, the ofelia cron path, the billing split, and the portability rule
("Docker on your machine — later: identical compose on a VPS").

That is the whole claim, and deliberately so.

## Boundaries — sections this spec cites but does not own

The coverage rows below cite other agents' sections, because a container is the delivery
mechanism for somebody else's feature. Citing is not claiming; each of these stays owned by
the agent BOARD.md names, and each of them still owes their own spec:

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| 3.6 | `shell-navigation-engineer` | the bind address and the proof it holds | the PWA, and everything that assumes tailnet-only |
| 3.1 | `sessions-relay-engineer` | the relay *container* and its route | the E2E protocol and the client-side keys |
| 3.2 | `runner-engineer` | the ofelia→runner wiring and the generated-file contract | run semantics, the allowlist, the git path check |
| 3.5 | `observability-engineer` | the Langfuse and Postgres *containers* | instrumentation, redaction, the cost ticker |
| VII.4 | `rtl-arabic-pdpl-specialist` | volume locality and the backup procedure | PDPL policy and what counts as egress |
| IV | `agent-library-curator` | the read-only mount and the CI validation step | the frontmatter schema itself |
| I | `design-system-guardian` | the CI token grep | the tokens |

Part V also names the frontend stack (Next.js + Tailwind + D3 + Framer Motion + `@fontsource`,
no component library). That is a **dependency set**, enforced by `design-system-guardian` and
BOARD constraint 2 — this spec only guarantees the images those choices are built into.

## Decisions

1. **Monorepo, npm workspaces** — [ADR-002](../decisions/ADR-002-repo-shape.md), accepted.
   `apps/web` + `apps/runner` + `packages/contracts`, one root lockfile. This resolved the
   BOARD's open M0 question. Both Dockerfiles therefore use the **repo root** as build
   context, which is why they live in `infra/` next to the compose file that builds them
   rather than beside their apps.

2. **Three profiles, and `up` with no profile starts nothing.**
   `dev` = web + runner (M0 deliverable 3 — front-end agents are not blocked on the full
   stack). `obs` = dev + postgres + langfuse + ofelia + caddy. `full` = obs + happy.
   `happy` is split out on its own because the relay image is unverified until ADR-005 lands
   at M4; a bad pull must not take the other five services down with it. Booting six
   services should be a sentence you meant to type.

3. **The bind address is the entire security model, and it is verified by asking Docker.**
   §3.6 says the app has no auth in v1 *because* it is unreachable off the tailnet. That
   sentence is false the moment a port binds `0.0.0.0`. `infra/check-bind.mjs` therefore
   inspects **every running container on the host** (`docker ps`, not `docker compose ps`) —
   a leftover container from an older config, a different project name, or a hand-typed
   `docker run` is exactly the case compose labels would hide. It also lints the *resolved*
   compose config, because every bind address in the file is a `${VAR:-default}` and a
   literal-only checker would pass a file whose variables expand to `0.0.0.0`.
   When the daemon is unreachable the script says `SKIP` loudly instead of quietly passing.

4. **Fail closed, not open.** `TAILSCALE_IP` defaults to `127.0.0.1`, not to `0.0.0.0`, so a
   fresh clone with no `.env` is reachable from this machine only. Every fallback in the
   file was chosen the same way: a missing secret produces a service that refuses or a port
   that is loopback — never a service that is open.

5. **No `bind` directive in the Caddyfile.** Caddy must listen on all interfaces inside its
   own container namespace; that is unavoidable and harmless. Writing `bind` there would
   *look* like the protection while providing none, which is worse than nothing. The
   published-port bind address in `compose.yaml` is the only thing that decides reachability,
   and the Caddyfile says so at the top.

6. **`/traces` redirects to a second MagicDNS hostname** rather than reverse-proxying a
   subpath — [ADR-006](../decisions/ADR-006-deterministic-force-engine.md) records the
   underlying constraint: Langfuse is a Next.js app with no `basePath`, so its absolute
   `/_next/*` assets would collide with web's. An honest redirect beats a rewrite that
   half-works.

7. **`/api` has two owners and order is load-bearing.** `handle /api/sessions*` and
   `handle /api/push*` are matched *before* `handle /api/*`, because ADR-005 serves the
   §3.1 routes from `web` as a credential-free proxy while `runner` owns §3.2/§3.3. Moving
   those two blocks below the general rule silently hands the session routes to a service
   with no relay code, and the symptom is a 404 on the phone — not an error here.

8. **Langfuse pinned to v2.** Part V describes a "langfuse + postgres" topology. v3 adds
   ClickHouse, Redis and S3/MinIO — three more services and three more volumes to keep local
   under Part VII.4. Moving to v3 is an ADR, not an image bump.

9. **Tailscale is a compose service, not a host install.** The portability rule says nothing
   may depend on this machine. A host-installed `tailscaled` would make the VPS deploy a
   different procedure. It sits in its own `tls` profile so the default `TLS_MODE=internal`
   boots with zero secrets and nobody is blocked on an auth key.

10. **The billing split is enforced by variable name.** The runner's container receives
    `ANTHROPIC_API_KEY` from `RUNNER_ANTHROPIC_API_KEY` — a key issued inside a dedicated,
    hard-capped Console workspace. The human's Claude subscription is deliberately absent
    from `.env.example`; sessions authenticate through the CLI that Happy wraps, on the
    machine running it. If a runaway scheduled agent could spend the subscription, it would
    take out the interactive sessions you need to fix it.

11. **`ofelia/config.ini` is generated and says so in its first line.** Frontmatter is the
    source of truth (§3.2, BOARD constraint 4). The committed file contains one *commented*
    example job and no live job, because `agents/` has no scheduled agent yet and a job that
    actually fired would put a fake number in the run history (CLAUDE.md rule 9).

12. **Line endings are a correctness issue on this project.** The human develops on Windows
    11. `.gitattributes` forces LF on everything a Linux container executes or parses; CRLF
    on a shebang produces "no such file or directory", the single most confusing
    Windows/Docker failure there is.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-INF-01 | PART V | One compose file defines all six Part V services — `web` `runner` `happy` `langfuse` `ofelia` `caddy` — plus the `postgres` Langfuse and Happy depend on | `infra/compose.yaml` | `.github/workflows/ci.yml` |
| REQ-INF-02 | PART V | Nothing exists outside compose: no manually-created container and no host-installed tool is required to run the stack | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-03 | PART V | Every volume and build context is a path relative to the compose file; no absolute host path appears anywhere | `infra/compose.yaml` | `.github/workflows/ci.yml` |
| REQ-INF-04 | PART V | `web` is built from the repo root as a Next.js standalone bundle that carries its own traced `node_modules` | `infra/web.Dockerfile` | `.github/workflows/ci.yml` |
| REQ-INF-05 | PART V | `runner` image ships `git` (needed for §3.2 schedule commits) and `ca-certificates` (outbound TLS to the Anthropic API) | `infra/runner.Dockerfile` | manual — see Test plan |
| REQ-INF-06 | PART V | Both app images run as a non-root user (`nextjs` / `runner`, uid 1001) | `infra/web.Dockerfile` · `infra/runner.Dockerfile` | manual — see Test plan |
| REQ-INF-07 | PART V | `web` `runner` `postgres` `langfuse` `happy` `caddy` each declare a healthcheck with an interval, a timeout, retries and a start period | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-08 | PART V | `ofelia` declares **no** healthcheck, and the file says why — the image has no HTTP surface, and a probe that cannot fail is a lie | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-09 | PART V | `--profile dev` starts `web` + `runner` alone, so front-end agents are not blocked on the full stack | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-10 | PART V | `docker compose up` with no profile starts nothing | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-11 | PART V | `happy` is confined to the `full` profile so an unverified relay image cannot take the rest of the stack down (Decision 2) | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-12 | PART V | `langfuse` waits for `postgres` to be **healthy**, and `caddy` waits for `web` and `runner` to be healthy — not merely started | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-13 | PART V | `../agents` is mounted **`:ro`** into `runner` | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-14 | PART V | `../agents` is mounted **`:ro`** into `web`; `web` projects agent data and never owns or writes it | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-15 | PART V | `../company` and `../panels` are read-only in both `web` and `runner` for the same reason | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-16 | §3.2 | The runner's only writable view of the repo is `/repo`, and `REPO_WRITE_ROOT=/repo/agents` names the one subtree its git path may touch | `infra/compose.yaml` | manual — coordinated with `runner-engineer`  |
| REQ-INF-17 | §3.2 | Per-run scratch workspaces are a named volume (`runner_workspaces`), never the repo checkout | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-18 | PART VII | The Langfuse Postgres volume is **named, `driver: local`** — not a bind mount to a host path and not a cloud volume driver | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-19 | PART VII | Every other volume (`happy_data` `caddy_data` `caddy_config` `ts_state` `ts_certs` `runner_workspaces`) is likewise named and local, so a `docker volume ls` is the complete inventory | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-20 | PART VII | An encrypted `pg_dumpall` procedure is documented, runs entirely inside containers (nothing installed on the host), and states its restore path | `infra/BACKUP.md` | manual — see Test plan |
| REQ-INF-21 | PART VII | `backups/` ignores its own contents, so a dump can never be committed by accident — not even an encrypted one | `backups/.gitignore` | manual — see Test plan |
| REQ-INF-22 | PART VII | Langfuse telemetry is off and experimental features are off; no trace data leaves the box | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-23 | §3.6 | `caddy` is the **only** service published on a tailnet-reachable address; web, runner, postgres, langfuse and happy publish to `${DEV_BIND_ADDR:-127.0.0.1}` as a developer convenience | `infra/compose.yaml` | `infra/check-bind.mjs` |
| REQ-INF-24 | §3.6 | Caddy's ports are written `${TAILSCALE_IP:-127.0.0.1}:...`, so an absent `.env` fails **closed** to loopback rather than open to every interface | `infra/compose.yaml` | `infra/check-bind.mjs` |
| REQ-INF-25 | §3.6 | The bind check inspects every **running container on the host**, not just this compose project — a leftover or hand-started container is precisely the case project labels hide | `infra/check-bind.mjs` | `.github/workflows/ci.yml` |
| REQ-INF-26 | §3.6 | The bind check lints the **resolved** compose config across all profiles, so a `${VAR}` that expands to `0.0.0.0` is caught | `infra/check-bind.mjs` | `.github/workflows/ci.yml` |
| REQ-INF-27 | §3.6 | A port entry with no bind address at all is a failure, because Docker treats it as `0.0.0.0` | `infra/check-bind.mjs` | `.github/workflows/ci.yml` |
| REQ-INF-28 | §3.6 | An unreachable Docker daemon reports `SKIP` loudly rather than passing silently | `infra/check-bind.mjs` | manual — see Test plan |
| REQ-INF-29 | §3.6 | The Caddyfile contains no `bind` directive and explains why one would be security theatre (Decision 5) | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-30 | §3.6 | Caddy's admin API listens on container-loopback only and exists solely as the healthcheck target | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-31 | PART V | `/` routes to `web` | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-32 | PART V | `/api/*` routes to `runner` **without** stripping the prefix, because `api-contracts.md` declares the routes as `/api/run` etc. | `infra/Caddyfile` | manual — coordinated with `runner-engineer` |
| REQ-INF-33 | PART V | `/traces` redirects to the Langfuse MagicDNS hostname, which this same Caddy serves (Decision 6) | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-34 | PART V | `/relay/*` proxies to `happy` **with** the prefix stripped, because happy-server serves its API at the root | `infra/Caddyfile` | manual — coordinated with `sessions-relay-engineer` |
| REQ-INF-35 | §3.1 | `/api/sessions*` and `/api/push*` are matched **before** `/api/*` and route to `web` (ADR-005, Decision 7) | `infra/Caddyfile` | manual — coordinated with `sessions-relay-engineer` |
| REQ-INF-36 | §3.2 | SSE and WebSocket routes set `flush_interval -1` and minute-scale read timeouts; compression is applied only to the non-streaming handler | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-37 | PART V | `/ws/*` reaches the runner, so the chokidar watcher's layout deltas survive the proxy | `infra/Caddyfile` | manual — coordinated with `map-galaxy-engineer` |
| REQ-INF-38 | PART V | Tailscale mesh membership is a **compose service**, not a host install, so the VPS deploy is the same command (Decision 9) | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-39 | PART V | `TLS_MODE=tailscale` serves the real MagicDNS certificate, written to a shared volume by the `tailscale` service and mounted read-only into Caddy | `infra/caddy/tls/tailscale.caddy` · `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-40 | PART V | `TLS_MODE=internal` is the default and boots with **zero secrets**, so no agent is blocked on a Tailscale auth key | `infra/caddy/tls/internal.caddy` · `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-41 | PART V | Caddy never reaches Let's Encrypt: TLS comes from its internal CA or from Tailscale, honouring BOARD constraint 7 (no external network at runtime) | `infra/Caddyfile` | manual — see Test plan |
| REQ-INF-42 | §3.2 | `ofelia/config.ini` is marked GENERATED in its first line and names its generator, its trigger and its source of truth | `infra/ofelia/config.ini` | manual — see Test plan |
| REQ-INF-43 | §3.2 | The job shape is `job-run` firing `POST /api/run` — the same endpoint the drawer's ▶ Run now button calls, so scheduled and manual runs share one code path | `infra/ofelia/config.ini` | manual — coordinated with `runner-engineer` |
| REQ-INF-44 | §3.2 | The compose network name is pinned to `agnetos_cc` so the generated job spec never has to guess a project-name prefix | `infra/compose.yaml` · `infra/ofelia/config.ini` | manual — see Test plan |
| REQ-INF-45 | §3.2 | The committed config contains no live job — `agents/` has no `schedule:` yet, and a job that fired would put a fake number in the run history | `infra/ofelia/config.ini` | manual — see Test plan |
| REQ-INF-46 | §3.2 | No secret appears in the ofelia config; it is committed, and the runner reads its own key from the environment | `infra/ofelia/config.ini` | manual — see Test plan |
| REQ-INF-47 | PART V | The runner's `ANTHROPIC_API_KEY` is fed from `RUNNER_ANTHROPIC_API_KEY` — a key issued in a dedicated hard-capped Console workspace | `infra/compose.yaml` · `.env.example` | manual — see Test plan |
| REQ-INF-48 | PART V | The human's Claude subscription is **absent** from compose and from `.env.example`, and the file says why adding it would be a design drift | `.env.example` | manual — see Test plan |
| REQ-INF-49 | PART V | `RUNNER_MONTHLY_CAP_USD` gives the runner a self-enforced soft cap beneath the workspace's hard cap, so the failure mode is a readable refusal rather than an invoice | `infra/compose.yaml` · `.env.example` | manual — coordinated with `runner-engineer` |
| REQ-INF-50 | §3.1 | No decryption key for session transcripts exists in compose or `.env.example`, and both files state that adding one would be a design failure | `infra/compose.yaml` · `.env.example` | manual — coordinated with `sessions-relay-engineer` |
| REQ-INF-51 | PART V | `.env.example` documents **every** key the compose file interpolates, with how to generate it and what breaks if it is wrong | `.env.example` | manual — see Test plan |
| REQ-INF-52 | PART V | The real `.env` is gitignored and excluded from every build context, so it can never be readable in image history | `.gitignore` · `.dockerignore` | manual — see Test plan |
| REQ-INF-53 | PART V | Image tags are pinned through env vars set in `.env`, never inline in compose, so an upgrade is a one-line diff in one file | `.env.example` · `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-54 | PART V | Every service caps its json-file logs (10 MB × 3), so a runaway agent cannot fill the disk | `infra/compose.yaml` | manual — see Test plan |
| REQ-INF-55 | PART V | Postgres publishes on host port 5433, so it cannot collide with a Postgres already installed on the machine | `infra/compose.yaml` · `.env.example` | manual — see Test plan |
| REQ-INF-56 | PART V | Repo skeleton exists as ADR-002 specifies: `apps/web` `apps/runner` `packages/contracts` plus `agents/` `company/` `panels/` `audit/` `scripts/` `comms/` | `comms/decisions/ADR-002-repo-shape.md` · `apps/web/package.json` · `apps/runner/package.json` · `packages/contracts/package.json` | `.github/workflows/ci.yml` |
| REQ-INF-57 | PART V | One root lockfile and one npm-workspaces install serve web, runner and contracts, so the two apps cannot drift on a shared dependency | `package.json` · `package-lock.json` | `.github/workflows/ci.yml` |
| REQ-INF-58 | PART V | `agents/` `company/` `panels/` `audit/` all exist and are tracked, so a fresh clone mounts real directories rather than Docker creating empty root-owned ones | `agents/_registry/clusters.json` · `company/COMPANY.md` · `panels/mission-control.json` · `audit/.gitkeep` | manual — see Test plan |
| REQ-INF-59 | PART IV | CI validates agent frontmatter, so a malformed `SKILL.md` fails the build rather than silently vanishing from the MAP | `.github/workflows/ci.yml` · `scripts/validate-frontmatter.mjs` | `.github/workflows/ci.yml` |
| REQ-INF-60 | PART I | CI greps for hex literals outside `tokens.css` — the `cc-fidelity-check` token audit — and runs it first because it is the cheapest and commonest failure | `.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| REQ-INF-61 | PART V | CI typechecks and lints every workspace | `.github/workflows/ci.yml` · `package.json` | `.github/workflows/ci.yml` |
| REQ-INF-62 | PART V | CI proves the compose file parses on a clone with **no** `.env` — the exact state a new agent starts in | `.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| REQ-INF-63 | §3.6 | CI runs the bind check on every push and PR | `.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| REQ-INF-64 | PART V | CI is two parallel jobs capped at 10 and 5 minutes with a warm npm cache and in-progress cancellation, so nobody has a reason to skip it | `.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| REQ-INF-65 | PART V | CI and a local `npm run verify` run the identical gate, so they cannot disagree about what "green" means | `package.json` · `.github/workflows/ci.yml` | `.github/workflows/ci.yml` |
| REQ-INF-66 | PART V | `.gitattributes` forces LF on every file a Linux container executes or parses, and CRLF only on Windows-only helpers | `.gitattributes` | manual — see Test plan |
| REQ-INF-67 | PART V | Every repo script is plain Node ESM invoked as `node <path>`, so it runs identically under PowerShell and bash with no shebang, no `sh`, and no host tool | `scripts/check-comms.mjs` · `infra/check-bind.mjs` | `.github/workflows/ci.yml` |
| REQ-INF-68 | PART V | `.dockerignore` keeps `node_modules`, `.next`, `comms/`, `audit/`, backups and every `.env` out of both build contexts | `.dockerignore` | manual — see Test plan |
| REQ-INF-69 | PART V | The comms channel itself is validated in CI — message frontmatter, contract ownership, ADR status, and a status file per rostered agent | `scripts/check-comms.mjs` · `.github/workflows/ci.yml` | `scripts/__tests__` |
| REQ-INF-70 | §3.2 | `scripts/sync-ofelia.mjs` regenerates `ofelia/config.ini` from frontmatter after a schedule commit and HUPs the container | — | — |
| REQ-INF-71 | §3.2 | A job present in `ofelia/config.ini` but absent from frontmatter fails a check, rather than merely being documented as a bug | — | — |
| REQ-INF-72 | PART VII | The encrypted backup runs on a schedule from a compose service, with a tested restore | — | — |
| REQ-INF-73 | PART V | Tailscale certificates renew automatically before the 90-day expiry rather than on container restart | — | — |
| REQ-INF-74 | PART V | The tailnet path is verified end to end: MagicDNS resolves, the Tailscale cert is trusted, and the PWA installs from the phone | — | — |
| REQ-INF-75 | PART V | A `compose.vps.yaml` overlay proves the portability claim on a second host | — | — |

## Interfaces we expose

**Service URLs on the tailnet** (once `--profile obs` is up). These are what the other
twelve agents build against:

| What | URL through Caddy | Direct, for local debugging |
|---|---|---|
| The app | `https://{CC_HOST}/` | `http://127.0.0.1:3000` |
| Runner API | `https://{CC_HOST}/api/*` | `http://127.0.0.1:8787` |
| Runner WebSocket | `wss://{CC_HOST}/ws/*` | `ws://127.0.0.1:8787` |
| Session relay | `https://{CC_HOST}/relay/*` | `http://127.0.0.1:3005` |
| Langfuse | `https://{TRACES_HOST}/` (`/traces` redirects here) | `http://127.0.0.1:3001` |
| Postgres | not proxied — tailnet clients use the app | `127.0.0.1:5433` |

**Service names on the compose network** `agnetos_cc`, for server-to-server calls that must
not go through Caddy: `web:3000` · `runner:8787` · `happy:3005` · `langfuse:3000` ·
`postgres:5432`.

**Container paths** other agents may rely on: `/agents` `/company` `/panels` (read-only in
both apps) · `/repo` (runner only, writable, `REPO_WRITE_ROOT=/repo/agents`) ·
`/workspaces` (runner per-run scratch) · `/audit` (runner, §3.4 output).

**Environment variable names** are a contract: anything in `.env.example` may be read by the
service it is documented under. Adding a key is a PR to that file, not an inline default.

**Commands**: `npm run verify` (the whole gate) · `node infra/check-bind.mjs` (§3.6) ·
`docker compose -f infra/compose.yaml --env-file .env --profile dev up -d --build`.

## Interfaces we consume

| What | From | Contract |
|---|---|---|
| Route names under `/api` and the SSE content type | `runner-engineer` | `comms/contracts/api-contracts.md` |
| The `schedule:` field and its cron form | `agent-library-curator` | `comms/contracts/frontmatter-schema.md` |
| Which relay image and which `/relay` shape | `sessions-relay-engineer` | ADR-005 (open at M4) — compose reads `HAPPY_IMAGE` so the swap costs no edit here |
| Langfuse project keys and the trace endpoint | `observability-engineer` | `.env.example` §4 |
| Repo shape | this spec | `comms/decisions/ADR-002-repo-shape.md` |
| The department taxonomy that shapes `agents/**` | `agent-library-curator` | `comms/decisions/ADR-001-department-taxonomy.md` |

## Test plan

- **Static, in CI, every push** — compose parses with no `.env` (`config --quiet`); the bind
  check lints resolved port specs across all profiles; frontmatter, panels, tokens, comms
  and spec coverage validate; typecheck; lint; the hex-literal grep.
- **Runtime, on a host with the daemon up** — `node infra/check-bind.mjs` additionally
  inspects every running container. This is the check that matters and it is the one CI
  *cannot* fully perform, since CI has no running stack. It must be run on the real host
  before anything is called done.
- **Read-only mounts** — `docker compose exec runner sh -c 'touch /agents/x'` must fail with
  a read-only filesystem error. Asserting the `:ro` string in YAML is not the same test.
- **Profiles** — `--profile dev` brings up exactly two containers; bare `up` brings up zero.
- **Healthchecks** — `docker compose ps` shows `healthy`, not merely `running`, for all six.
- **Not automatable at M0, and how it gets checked instead:**
  - REQ-INF-38/39/74 (real Tailscale mesh, MagicDNS TLS, phone install) need a real
    `TS_AUTHKEY` and a real tailnet. They are a scripted manual walkthrough in the handoff,
    run by the human on the actual machine. No amount of YAML proves a phone can reach it.
  - REQ-INF-20 (the backup) is a documented procedure, not a job — see `infra/BACKUP.md`.
    It is verified by performing one restore, which has not happened yet.
  - REQ-INF-16/32/43/49 cross a boundary into `runner-engineer`'s code. This spec guarantees
    the wiring; the enforcement (path check, allowlist, cap) is verified by their tests.
- **Windows** — every script is run under PowerShell 7 and Git Bash before it is committed,
  because "works on my shell" is how a cross-platform repo quietly becomes single-platform.

## Deliberately not done

- **Automated, scheduled backups.** `infra/BACKUP.md` documents the encrypted dump and the
  restore, and both run entirely in containers — but nothing fires them. Automating means
  answering four real questions (which image, what retention, where the ciphertext lands,
  who holds the passphrase), and that belongs with the rest of the schedule work at M7. A
  cron job that silently produced unencrypted or unrestorable files would be worse than a
  documented manual procedure. **Before any client data touches this stack, automate it and
  test a restore.** An untested backup is a belief.

- **`scripts/sync-ofelia.mjs`.** The generated-file contract, the exact emitted job shape and
  the reload trigger are all written down in `infra/ofelia/config.ini`; the generator itself
  is `runner-engineer`'s at M7, because it must run inside the same transaction as the
  frontmatter commit that causes it. Writing a competing generator here would create two
  writers for one file.

- **A drift check for ofelia.** REQ-INF-71 — "a job in the config but not in frontmatter is a
  bug" is currently enforced by the file being wholly regenerated. That is true only once the
  generator exists; until then it is a comment, and comments are not checks.

- **Langfuse v3.** Decision 8. Three more services to keep local under Part VII.4 is an ADR,
  not an image bump.

- **Resource limits (`deploy.resources`).** Compose v2 honours them only partially without
  Swarm, and inventing a memory ceiling for a Next.js build before anyone has measured one
  produces OOM kills that look like application bugs. Revisit when M3 gives real numbers.

- **A verified `happy` healthcheck.** The probe hits `/` because the relay's actual health
  path is unknown until ADR-005 picks Happy or Omnara. A healthcheck that always passes
  would be worse than one that is occasionally wrong, so it stays honest and wrong for now,
  and `sessions-relay-engineer` owns correcting it.

- **Secret management beyond a gitignored `.env`.** No Docker secrets, no vault, no SOPS. On
  a single tailnet-only host with one operator, a file with 0600 permissions is the honest
  security boundary; anything more would be ceremony that implies a threat model we have not
  written down.

- **A VPS overlay (`compose.vps.yaml`).** The portability rule is *respected* — no absolute
  paths, no host tools, everything relative — but respected is not proven. Proof requires a
  second host, and inventing one now would produce an untested file that reads as tested.

- **The real tailnet.** `TLS_MODE` defaults to `internal` and `TS_AUTHKEY` is empty, so what
  ships today is a stack that boots correctly and binds correctly on loopback. The mesh
  itself is one `.env` edit and one profile flag away, and the walkthrough is in the handoff —
  but the human has to run it, because it needs credentials no agent should hold.
