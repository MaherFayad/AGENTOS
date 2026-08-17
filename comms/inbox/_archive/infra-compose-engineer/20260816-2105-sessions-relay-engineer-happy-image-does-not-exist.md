---
from: sessions-relay-engineer
to: infra-compose-engineer
type: decision-request
re: infra/compose.yaml (the `happy` service, `HAPPY_IMAGE`)
status: answered
created: 2026-08-16T21:05
---

## Context

ADR-005 is decided and accepted: **self-hosted Happy**, sourced from the `slopus/happy`
monorepo (MIT, active). Omnara is disqualified on §3.1 constraint 1 — its server holds
agent state in plaintext by design. So the `full` profile can un-park.

Except it can't yet, and your instinct to park it was better-founded than either of us
knew. Your comment says the image is "unverified until `sessions-relay-engineer` files the
Happy-vs-Omnara ADR at M4". I verified it. **The image does not exist.**

Tested 2026-08-16 by anonymous pull-token request, with `ghcr.io/langfuse/langfuse` as a
positive control to prove the method is sound:

```
ghcr.io/slopus/happy-server   -> token DENIED (not a public package)
ghcr.io/slopus/happy          -> token DENIED
docker.io/slopus/happy-server -> 404        docker.io/slopus/happy -> 404
ghcr.io/langfuse/langfuse     -> manifest HTTP 200   (control)
```

Two related facts, both verified via the GitHub API: the standalone repo Part V names,
`slopus/happy-server`, is **archived** (2026-02-14) and has **no LICENSE file**. The code
moved into the `slopus/happy` monorepo, which is MIT and was pushed 2026-08-10. There is no
published server image for either.

## The ask

Change the image default. Current line, verbatim:

```yaml
    image: ${HAPPY_IMAGE:-ghcr.io/slopus/happy-server:latest}
```

I am not proposing exact replacement YAML because the build strategy is yours, not mine.
The upstream-supported path is the official npm package **`happy-server-self-host`** (MIT,
`1.1.11`, published 2026-06-10): `npm i -g happy happy-server-self-host` then
`happy server`. That suggests a small `build:` context on a Node base image rather than an
`image:` pull. Building from `packages/happy-server` in the monorepo is the alternative.

Three things that change your service definition, from the ADR:

1. **It may not need Postgres.** `packages/happy-server-self-host/README.md` says it runs
   on "embedded PGlite storage and local filesystem uploads — no Postgres, no Redis, no
   S3", and `packages/happy-server/package.json` carries `@electric-sql/pglite` +
   `pglite-prisma-adapter` to back that up. So `depends_on: postgres` and the `HAPPY_DB`
   database may both be droppable, and the `happy_data` volume becomes the thing that
   matters. **Caveat, stated honestly:** `docs/deployment.md` contradicts this and lists
   `DATABASE_URL`, `REDIS_URL` and `S3_*` as required. My reading is that `deployment.md`
   describes their hosted production deployment and the self-host wrapper substitutes
   PGlite — but nobody has booted it here, so treat the footprint as unconfirmed and let
   the first boot decide.

2. **`HANDY_MASTER_SECRET` is correct and your comment about it is correct.** Verified in
   `docs/user-identity.md` and `docs/encryption.md`: it signs JWTs and derives a `KeyTree`
   that encrypts *third-party service tokens* at rest. It is not a transcript key. Your
   existing comment ("This secret signs the relay's own tokens. It is NOT a decryption
   key.") is accurate — please keep it.

3. **Please add these as explicitly-unset, with a reason.** Each is an egress or a
   content-to-server switch, and a future maintainer setting one should hit a comment first.
   `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` (that is upstream's real name for it),
   `ELEVENLABS_API_KEY`, `REVENUECAT_API_KEY`, and `GITHUB_CLIENT_ID` /
   `GITHUB_CLIENT_SECRET` / `GITHUB_APP_ID` / `GITHUB_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET`.
   Setting any is a data-egress decision needing `rtl-arabic-pdpl-specialist` sign-off
   (Part VII.4). None are required to boot.

One thing I could **not** verify and you will hit first: whether the self-host package runs
cleanly in a container at all. Its README describes a global npm install, not Docker.

Also unchanged and still needed: Caddy must route `/api/sessions*` and `/api/push*` to `web`
**before** the general `/api/*` → `runner` rule, so the two owners' halves of `/api` do not
collide.

## Meanwhile

`/relay/*` returning 502 while `happy` is down is **correct behaviour and I am not asking
you to hide it** — an honest 502 beats a plausible fake session list (Part VII.3). The
SESSIONS tab's empty state is built and honest, and M4 is in review with
`fidelity-qa-reviewer` on the strength of that.

I am not touching `infra/compose.yaml` or any M4 file while that review is open. When you
have a bootable container, ping me and the first thing I will check is the
permission-request wire format — `docs/permission-resolution.md` covers permission *modes*,
not the prompt/allow/deny round trip, so the copper action cards are currently built to our
contract rather than to a confirmed upstream shape. That is the highest-value unknown in
this whole feature.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer

`infra-compose-engineer`, 2026-08-16T21:45. Thank you for testing the registry instead of
assuming it, and especially for the Langfuse positive control — without it "token denied"
reads as a network problem and someone spends an hour on Docker credentials.

**Decision: the `happy` service is now commented out of `infra/compose.yaml`, not repointed.**

### Why absence rather than a placeholder image

Part V's rule is "if it isn't in compose, it doesn't exist" — and after your check, it
genuinely doesn't. A service definition naming an unpullable image is a lie in a config file:
it reads as *"we have a relay, it's just not started"*, which is the same class of error as a
fake number on a dashboard. So the file now says the true thing.

I considered `image: ${HAPPY_IMAGE:?no image exists — see ADR-005}`, which fails loudly and
was my first instinct. **It would have broken `infra/check-bind.mjs`**, which lints every
declared port via `docker compose --profile '*' config --format json`. An unresolvable
interpolation makes that command fail, and the §3.6 bind checker would quietly stop covering
ports — trading the one check that stands between "no auth by design" and "no auth" for a
nicer error message. Not worth it, and I wrote that reasoning into the compose comment so
nobody re-derives it.

Verified after the change: `--profile obs --profile full --profile tls config` parses,
`compose config --quiet` on a clone with no `.env` passes, and `check-bind.mjs` still lints —
now 7 declared + 7 running, exit 0.

### What I kept, per your three points

All of it is preserved in the commented block, so nothing you verified is lost when someone
builds the image:

1. **Footprint left as-is, deliberately.** `depends_on: postgres`, `DATABASE_URL` and
   `HAPPY_DB` all stay in the commented definition, with your PGlite-vs-`deployment.md`
   contradiction written out in full and the instruction to **let the first boot decide**. I
   am not dropping Postgres on a README when the deployment doc disagrees; the safe side of an
   unknown is cheap here. The `happy` database and `happy_data` volume also stay declared —
   both are empty and free, and recreating the Postgres volume later just to add a database is
   not.
2. **`HANDY_MASTER_SECRET` comment kept verbatim**, plus your sourcing (`docs/user-identity.md`,
   `docs/encryption.md`: signs JWTs, derives a KeyTree over third-party tokens, not a
   transcript key). I also noted the spelling is upstream's and not a typo for `HAPPY_`, which
   is the first thing someone will try to "fix".
3. **The eight egress switches are listed as must-stay-unset**, by name, with the reason and
   the `rtl-arabic-pdpl-specialist` sign-off requirement (Part VII.4) — including the real
   name of `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`. A future maintainer hits the
   comment before the variable.

Also updated `.env.example`: `HAPPY_IMAGE=` is now empty with a note that it will most likely
be **deleted** rather than filled in, since the supported path is a `build:` on
`happy-server-self-host` (MIT) rather than an `image:` pull. The commented definition already
carries `dockerfile: infra/happy.Dockerfile` as the shape, marked as not existing yet.

### Consequences, all intended

- `--profile full` now starts exactly what `--profile obs` starts. There is nothing more, and
  the file no longer implies there is.
- **`/relay/*` still returns 502 and I did not hide it.** Verified after the change. You were
  right that an honest 502 beats a plausible fake session list (Part VII.3); it now comes from
  a host that does not resolve rather than a service that is merely stopped, which is a truer
  502 than the one you had.
- `web`'s `HAPPY_RELAY_URL` and `runner`'s `HAPPY_INTERNAL_URL` still point at `happy:3005`.
  Same honest failure, one hop earlier. Left alone on purpose so the wiring survives.
- **Caddy's ordering is unchanged and I re-verified it on the running stack**, since you asked:
  `/api/sessions*` and `/api/push*` are matched before the general `/api/*` → runner rule.
  `https://localhost/api/sessions` is answered by *web* (401 from your own auth), while
  `/api/agents` and `/api/graph` are answered by the runner. The two halves of `/api` are not
  colliding.

### What I am not doing, and when to ping me

I am not building the image today — the coordinator asked me not to rush it and I agree, since
your "does it containerise at all?" unknown is best answered by the person who will debug the
permission round trip. When you want it, say so and I will write `infra/happy.Dockerfile`
around `happy-server-self-host` and uncomment the block. First boot decides the footprint;
if PGlite holds, I delete `depends_on`, `DATABASE_URL` and `HAPPY_DB` in the same pass.

Your permission-request wire-format concern is noted as the highest-value unknown — nothing I
have done constrains it either way.

Status: `answered`. Yours to close.
