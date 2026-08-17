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
status: draft                # ALWAYS `draft` in a file — the resolved value comes from the
                             # ledger (invariant 6). live | failing are computed, never typed.
breaks_into: [firmographic-appender, tech-stack-detector, growth-signal-scorer]
builds_on: [database-mining]
wired_into: [exa, firecrawl, workspace]  # MCP/tool names; runner allowlist derives from this
produces: md                 # md | json | pdf | txt | none — default md (ADR-009)
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
| `produces` | — | the artifact kind the run leaves behind; `md\|json\|pdf\|txt\|none`, **default `md`**. `none` = the deliverable is a side effect. Paired with `wired_into` by invariant 7 (ADR-009) |
| `replaces` | ✔ | `WHAT IT REPLACES` quote box |
| `ladder.*` | ✔ | `THE LADDER` three rows; all three keys required |
| `the_human` | ✔ | `THE HUMAN` closing paragraph |
| `inputs[]` | — | drawer `INPUTS` form for ▶ Run; `{key,label,type,required}`; type ∈ `text\|url\|number\|select\|textarea\|date` (+`options[]` for select) |
| `schedule` | — | ofelia cron sync (§3.2), clock badge on node |
| `approval` | — | `required` inserts the human gate: pause at plan, push notify, amber pulse |
| `deliver` | — | post-run delivery; `{slack?: channel, email?: addr}`. **Illegal in the global layer** — [`agent-cascade.md`](agent-cascade.md) §3 Class D |
| `forked_from` | — | `{ref, commit, digest}` — where the text came from. **Legal only in a project library or an override, never global.** Fork-*time* values only: they never change when the parent moves, and staleness is computed by the resolver, never written to a file (ADR-014, cascade §4.2) |

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
6. **`draft` is the only `status` a file may declare.** Any other authored value is a
   validator **error**, and the resolved value is set from `ops.run_ledger` — keyed by
   `agent_ref` — without the file's value being read at all.

   *Amended by [ADR-014](../decisions/ADR-014-agent-cascade-resolution.md) (2026-08-17).* It
   used to say hand-set values get overwritten by `agent-auditor` (§3.4). That convention is
   not strong enough under a cascade, because **copying a file copies the claim**: promote an
   agent or fork one and `live` travels with the bytes into a place that has never run
   anything. BOARD rule 9 and Part VII.3 die at that moment with no error raised. Adopting
   the hard rule costs nothing today — all twelve agents are already `draft` — and would cost
   a great deal the day after the first agent goes live, which is the whole argument for
   doing it now. `failing` likewise comes only from error-rate evidence (§3.4), never from a
   file.

   **Mechanism, stated honestly:** the validator error exists as of 2026-08-17; **the
   ledger-derived resolved status does not.** Every view therefore projects `draft`, which is
   true — zero runs have executed. See `agent-cascade.md` §11.
7. **An agent with `produces` other than `none` must declare at least one connector that
   grants a file-writing tool** (`Write`, `Edit` or `Bash` — derived from the registry's
   `tools`, not from connector names). ADR-009. The runner asks every agent to write
   `output.md` and extracts that file as the run's artifact; an agent with no write tool
   produces nothing **and reports `ok`**, which is worse than failing. In practice the
   declaration is `workspace`, never a runner-side base grant — the allowlist is exactly
   `wired_into` and never a superset (BOARD rule 4, §3.2).

## Connector registry

`agents/_registry/connectors.json` is the vocabulary `wired_into` may use. Keys are
kebab-case slugs; each value is `{label, tools[], note?}`. Keys starting with `$` are
comments. The runner's code registry (`CONNECTOR_REGISTRY` in the runner) must have the
same keys — the JSON is the data half, the runner is the grant. Adding a connector
deliberately widens what agents in this library can do.

A connector row may also carry `available: false` and `since: "M9"` for a connector whose
backing server is not wired yet (ADR-009 decision 5, `runner-engineer`'s call). The
validator reads both defensively — absent means available — and **warns**, per agent, that
the declaration resolves to no tool at run time. It warns rather than fails because
invariant 7 already fails the case that matters: an agent whose only connectors are unbuilt
cannot write its artifact.

`cluster` values are validated against `agents/_registry/clusters.json` (ADR-001): keys
are the seven department slugs; each value is an ordered `{slug, label}[]` whose first
three entries are the department's map sub-labels (§2.1).

## Validation

`skills/cc-frontmatter` carries the validator. It runs in CI and in the repo watcher
before layout recompute. A file failing validation is excluded from the map with a
console warning — it never renders half-parsed. The connector registry file is **required**;
without it every `wired_into` name is unchecked and invariant 5 is a comment.

## Resolved — ADR-009

`produces` and invariant 7 come from
[ADR-009](../decisions/ADR-009-artifact-write-capability.md), filed after `runner-engineer`
found that `intelligence/company-interview` declared two connectors, neither of which could
write the `output.md` its own system prompt demanded — and that **all 12 agents in the
library had the same shape**. The fix is a declaration on the agent, never a base grant in
the runner.

## Resolved — ADR-014, and where resolution is *not* described

This contract describes **one file**. Which of three files wins — the layer order, the four
field classes, `wired_into` narrowing downward, promote/fork/provenance, and the three
validator passes — is [`agent-cascade.md`](agent-cascade.md)
([ADR-014](../decisions/ADR-014-agent-cascade-resolution.md), accepted 2026-08-17). There is
exactly one description of the resolution algorithm in this repo and it is there; two
descriptions would drift, and the drift would be invisible until a run picked the wrong agent.

What ADR-014 landed **here** is the per-file half only: `forked_from`, invariant 6 above, and
the example's `status: draft`. The one sentence worth carrying across the boundary, because it
governs this file's most security-relevant field: **`wired_into` may be narrowed by a lower
layer and never widened, and the runner re-derives that ceiling at dispatch** — the validator
is feedback, not the boundary.

## Resolved — ADR-001

The seven canonical `department` values and `cluster` as registry-validated free text are
decided in `comms/decisions/ADR-001-department-taxonomy.md`. This contract's enums match
that ADR. `cluster` is not a TypeScript enum.
