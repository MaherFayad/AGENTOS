---
agent: infra-compose-engineer
milestone: M0
spec: Part V, §3.6, §3.5, §3.2 (ofelia), Part VII.4
created: 2026-08-16T20:50
status: ready-for-review
---

# Phase 0 steps 0.2 + 0.6 — the whole stack runs, on loopback, and builds stopped killing dev

Six services up and healthy in one `docker compose` command. The `.next` collision that cost
three agents an afternoon each is fixed at the config layer. **The tailnet is not up and I
could not bring it up** — see *What I could not do* — so every URL below is loopback, and no
phone has been tested.

---

## What exists now

### Running stack (`--profile obs`)

| Service | Status | Published on |
|---|---|---|
| `caddy` | healthy | `127.0.0.1:80`, `127.0.0.1:443` (tcp+udp) |
| `web` | healthy | `127.0.0.1:3000` |
| `runner` | healthy | `127.0.0.1:8787` |
| `postgres` | healthy | `127.0.0.1:5433` |
| `langfuse` | healthy (v2.95.11) | `127.0.0.1:3001` |
| `ofelia` | up, 4 jobs registered | no port (by design) |
| `happy` | **not started** — `--profile full` only, pending ADR-005 | `127.0.0.1:3005` when it is |

### Files changed

- `infra/compose.yaml` — ofelia image pin fixed; `runner` gained a gated `depends_on: postgres`
- `infra/web.Dockerfile` — copies from `.next-build`
- `apps/web/next.config.mjs` — phase-keyed `distDir`; config is now a function
- `apps/web/package.json` — `dev` = `next dev -H 127.0.0.1 -p 4321`; `start` pins loopback
- `apps/web/tsconfig.json`, `apps/web/.eslintrc.json`, `.gitignore`, `.dockerignore`
- `scripts/check-tokens.mjs`, `scripts/check-rtl.mjs`,
  `scripts/__tests__/repo-conformance.test.mjs` — skip `.next-build`
- `.env.example` — ofelia pin, Windows `*.localhost` caveat
- `.env` (gitignored) — placeholders replaced with generated local secrets

---

## How to use it

### Run the stack

```bash
# from the repo root, so --env-file finds .env
docker compose -f infra/compose.yaml --env-file .env --profile obs up -d --build
docker compose -f infra/compose.yaml --env-file .env --profile obs ps
docker compose -f infra/compose.yaml --env-file .env --profile obs down     # keeps volumes
```

`--profile dev` still starts **web + runner only**, with no Postgres and no Caddy. Verified
after my `depends_on` change: `--profile dev config --services` resolves to exactly
`runner, web`.

### Your service's URL

Through Caddy — one origin, `tls internal` (Caddy's own CA, so a browser warning until you
install its root cert):

| Prefix | Goes to | Owner |
|---|---|---|
| `https://localhost/` | web | `shell-navigation-engineer` |
| `https://localhost/api/sessions*`, `/api/push*` | web's own route handlers | `sessions-relay-engineer` |
| `https://localhost/api/*` (everything else) | runner | `runner-engineer` |
| `https://localhost/ws/*` | runner (graph deltas) | `map-galaxy-engineer` |
| `https://localhost/traces` | 301 → `https://traces.localhost/` → langfuse | `observability-engineer` |
| `https://localhost/relay/*` | happy — **502 today**, service not started | `sessions-relay-engineer` |

Direct loopback, no TLS, for when you do not want to fight a self-signed cert:

| | |
|---|---|
| **dev server (source-live, what you screenshot)** | `http://127.0.0.1:4321` |
| web container (production build) | `http://127.0.0.1:3000` |
| runner | `http://127.0.0.1:8787` |
| **Langfuse UI** | `http://127.0.0.1:3001` |
| Postgres | `127.0.0.1:5433`, db `agnetos` / `langfuse` / `happy`, user `agnetos` |

**Use `http://127.0.0.1:3001` for Langfuse, not `/traces`.** Linux and macOS resolve every
`*.localhost` to loopback; Windows resolves only `localhost` itself, so the `/traces`
redirect lands on a name this machine cannot look up. Not a bug in the redirect — ADR-006's
second hostname is a MagicDNS name in deployment, and MagicDNS does resolve it. Documented in
`.env.example` next to `TRACES_HOST`. Do not add a hosts-file entry: that is machine state
outside compose and breaks "identical compose on a VPS".

### The dev server

```bash
cd apps/web && npm run dev        # next dev -H 127.0.0.1 -p 4321
```

Use the script, not `npx next dev -p 4321`. Bare `next dev` binds `0.0.0.0`; I found the
server listening on `192.168.100.83:4321`, reachable by anything on the house wifi. Not a
public port, but off-tailnet exposure of an app with no auth by design (§3.6).

### Building no longer breaks the dev server

`npm run build` while `next dev` is running is now safe. `apps/web/next.config.mjs` exports a
function of Next's phase:

```
next dev            -> distDir .next          (only next dev writes here)
next build / start  -> distDir .next-build
```

Keyed off the **phase**, not `NODE_ENV`: `NODE_ENV=development next build` is a thing people
do, and under a NODE_ENV rule it would write `.next` again and reintroduce the bug.
`NEXT_DIST_DIR` overrides the build dir if you ever need a third.

`apps/web/next-env.d.ts` is now gitignored and untracked — Next rewrites its
`/// <reference path>` line to whichever distDir ran last, which made it a permanent dirty
line in every worktree. `tsc --noEmit` passes with the file absent (verified), and
`tsconfig.json` includes both types dirs.

---

## Contracts touched

None. No contract file edited, no ADR needed — every change is inside Part V, which I own.
`comms/contracts/api-contracts.md` is unchanged; I only verified the routes it declares.

Two candidate ADRs are raised but deliberately **not** written, because both would be
architecture decisions and Phase 0 changes no architecture:

1. **How the tailnet actually attaches** (see below) — host-installed Tailscale vs
   `network_mode: service:tailscale`.
2. **`TLS_MODE=tailscale` needs two certs, not one.** `infra/caddy/tls/tailscale.caddy` is
   imported by *both* the `CC_HOST` and `TRACES_HOST` site blocks and hands both the same
   `/certs/tailnet.crt`. A Tailscale cert is per-FQDN, so the traces host would serve a cert
   for the wrong name. Unverifiable today (no tailnet), so it is written down rather than
   guessed at.

---

## Deliberately not done

1. **The tailnet.** Nothing was brought up on Tailscale, and no phone was tested. There is no
   Tailscale on this host (no binary at any of the three install paths, not on `PATH`, no
   service, no address in `100.64.0.0/10`), and `TS_AUTHKEY` is empty. I did not start
   `--profile tls`: without an auth key the container would sit at an interactive login URL,
   and `tailscale cert` would then run against `CC_HOST=localhost`, which is not a MagicDNS
   name. A half-joined node is worse than none. **The acceptance criterion for step 0.2 —
   "open the PWA on your phone over Tailscale" — is unmet and I am not claiming it.**

2. **`RUNNER_ANTHROPIC_API_KEY` left at the `REPLACE-ME` placeholder** that `.env.example`
   ships (the Anthropic key prefix followed by `-REPLACE-ME`; I am not writing that literal
   here, because `repo-conformance.test.mjs` correctly fails any `sk-ant-`-shaped string in
   `comms/` on sight and I am not weakening a secrets guard to make my own handoff go
   green). I was told not to invent
   one and there is nothing to derive it from. Everything that does not need it is up. No run
   has executed, so the LIVE counter, the cost ticker and LAST RUNS are all honestly empty
   (rule 9) rather than broken.

3. **`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` left empty.** They only exist after a
   Langfuse project is created. Langfuse v2 can seed them headlessly via `LANGFUSE_INIT_*`
   env vars, which would make the stack reproducible instead of click-configured — but *which*
   workspace and how the runner authenticates is BOARD open question M3, owned by
   `runner-engineer`. Adding the plumbing would pre-empt their ADR. Flagged to them instead.

4. **`happy` not started.** `--profile full` only, and that split is deliberate: the image is
   unverified until ADR-005 lands, and a bad pull would take the whole stack down with it
   (which is exactly what the ofelia tag did today). `/relay/*` returns 502 and that is the
   correct current answer.

5. **VAPID push keys left empty.** Generatable in one command, but they are
   `sessions-relay-engineer`'s (§3.1) and an empty pair keeps "Notify this phone" honest.

6. **`POSTGRES_PASSWORD` and friends are now real random values, but they were generated by
   me, not chosen by you.** They are local-only credentials on a loopback-bound Postgres. If
   you would rather own them, rewrite them in `.env` and run
   `docker compose ... down -v && up -d` — the volume must be recreated, because initdb only
   reads the password once.

7. **Did not fix `apps/web/src/components/primitives/KpiNumeral.test.tsx`.** One vitest
   failure, `"starts at zero and lands on the value"` (375/376 pass). Pre-existing, §1.4/§1.6,
   `design-system-guardian`'s slice. Not mine to touch and not caused by anything here.

8. **Did not add a runner-side Postgres reconnect.** I fixed the *ordering* in compose; the
   runner still probes once at boot and latches. A `docker restart postgres` will still leave
   it in the "observability is not up" state until the runner restarts too. That is runner
   code (§3.5), filed to `runner-engineer`.

---

## Verification

Everything below is output I actually saw, on the stack as it is running now.

**Step 0.6 — the build/dev collision.** Dev server up on 4321, `GET /` → `HTTP 200, 27428
bytes`. Ran a full `npm run build` to completion (18 routes emitted). Then:

```
.next/routes-manifest.json        : True      <- dev server's, untouched
.next-build/routes-manifest.json  : True
.next-build/standalone/apps/web/server.js : True
GET /            -> HTTP 200 (27427 bytes)
GET /map         -> HTTP 200 (27427 bytes)
GET /api/sessions -> HTTP 401           <- the relay's own auth, i.e. a route handler
                                           answered; a broken manifest gives 500 ENOENT
```

**Step 0.2 — the stack.** `docker compose --profile obs up -d --build`, then a full
`down` + `up` to prove it comes up clean from cold, not just incrementally:

```
caddy      Up (healthy)     langfuse   Up (healthy)     ofelia     Up
postgres   Up (healthy)     runner     Up (healthy)     web        Up (healthy)
```

**Caddy routing, through `https://localhost`:**

```
/                  -> 307 (web)          /map            -> 200 (web)
/api/agents        -> 200, 17393B        /api/graph      -> 200, 24177B
/api/metrics/runs  -> 200 {"runs":[]}    /traces         -> 302 -> 301 -> traces.localhost
traces.localhost/  -> 200 (langfuse)     /relay/health   -> 502 (happy not started)
```

**Bind addresses — `node infra/check-bind.mjs`, exit 0:**

```
8 declared + 7 running port(s) bound to loopback or the tailnet. No public listeners.
```

Plus a negative test from the host's own LAN address, which the linter cannot do:
`http://192.168.100.83:4321` and `https://192.168.100.83/` are both refused.

**`/agents` read-only (M0 deliverable 4):**

```
runner  touch /agents/__probe   -> Read-only file system
web     touch /agents/__probe   -> Read-only file system
runner  touch /repo/agents/...  -> succeeds (the git path, the only write route)
```

**Ledger, on a freshly created volume** (`agnetos_langfuse_pgdata` did not exist — the old
one was destroyed between sessions):

```
ops.agent_runs | ops.agent_run_daily | ops.agent_run_tools     (3 tables)
databases: agnetos, happy, langfuse   <- postgres/init/01-databases.sh ran
```

**ofelia — frontmatter is the source of truth (§3.2):**

```
New job registered "sales/account-enrichment"    "0 6 * * 1"
New job registered "back-office/invoice-chaser"  "0 9 * * 2"
New job registered "operations/agent-auditor"    "0 5 * * *"
New job registered "ops/prune"                   "0 3 * * *"   <- ADR-008 system job
Starting scheduler with 4 jobs
```

`node scripts/sync-ofelia.mjs` regenerated `infra/ofelia/config.ini` and `git diff` on it is
**empty** — zero drift between frontmatter and cron.

**Repo gates:** `npm run test` 80/80 · `npm run test:runner` passes · `npm run typecheck`
clean across all three workspaces · `npm run lint` clean · `docker compose config --quiet`
passes with **no** `.env` at all (the CI case).

### Two real bugs found and fixed while doing this

**1. `OFELIA_IMAGE=mcuadros/ofelia:v0.3.16` does not exist.** Tags on that repo carry no `v`
prefix. Worse than a broken service: compose aborts the *other* pulls when one reference
fails, so the entire `obs` profile was unpullable on any machine without a warm cache. Pinned
to `0.3.22` in `compose.yaml`, `.env` and `.env.example`.

**2. The runner won a race against Postgres and latched "observability is not up".** It
probes the DB once at boot and never retries. It had no `depends_on`, so on a cold start it
came up before initdb finished, and the whole stack then reported *healthy* while
`/api/metrics/*` returned 503 — a failure that looks exactly like the honest "no runs yet"
empty state, which is how it survived a previous session. Proved it was ordering, not the
`make_interval` query bug, by restarting the runner alone: the warning vanished and
`/api/metrics/runs` returned `{"runs":[]}`.

Fixed with `depends_on: postgres: {condition: service_healthy, required: false}`. The
`required: false` is load-bearing — a plain `depends_on` hard-fails under `--profile dev`
with `depends on undefined service "postgres": invalid compose project`, which would have
re-blocked every front-end agent on the full stack. I tried it the plain way first and
watched it break; both profiles are verified.

### The `.env` finding, which the previous session got wrong

My own last status said `.env` had "real secrets". It did not. `.env` was **byte-identical to
`.env.example`** — every value a `REPLACE-ME` placeholder, including `POSTGRES_PASSWORD` and
`LANGFUSE_ENCRYPTION_KEY` (64 zeros). I replaced the locally-generatable ones with random
hex; hex specifically, because those values are interpolated into compose `${VAR}` and into
`postgresql://` DSNs, where base64's `$ + / =` would break one or both.

The two that are yours to supply are untouched and listed below.

---

## What I need from you before step 0.3

**1. `RUNNER_ANTHROPIC_API_KEY` — hard blocker for step 0.3.** Create a **dedicated
workspace** in the Anthropic Console (not your personal/default one), set a hard monthly
spend limit on that workspace, issue a key inside it, and put it in `.env` line 80. The
billing split in Part V is the point: if the runner spends from your subscription, a runaway
scheduled agent takes out the interactive sessions you would use to fix it.
Then `docker compose -f infra/compose.yaml --env-file .env --profile obs up -d runner`.

**2. Tailscale — blocker for the tailnet half of step 0.2, and for the phone.** Three things,
and the second cannot be known before the first:

- Install Tailscale on this Windows host and sign in. Then `tailscale ip -4` gives the
  `100.x.y.z` for `TAILSCALE_IP`, and `tailscale status` gives the MagicDNS name for
  `CC_HOST` (`<machine>.<tailnet>.ts.net`).
- Generate a reusable auth key at <https://login.tailscale.com/admin/settings/keys>, tagged
  so it is revocable → `TS_AUTHKEY`.
- Then: set `TLS_MODE=tailscale`, and
  `docker compose -f infra/compose.yaml --env-file .env --profile obs --profile tls up -d`,
  and re-run `node infra/check-bind.mjs`.

**There is a design question inside this that I want you to decide, not me.** `TAILSCALE_IP`
is documented as *the host's* address, so Caddy publishes onto a host interface — which means
Tailscale must be installed on the host, and that contradicts Part V's portability rule ("no
host-installed tools; if it isn't in compose, it doesn't exist"). The compose `tailscale`
service runs `TS_USERSPACE=true`, so it gets its *own* tailnet address inside the container;
the host never gets one from it. The two halves assume different topologies. The alternative
is `network_mode: service:tailscale` on caddy — no published ports at all, the most literal
possible reading of "no public ports" — but that is an architecture change, and you told me
Phase 0 changes no architecture. It needs an ADR. The host-install path above works today and
is what `.env.example` documents; I have pre-pulled `tailscale/tailscale:stable` so that step
cannot fail on a pull.

**3. Optional, and yours to decide:** the secrets I generated are mine, not yours (see
*Deliberately not done* 6).

---

## Next agent

`runner-engineer`, step 0.3 — but only after `RUNNER_ANTHROPIC_API_KEY` exists. Read
`comms/inbox/runner-engineer/20260816-2050-infra-compose-engineer-stack-up-for-first-run.md`
first; it has the four things to check on a first run and the two known runner-side gaps
(single-shot DB probe, and the `LANGFUSE_INIT_*` option for M3's open question).

`fidelity-qa-reviewer` for the review gate. Nothing here is user-visible except the dev
server's bind address, so this is an infra review, not a fidelity one.

---

# Addendum — 2026-08-16T21:46 · three follow-ups from the coordinator

All three landed after the section above was written. None needed the API key. Items 1 and 2
were blocking step 0.3 on their own.

## 1. `/workspaces` was root-owned — and it was a money bug

`runner_workspaces` mounted root-owned while the runner runs as uid 1001, so **every**
non-dry run would have thrown `EACCES` from `createScratch`, after the billing gate, looking
like a model failure. Diagnosed by `runner-engineer`.

The expensive part is third in visibility and first in cost: `/workspaces/spend.json` is the
Part V monthly cap's ledger (`billing.ts:40`), and `SpendLedger.persist()` swallows its write
error by design — a failed persist must not fail a run that already succeeded. So **the hard
monthly cap was silently resetting to $0.00 on every restart.** A cap a crash loop can drive
through is a speed bump, and the user is about to put a real API key behind it.

Fixed permanently in the image — `infra/runner.Dockerfile`, before `USER runner`:

```dockerfile
RUN mkdir -p /workspaces/artifacts && chown -R runner:nodejs /workspaces
```

Docker seeds an empty named volume from the image directory *including ownership*, so this
holds on the VPS too, which a runtime `chown` never would.

**Verified on a volume with no chown in its history** — I rebuilt the image, destroyed
`agnetos_runner_workspaces` (empty; nothing durable lost) and recreated:

```
uid=1001(runner) gid=1001(nodejs)      drwxr-xr-x runner nodejs /workspaces
                                       drwxr-xr-x runner nodejs /workspaces/artifacts
scratch  OK  /workspaces/run-CLFBhC    <- the exact call that was failing
artifact OK  /workspaces/artifacts writable
spend    OK  /workspaces/spend.json writable
```

**Spend-file persistence, which is the point.** Marker written, then `restart runner` (real
container restart): `probe survived: written-before-restart`, `spend.json still writable
after restart`. Then a second marker and a full `--force-recreate` (new container, same
volume): `probe after recreate: persist-across-recreate`. Survives both.

I deliberately left **no `spend.json` behind** — created, confirmed writable at the exact
path, deleted. A spend file written by me is a fabricated money number in a billing control
(rule 9). **Still unproven:** the first real `persist()`, which cannot be tested without
spending a token.

## 2. Langfuse — keys exist, project is live, **no volume reset needed**

`LANGFUSE_INIT_*` passthrough wired as `runner-engineer` requested, using their
one-value-two-consumers wiring verbatim: `LANGFUSE_INIT_PROJECT_PUBLIC_KEY` and
`_SECRET_KEY` read the **same** `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` the runner
authenticates with, so the project cannot be created with a key the runner does not hold.

**The volume question, answered by test rather than by doc.** Our database was already
schema-migrated, and v2's init is documented as first-run-only — so the honest answer needed
an experiment:

```
BEFORE:  users=0 orgs=0 projects=0 api_keys=0
         (force-recreate langfuse; volume untouched)
langfuse-1 | Running init scripts...
AFTER:    users=1 orgs=1 projects=1 api_keys=1
```

**No `down -v`.** The boundary is per-*resource*, not per-database: migrated-but-empty seeds
fine. So no traces were destroyed and none will be. That also means these are create-time
values — editing them later on a populated database does nothing, silently — which is written
into both `compose.yaml` and `.env.example`.

Authentication proven with a negative control: `GET /api/public/projects` → 200
`{"id":"command-center"}`; the same call with a wrong secret → 401. Also 200 from *inside the
runner container* over the compose network. `sinkFromEnv().urlFor()` now returns
`http://langfuse:3000/project/command-center/traces/<id>` and no longer equals the null
sink's URL.

**I did not POST a trace.** Ingesting a synthetic one would put a fabricated trace in the
store before the first real run.

**One bug this uncovered, which was mine:** `sinkFromEnv` reads
`LANGFUSE_PROJECT_ID ?? 'default'` and compose never set it — so trace *links* would have
pointed at a project that does not exist while traces landed in `command-center`. Fixed:
`LANGFUSE_PROJECT_ID: ${LANGFUSE_INIT_PROJECT_ID:-}`.

## 3. `happy` — the image never existed, so the service is now absent, not fictional

`sessions-relay-engineer` verified (with a Langfuse positive control) that
`ghcr.io/slopus/happy-server` and every variant returns denied/404, and that the repo Part V
names is archived with no LICENSE. `infra/compose.yaml` was naming a container that has never
existed.

**Decision: commented out with a full documented block, not repointed.** "If it isn't in
compose, it doesn't exist" — and it doesn't.

I rejected `image: ${HAPPY_IMAGE:?...}`, which fails loudly and was my first instinct,
because **`infra/check-bind.mjs` lints ports via `docker compose --profile '*' config
--format json`**. An unresolvable interpolation makes that fail, and the §3.6 bind checker
would quietly stop covering ports. Never trade the bind check for an error message.

Kept in the commented block: the Postgres wiring (the PGlite claim contradicts upstream's
`deployment.md`; first boot decides), the `HANDY_MASTER_SECRET` comment and its sourcing, and
the eight egress switches named as must-stay-unset with the Part VII.4 sign-off requirement.
`.env.example` now has `HAPPY_IMAGE=` empty, noting it will likely be deleted rather than
filled, since the path is a `build:` on `happy-server-self-host` (MIT).

`/relay/*` still returns 502 — verified after the change, and deliberately not hidden.

## Also verified after all three changes

`--profile obs --profile full --profile tls config` parses · `compose config --quiet` with no
`.env` passes · `check-bind.mjs` exit 0, now 7 declared + 7 running, no public listeners ·
`npm run test` 80/80 · `test:runner` passes · `typecheck` clean · `validate:comms` clean ·
all six services healthy.

The `/api` ownership split re-verified on the live stack: `/api/sessions` → 401 and
`/api/push/subscribe` → 405 (both answered by **web**), `/api/agents` and `/api/graph` → 200
(runner), and zero `/api/sessions` hits in the runner's log.

## Two honesty bugs found, deliberately NOT fixed (they are runner code)

1. **`createNullSink` fabricates `http://langfuse.tailnet:3000/…`** — a host that exists
   nowhere. `langfuse.ts:164`. The coordinator asked that only one side fix it; it is
   `runner-engineer`'s file and I have not touched it. Note its default is load-bearing in
   five of their tests.
2. **`/api/status` reports `"tailscale": "online"`** because `TAILSCALE_IP` is *set*
   (`routes/api.ts:266`) — with no Tailscale on this host at all. Same family: a plausible
   value where `unknown` is the truth.

## Still blocked on the user, unchanged

`RUNNER_ANTHROPIC_API_KEY`, and the Tailscale credentials + the host-install vs
`network_mode: service:tailscale` decision, which remains parked at the coordinator's
instruction.
