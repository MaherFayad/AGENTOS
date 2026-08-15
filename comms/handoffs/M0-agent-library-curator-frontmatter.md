---
agent: agent-library-curator
milestone: M0
spec: PART IV · §3.4
created: 2026-08-15T21:22
status: ready-for-review
---

# M0 — Frontmatter schema, registries, twelve seed agents

## What exists now

```
comms/contracts/frontmatter-schema.md          accepted (ADR-001); invariant 5 names the file
comms/decisions/ADR-001-department-taxonomy.md the seven departments + cluster registry
packages/contracts/src/frontmatter.ts          types, enums, connector + cluster schemas
agents/_registry/clusters.json                 seven departments, ≥3 clusters each
agents/_registry/connectors.json               13 connectors; validator requires this file
scripts/validate-frontmatter.mjs               CI + watcher; unknown wired_into excludes the file
scripts/seed-agents.mjs                        stages to agents/_incoming/; never publishes
comms/specs/agent-library.md                   PART IV · §3.4
company/COMPANY.md                             interview skeleton, all 20 items unanswered
agents/operations/agent-auditor/SKILL.md       authored; runtime is M7
```

Twelve curated agents, all `status: draft`:

| Department | Count | Agents |
|---|---|---|
| sales | 2 | account-enrichment, database-mining |
| deals | 2 | proposal-drafter, deal-reactivation |
| marketing | 2 | brand-voice-guard, content-repurposer |
| operations | 2 | agent-auditor, follow-up-coordinator |
| intelligence | 2 | company-deep-dive, company-interview |
| customer | 1 | support-triage |
| back-office | 1 | invoice-chaser |

`node scripts/validate-frontmatter.mjs` — 12 found, 12 valid, 0 excluded, 13 connectors.

## How to use it

```powershell
node scripts/validate-frontmatter.mjs           # exit 1 on any error
node scripts/validate-frontmatter.mjs --json    # agents[] to render; excluded[] as warnings
node scripts/seed-agents.mjs                    # dry run (default)
```

A new agent is `agents/{department}/{slug}/SKILL.md` with every required field. `cluster`
must be in `agents/_registry/clusters.json` for that department (add the cluster in the
same commit). `wired_into` names must be keys in `agents/_registry/connectors.json`.
`status` stays `draft` until a real run.

Importing: `node scripts/seed-agents.mjs --write` stages into `agents/_incoming/`. Promote
with `git mv` only after a human writes `replaces`, the three `ladder` rungs, and
`the_human`.

## Contracts touched

- **Owned and updated:** `comms/contracts/frontmatter-schema.md` — status accepted;
  invariant 5 now names `agents/_registry/connectors.json`; ADR-001 open questions closed.
- **Consumed:** ADR-001, ADR-002, `packages/contracts/src/frontmatter.ts`.
- **Not edited:** `apps/runner/**`, any UI view.

## Deliberately not done

- **The other ~48 agents.** Twelve with every branch populated is the M0 obligation.
  Growth is weekly, visible in `git log`.
- **Bulk-running the seeder.** Defaults to dry run. Dumping 137 unreviewed agents is the
  Part VII.3 failure.
- **`agent-auditor` runtime (REQ-LIB-35–38).** SKILL.md exists. Walking Langfuse, writing
  `audit/report.md`, and committing `status` is M7.
- **Runner `CONNECTOR_REGISTRY` lockstep.** JSON is ours; the grant is
  `runner-engineer`'s. We did not edit `apps/runner/**`.
- **Checked-in negative fixtures.** Manual procedure only at M0.
- **Leaf skill files.** `breaks_into` dots are synthesised from slugs.
- **`status: live` on anything.** Nothing has run. The LIVE counter is zero.
- **Authoritative lucide check.** Offline name list until `lucide-react` is installed.

## Verification

```
node scripts/validate-frontmatter.mjs
  files found 12 · valid 12 · excluded 0
  by department  sales 2 · deals 2 · marketing 2 · operations 2 · intelligence 2 · customer 1 · back-office 1
  connectors 13

npm run typecheck --workspace=@agnetos/contracts   # clean

node scripts/check-spec-coverage.mjs
  agent-library.md: no FAILs of our own
  remaining honest — rows: REQ-LIB-35, REQ-LIB-36, REQ-LIB-37, REQ-LIB-38
  (auditor runtime). Escaped-pipe rows REQ-LIB-03 / REQ-LIB-04 parse.
  Coverage still FAILs on unclaimed §2.1 · §2.4 · §2.5 · §3.1 · §3.5 · PART III ·
  PART VI · PART VII — those are other owners, from the resume-wave survey.
```

## Next agent

`map-galaxy-engineer` and `chart-matrix-engineer` consume `DEPARTMENTS` order and the
cluster registry. `runner-engineer` must keep `CONNECTOR_REGISTRY` keys identical to
`agents/_registry/connectors.json`. `fidelity-qa-reviewer` — this is data, not chrome;
no screenshot gate. Orchestrator: M0 supporting work is filed.
