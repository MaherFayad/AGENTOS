# CONTRACT — Agent frontmatter schema

**Owner:** `agent-library-curator` · **Source:** spec Part IV · **Status:** accepted
(ADR-001)

One agent = one folder = `agents/{department}/{agent-slug}/SKILL.md`. This frontmatter is
**the single source of truth for all three views**. MAP, CHART and DASHBOARDS are
projections of it. No view stores its own copy of agent data.

## Canonical example

```yaml
---
name: Account Enrichment
description: Layer firmographics, tech stack, and headcount trends onto target accounts.
department: sales            # one of the 7 canonical branches — MAP branch
cluster: enrichment          # sub-cluster label on the map (§2.2)
icon: building               # lucide icon name
tier: autonomous             # human-led | assisted | autonomous — CHART row + drawer eyebrow
phase: 2-capture             # 1-foundation | 2-capture | 3-generate | 4-orchestrate — CHART column
status: live                 # live | draft | failing — map halo + "N OF 22 LIVE" counter
breaks_into: [firmographic-appender, tech-stack-detector, growth-signal-scorer]
builds_on: [database-mining]
wired_into: [exa, firecrawl]  # MCP/tool names; runner allowlist derives from this
replaces: "The research step everyone skips: outreach to a company you don't understand reads like spam because it is."
ladder:
  human-led: "A glance at the website before the call."
  assisted: "Tech stack, headcount trends, and growth signals appended to every target account on demand."
  autonomous: "Accounts re-enrich on a schedule; material changes trigger alerts to the targeting layer."
the_human: "AI owns the work. A human audits outputs on a cadence and owns the strategy it executes."
inputs:
  - {key: account_url, label: "Account website", type: url, required: true}
schedule: "0 6 * * 1"        # optional, 5-field cron — drives ofelia + clock badge
approval: none               # none | required
deliver: {slack: "#sales-ops"}
---
(system prompt / skill body)
```

## Field reference — who consumes what

| Field | Req | Consumed by |
|---|---|---|
| `name` | ✔ | node label, drawer title, search index, chart card |
| `description` | ✔ | drawer body, chart expanded card, search index |
| `department` | ✔ | MAP branch assignment, CHART tab, radial force group |
| `cluster` | ✔ | MAP sub-cluster label (§2.2), drawer breadcrumb second segment |
| `icon` | ✔ | node glyph, chart card square — must resolve in `lucide-react` |
| `tier` | ✔ | CHART row, drawer eyebrow, `THE LADDER` active row |
| `phase` | ✔ | CHART column, phase tag + tier dots on job card |
| `status` | ✔ | node halo (`live`→copper ring, `failing`→amber), LIVE counter, audit |
| `breaks_into` | — | `BREAKS INTO` chips → leaf nodes on map; chip click = fly-to |
| `builds_on` | — | `BUILDS ON` dashed chip; also a map edge (prerequisite link) |
| `wired_into` | — | `WIRED INTO` list **and** the runner's tool allowlist (security-relevant) |
| `replaces` | ✔ | `WHAT IT REPLACES` quote box |
| `ladder.*` | ✔ | `THE LADDER` three rows; all three keys required |
| `the_human` | ✔ | `THE HUMAN` closing paragraph |
| `inputs[]` | — | drawer `INPUTS` form for ▶ Run; `{key,label,type,required}`; type ∈ `text\|url\|number\|select\|textarea\|date` (+`options[]` for select) |
| `schedule` | — | ofelia cron sync (§3.2), clock badge on node |
| `approval` | — | `required` inserts the human gate: pause at plan, push notify, amber pulse |
| `deliver` | — | post-run delivery; `{slack?: channel, email?: addr}` |

## Invariants

1. `agents/{department}/…` path segment **must equal** the `department` field.
2. Folder slug must equal `name` kebab-cased — cross-references (`breaks_into`,
   `builds_on`) resolve by slug.
3. Every slug in `builds_on` must exist. Dangling refs fail the build.
4. `breaks_into` entries are leaf skill dots — they may be slugs of sub-skill files in
   the same folder, they are not required to be full agents.
5. `wired_into` names must exist in `agents/_registry/connectors.json`. The validator
   rejects unknown names at CI time; the runner rejects them at run time with
   `unknown_connector` (422). Adding a name here without wiring the connector in the
   runner is a `blocker` message to `runner-engineer`, not a silent TODO.
6. `status: live` is set by observability (real runs exist), not by hand. Hand-set values
   get overwritten by `agent-auditor` (§3.4).

## Connector registry

`agents/_registry/connectors.json` is the vocabulary `wired_into` may use. Keys are
kebab-case slugs; each value is `{label, tools[], note?}`. Keys starting with `$` are
comments. The runner's code registry (`CONNECTOR_REGISTRY` in the runner) must have the
same keys — the JSON is the data half, the runner is the grant. Adding a connector
deliberately widens what agents in this library can do.

`cluster` values are validated against `agents/_registry/clusters.json` (ADR-001): keys
are the seven department slugs; each value is an ordered `{slug, label}[]` whose first
three entries are the department's map sub-labels (§2.1).

## Validation

`skills/cc-frontmatter` carries the validator. It runs in CI and in the repo watcher
before layout recompute. A file failing validation is excluded from the map with a
console warning — it never renders half-parsed. The connector registry file is **required**;
without it every `wired_into` name is unchecked and invariant 5 is a comment.

## Resolved — ADR-001

The seven canonical `department` values and `cluster` as registry-validated free text are
decided in `comms/decisions/ADR-001-department-taxonomy.md`. This contract's enums match
that ADR. `cluster` is not a TypeScript enum.
