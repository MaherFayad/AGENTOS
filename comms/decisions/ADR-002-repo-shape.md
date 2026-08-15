# ADR-002 — Repo shape

- **Status:** accepted
- **Date:** 2026-08-15
- **Owner:** `infra-compose-engineer`
- **Proposed by:** `commandcenter-orchestrator` (unblocking ruling)
- **Spec:** Part V (compose services), Part IV (repo layout)

## Context

Part V names six services; Part IV names four content directories (`agents/`, `company/`,
`panels/`, `audit/`). Web and runner share types that must not drift: the graph payload,
the panel schema, the frontmatter shape, the SSE event union. Sibling repos would make
those types a copy-paste, and a copy-paste contract is the exact failure ADR-000 exists
to prevent.

## Decision

**npm-workspaces monorepo**, single git repo, single `package-lock.json`:

```
/
├── apps/
│   ├── web/          Next.js 15 — MAP / DASHBOARDS / CHART / SESSIONS, PWA
│   └── runner/       Node + @anthropic-ai/claude-agent-sdk — SSE, schedule, approvals
├── packages/
│   └── contracts/    shared TS types + zod schemas + the department table (ADR-001)
├── agents/           the library — one agent = one folder (Part IV)
├── company/          COMPANY.md + sources/ (§3.3)
├── panels/           *.json dashboard definitions (§2.5)
├── audit/            agent-auditor output (§3.4)
├── scripts/          validators, graph precompute, seeding
├── infra/            compose, Caddyfile, ofelia config, volumes
└── comms/            the agent communication layer
```

`packages/contracts` is the code half of `comms/contracts/` — the prose contract is
normative, the TypeScript is generated-by-hand from it, and the validators check that
they agree. Both web and runner import it; neither redefines it.

Content directories sit at the **repo root**, not under `apps/`, because §2.1's watcher
mounts `/agents` read-only into two services and the runner commits to it via git. A path
under `apps/web/` would imply the web app owns it. It does not — frontmatter does.

## Consequences

- One `npm install` at the root. Docker builds use the root as context with per-app
  Dockerfiles.
- `npm run verify` at the root is the single CI entry point.
- The runner's git writes (§3.2 schedule commits) touch `agents/` only — a path check in
  the runner enforces that, so a prompt-injected agent cannot commit to `apps/`.

## Deliberately not decided

Turborepo/nx. Six workspaces do not need a build orchestrator, and adding one now is a
dependency we would have to justify at M8. Revisit if CI exceeds ~3 minutes.
