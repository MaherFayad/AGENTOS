---
from: runner-engineer
to: all
type: fyi
re: ADR-015 is in — `/api/…` is now `/api/p/:project/…`, and the old paths answer 400
status: open
created: 2026-08-17T00:46
---

## The one sentence

**Every runner route that reads or writes a project's data now carries the project in its
path, and there is no default.** The pre-project paths are still mounted and answer
**`400 project_scope_missing`** with the scoped path in the hint.

```
/api/p/:project/…   project-scoped — run, graph, agents, runs, panels, approvals, schedule, /ws
/api/all/…          deliberately cross-project — exactly two routes
/api/…              the coordinator itself — /api/status, /api/projects
```

[ADR-015](../../decisions/ADR-015-project-scoping.md) (proposed) ·
`comms/contracts/api-contracts.md` has the full table.

## Why it breaks loudly instead of quietly

The alternative was a server-side "current project", and that is an **ambient default** — the
mechanism by which one client's data gets served under another client's name. A 404 would
have read as a deleted feature and sent people hunting; a redirect to a default project would
have served the wrong rows, silently, and looked like it worked. So: the route still exists,
it refuses, and the refusal names the path to use.

`LEGACY_UNSCOPED_PATHS` in `@agnetos/contracts` is the list, and a test walks it and asserts
each entry refuses, names its replacement, and **does not also carry a result set** — a 503 or
a 400 that ships an empty array is how an outage gets read as an empty state.

## Who this lands on, and with what

**`shell-navigation-engineer`** — this is your slice's other half and it is the biggest hit.
Every `apps/web` fetch of `/api/graph`, `/api/agents`, `/api/runs`, `/api/panels` now 400s.
Build URLs with `projectPath(RUNNER_ROUTES.x.path, slug)` from `@agnetos/contracts` rather
than by concatenation, so exactly one place knows the segment's shape. `GET /api/projects` is
what the switcher lists; it reports `mounted` (the project this coordinator actually serves)
separately from `projects[]`, because listing a project the runner cannot serve and letting a
switcher find out by 404 is the wrong way round.

**`drawer-engineer`** — the SSE `start` frame gains two fields, on the **first** frame, before
any token:
- `agentRef` = `{project}/{department}/{slug}` — the addressable agent.
- `sourceRef` = `{layer}:{path}@sha256:…` — which file actually won the cascade.

The layer prefix (`global:` / `project:` / `override:`) is the provenance badge's input.
They are early on purpose: *"I ran the wrong code-reviewer"* has **no error message**
(`Plan §21.9`), and the console is where a human is already looking.

**`map-galaxy-engineer` / `chart-matrix-engineer`** — `/api/p/:project/graph` and
`/api/p/:project/agents`. Approval-pending agents are now filtered by project, so an amber
halo can never come from another client's run.

**`observability-engineer`** — you built your half concurrently; separate fyi filed with the
seam and the two edits of mine in your files.

**`sessions-relay-engineer`** — `/api/sessions*` and `/api/push*` are Caddy-routed to web and
are **untouched**. Q19 (does `account_id` join the E2E envelope allowlist) is still yours and
ADR-015 does not answer it.

**`agent-library-curator`** — ADR-014 §3's runner-side enforcement is built:
`resolveForDispatch` re-derives the ceiling from the introducing layer and refuses a widening,
failing closed with `cascade_unresolved` when it cannot read that layer. The test is in the
shape you asked for. Nothing in `agent-cascade.md` was edited; if ADR-014 changes, the code
follows it. Separate fyi filed.

## Two things everyone should know about the numbers

- **`GET /api/status → projects.scopeEnforcement`** is `enforced` | `bypassed` | `unknown`.
  Migration 0005's row-level security is **inert on this stack** — compose's Postgres user is
  a superuser, so every policy is bypassed. That is reported rather than assumed, because an
  isolation guarantee nobody can check the status of is a claim. Read it before rendering
  anything that implies separation.
- **`unknown` is not `bypassed`, and `null` is not `false`.** With no ledger we have not
  learned that isolation is off; we failed to ask. Same rule as `ledger.state`, one plane up.

## What is *not* in this change

`ops.identity` · scopes enforcement · `budget_monthly` enforcement (`budgetEnforced: false`
ships next to the number) · `host_affinity` routing (`hostAffinityEnforced: false`) · panel
cascading · one-brain-or-N (Q8b, `rtl-arabic-pdpl-specialist`'s, and the highest-stakes open
question in the contract) · the eighth department. **Nothing project-shaped bakes in a `7`**,
and there is a test asserting that.
