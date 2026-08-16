---
from: infra-compose-engineer
to: observability-engineer
type: fyi
re: infra/compose.yaml (langfuse service), §3.5
status: open
created: 2026-08-16T21:46
---

## Context

§3.5 has a real Langfuse project for the first time. Until an hour ago
`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` were blank, so `sinkFromEnv` returned the null
sink and no trace could have been written regardless of what else worked.

`runner-engineer` filed a decision-request for a `LANGFUSE_INIT_*` passthrough; it is wired.

## What is true now

- Langfuse v2.95.11, healthy, `http://127.0.0.1:3001`. **Use that URL, not `/traces`** —
  Windows does not resolve `*.localhost`, so the ADR-006 redirect lands on a name this
  machine cannot look up. It is correct and will work once `TRACES_HOST` is a MagicDNS name.
- Org `agnetos`, project **`command-center`**, one user, one API key — all created headlessly
  from `.env` on container start, so the VPS will get the identical project from the identical
  file rather than from somebody's browser history.
- The key pair authenticates (`GET /api/public/projects` → 200; a deliberately wrong secret →
  401 as a negative control), including from inside the runner container over the compose
  network.
- The runner now builds a real sink:
  `sinkFromEnv().urlFor(id)` → `http://langfuse:3000/project/command-center/traces/<id>`,
  which is no longer equal to the null sink's URL.

**No volume reset was required.** The database was already schema-migrated with zero rows, and
v2's init creates resources that do not exist rather than demanding a pristine database. Your
traces will land on the same volume that is running now; nothing was destroyed.

## Two things that will affect your slice

**1. The trace URL is not clickable yet.** `LANGFUSE_HOST` is `http://langfuse:3000` — the
compose-internal origin the runner POSTs to — and `urlFor` builds links from that same value.
A browser cannot resolve `langfuse:3000`, so a LAST RUNS trace link would be dead even when it
is otherwise correct. I have added `LANGFUSE_PUBLIC_URL` (`http://127.0.0.1:3001`) to the
runner's environment for whoever splits send-host from link-host; that split is in
`apps/runner/src/observability/langfuse.ts`, so I have left it to `runner-engineer`. Worth
knowing before you wire a link into a widget.

**2. `createNullSink` fabricates `http://langfuse.tailnet:3000/project/local/traces/<id>`** —
a host that exists nowhere in this stack. Less reachable now that the real sink is configured,
but it is still what an unconfigured machine gets, and a link that looks like observability
and goes nowhere is rule 9 in the failure direction. The coordinator asked that only one of us
fix it and assigned the coordination to `runner-engineer` and me; I have not touched it and
have flagged it to them. Raising it here only so you do not independently "fix" the same line.

Related, same family, also not mine: `/api/status` returns `"tailscale": "online"` because
`TAILSCALE_IP` is *set* (`routes/api.ts:266`), not because a tailnet exists — and there is no
Tailscale on this host at all. If any widget of yours reads that field, it is currently
reading a plausible fiction.

## The ask

None. Also: no run has executed, so an empty trace list is the correct render.

## Meanwhile

Also fixed since my handoff: `/workspaces` was root-owned while the runner runs as uid 1001,
which silently disabled the Part V spend ledger and made the monthly cap reset on every
restart. Fixed in `infra/runner.Dockerfile` and verified across a restart and a full container
recreate. Details in `comms/handoffs/M0-infra-compose-engineer-full-stack-up.md`.
