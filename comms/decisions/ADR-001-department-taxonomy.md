# ADR-001 — The seven canonical departments, and `cluster`

- **Status:** accepted
- **Date:** 2026-08-15
- **Owner:** `agent-library-curator`
- **Proposed by:** `commandcenter-orchestrator` (unblocking ruling — owner may refine the
  cluster registry, not the department enum)
- **Spec:** §2.1 (7 radial branches), §2.6.1 (their department tab bar), Part IV
  (frontmatter enum)

## Context

§2.1 requires exactly seven radial branches. §2.6.1 shows their tab bar naming them.
Five agents encode this enum in code — the map's `forceRadial` angles, the chart's tab
bar, the frontmatter validator, the panel `department` field and the rail labels — so
until it is fixed, none of them can be written without a rename waiting to happen.

## Decision

**The department enum is exactly these seven slugs, in this order.** Order is
significant: it is the CHART tab order and the MAP branch angle order (index × 360/7,
starting at −90° so `sales` is at twelve o'clock).

| # | slug | Display label | Angle | Rail neighbours |
|---|---|---|---|---|
| 0 | `sales` | Sales | −90° | back-office ← → deals |
| 1 | `deals` | Deals | −38.6° | sales ← → marketing |
| 2 | `marketing` | Marketing | 12.9° | deals ← → operations |
| 3 | `operations` | Operations | 64.3° | marketing ← → intelligence |
| 4 | `intelligence` | Intelligence | 115.7° | operations ← → customer |
| 5 | `customer` | Customer | 167.1° | intelligence ← → back-office |
| 6 | `back-office` | Back Office | 218.6° | customer ← → sales |

We take their seven verbatim (§2.6.1) rather than inventing our own. They are generic
enough to hold our agents, and matching them keeps the fidelity comparison honest — a
side-by-side that differs in tab labels differs in more than content.

**`cluster` is free text, validated against a per-department registry** at
`agents/_registry/clusters.json`:

```json
{ "sales": ["lead-sourcing", "enrichment", "outreach-writing", "targeting", "sequencing"] }
```

Rationale for registry-not-enum: §2.2 renders cluster labels as floating sub-cluster
captions around node groups, so clusters are a *layout* concern that must stay stable and
typo-free — but they grow every week as agents land, and a TypeScript enum would make
adding an agent a code change. A JSON registry gives the validator its check without
making the curator edit application source. An unknown cluster is a validation **error**;
adding one is a one-line registry edit in the same commit as the agent.

Each department also carries **three sub-labels** (§2.1: "3 tiny sub-labels beneath")
sourced from the first three clusters in its registry entry — not a separate field.

## Consequences

- `packages/contracts/departments.ts` exports the ordered array; nothing else may
  hardcode a department name or angle.
- `back-office` is the slug; `Back Office` is the label. Path segment is the slug, so
  `agents/back-office/<agent>/SKILL.md`. The validator enforces path == department.
- Renaming a department later is a migration (folder move + registry + stored positions),
  which is exactly why this is decided before M0 code.

## Deliberately not decided

Which clusters exist under each department beyond the seeds — that is curation, and it
belongs in the registry file, not an ADR.
