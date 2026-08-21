# ADR-041 — An eighth department, `product`, and eleven connector names weighed one at a time

**Date:** 2026-08-21 · **Author:** `agent-library-curator` · **Status:** accepted
**Affects:** `comms/contracts/frontmatter-schema.md` · `packages/contracts/src/departments.ts` ·
`scripts/validate-frontmatter.mjs` · `scripts/lib/departments.mjs` · `scripts/validate-panels.mjs` ·
`agents/_registry/{clusters,connectors,positions}.json` · `apps/runner/src/lib/allowlist.ts` ·
MAP / CHART / DASHBOARDS (as projections, rule 2)
**Amends:** [ADR-001](ADR-001-department-taxonomy.md) — the enum only. Its seven slugs, their
order and their indices are unchanged.

## Context

The company needs the roles that design and build the product: UX research, product design,
frontend implementation, and the A-to-Z delivery that connects them. None of the seven
departments in ADR-001 is that. ADR-001 took §2.6.1's tab bar verbatim because it is a
*go-to-market* taxonomy and matching it keeps the fidelity comparison honest — which is
exactly why it has no room for the people who make the thing being marketed.

The user was offered `operations` and chose a new department knowingly. That makes this a
**schema change and not a folder**. The enum is gated in `validate-frontmatter.mjs`, declared
in `departments.ts`, and MAP, CHART and DASHBOARDS are projections of frontmatter (rule 2) —
so an eighth branch propagates to every view for free, and wrongly if the taxonomy is wrong.

Two independent facts, both observed on 2026-08-21 on this host, shape the second half:

- `infra/compose.yaml` declares **no MCP service** and `apps/runner/src` has **no `mcpServers`
  configuration**. Not one connector in this registry has a running server.
- **Zero agent runs have ever executed.** Nothing here can be justified by what a run needed.

## Options

| Option | For | Against |
|---|---|---|
| A — put these agents in `operations` | no schema change; `operations` already has `delivery` | product work is not operations work; the CHART column for `operations` becomes two unrelated businesses, and the MAP branch caption lies. The user rejected it |
| B — a new `product` department, **inserted** near `operations` | reads better in the tab bar | renumbers every department after it, and `index` is what the layout keys a branch's ray to |
| C — a new `product` department, **appended** at index 7 | every ADR-001 index is untouched; only the new branch is unseeded, so only its neighbourhood reflows | the tab bar reads GTM-first with `Product` last, which is not how a product company would order it |
| D — register all eleven connector names as asked | one edit, nothing to re-ask | the registry's own header says adding a connector is a deliberate widening, not a step taken to unblock someone. Eleven at once with no test is not weighing them |
| E — register a connector only when an agent in the same commit declares it | each name is answerable; the vocabulary cannot grow past its use | one requested name fails the test and has to be refused |

## Decision

**We take C and E.**

### 1. `product` is the eighth department, appended at index 7

| # | slug | Label | Angle | Rail neighbours |
|---|---|---|---|---|
| 7 | `product` | Product | 225° | back-office ← → sales |

`packages/contracts/src/departments.ts` remains the only declaration (ADR-035); the angle is
`-90 + index × 360/8` and every department's angle therefore moves, while every department's
**index** stays where ADR-001 put it. Clusters, per ADR-001's registry-not-enum rule:
`discovery` · `design` · `build` · `design-system` · `delivery`. The first three are the MAP
sub-labels (§2.1).

### 2. The MAP needs **no position seed** — it derives one, and that was worth checking

`positions.json` is a *previous-coordinates* file, not a configuration. `seedPositions` places
any node without stored coordinates on its department's ray at `branchAngle(index, count)`, and
`build-graph.mjs` writes the settled result back. Observed on a rebuild at 2026-08-21 20:0x AST:
**25 nodes added, 11 moved, 49 unchanged**, the eleven being `back-office`'s neighbourhood plus
two anchors within `thawRadius`. `build-graph --check` then reported the layout reproducible, so
determinism survives. That is ADR-003's stability rule doing exactly what it promises.

What *did* need a change is the module that computes the ray. **`scripts/lib/departments.mjs`
tested `parsed.length === 7` in two places**, so an eighth department in `departments.ts` matched
neither branch, warned *"expected 7"*, and **fell back to the seven** — every `product` node would
have been drawn at angle 0, in the middle of `sales`, on a build that exits 0. A count is not an
invariant; agreement with `departments.ts` is.

Worse, and found while fixing it: **its parser could not read `departments.ts` at all.** It matched
a literal tuple table that the file has not contained since ADR-035 split the enum into
`DEPARTMENT_SLUGS` and `DEPARTMENT_LABELS`, so it parsed **zero** departments from a file with
seven in it and silently used its own hardcoded copy — which agreed, so nothing ever looked wrong.
A cross-file agreement check that reads neither file is not a check. Both are fixed and falsified
(plant a renamed slug → the drift warning names it; remove → silent).

### 3. Three department mirrors are now gated, not trusted

`validate:frontmatter` already compared its own enum against `departments.ts`. It now also
compares `scripts/lib/departments.mjs` and `scripts/validate-panels.mjs`, the two **Node-side**
mirrors no type checker can see. Both were caught stale by that gate while landing this change,
which is the whole argument for it. It compares membership and order, never a count.

### 4. `writes` becomes required in the data half, and means one thing

`agents/_registry/connectors.json` now carries `writes` on every row, mirroring the runner's
`Connector` interface, and `allowlist.test.ts` pins the two halves on **keys, `writes` and
`available`** rather than on keys alone. A pin comparing one field is satisfiable by a lie in
the others: `ungated` in the JSON a curator edits and `none` in the code the runner executes
hands a repository to precisely the run the data half refused.

`writes` keeps the runner's meaning and gets no second one: *can this runner bound where the
connector writes **on this host's filesystem***. It is **not a read-only flag** — `slack` is
`none` and writes to a channel. Its only consequence is `assertWorktreeConfinable`. We set it by
one rule:

> **A connector whose job is files is `ungated`. A connector whose job is records or messages
> is `none`.**

That puts `figma`, `google-drive`, `github` and `vercel` on the strictest value in the enum, so
an agent declaring any of them is **refused a git worktree**. That is the intended answer, not a
side effect: an agent that can edit a shared design file and promote a deployment does not also
get a repository this runner cannot bound. What a connector may mutate *in the world* is carried
by its `note` and gated by the declaring agent's `approval: required`.

### 5. Ten connectors registered, one refused — each against the same test

**The test: a connector is registered only when an agent in this same commit declares it.**

| Connector | Status | Why it earns its place | `writes` |
|---|---|---|---|
| `figma` | new | the design system and the screens live there; `product-designer` and `frontend-engineer` both read it. Mutates a file other people are inside | `ungated` |
| `dovetail` | new | the research repository — `ux-researcher`'s system of record. Research nobody can cite is research nobody trusts | `none` |
| `amplitude` | new | the behavioural half of `ux-researcher`'s evidence. Queried, never written: an agent writing events corrupts the only record of what users did | `none` |
| `context7` | new | version-correct docs for `frontend-engineer`. Its most expensive failure is confidently writing an API removed two majors ago | `none` |
| `google-drive` | new | the briefs and transcripts `ux-researcher` is given live outside the repo | `ungated` |
| `google-calendar` | new | `project-orchestrator` puts the review and the ship date on real calendars. An invitation cannot be recalled | `none` |
| `vercel` | new | the preview deployment is `frontend-engineer`'s ship step and the only honest evidence the thing runs | `ungated` |
| `github` | new | the delivery record `project-orchestrator` reconciles: issues, PRs, reviews — not the code path | `ungated` |
| `slack` | **extended, not duplicated** | already registered; gained `writes` and a note about who sees a post | `none` |
| `gmail` | **extended, not duplicated** | already registered; gained `writes` | `none` |

**`mobbin` is refused.** It fails the test twice. No agent here declares it, and none should: a
pattern gallery is a *human's* reference — the value is a designer looking at forty examples and
recognising one — and `wired_into` naming a tool family no agent body uses is the thing
`agent-auditor` calls **a security finding, not a tidiness one**, because the runner's allowlist
derives from that list. The need it was meant to cover is already covered by `web-fetch` and
`firecrawl`, which are registered and reach public galleries. It reopens the day an agent's body
genuinely consumes it and the licence permits programmatic access.

### 6. No credentials, and the drawer says so

**No key is invented, stubbed or placeholdered by this ADR.** All eight new rows are
`available: false`, which is an observation and not a policy: there is no MCP service in
`infra/compose.yaml` and no `mcpServers` config in the runner. `validate:frontmatter` therefore
warns, per agent, that each name resolves to no tool at run time, and each connector's `note`
says plainly which credential it is waiting for — that sentence is what a user reads in the
drawer beside a control that does nothing.

One constraint this hands forward: **the MCP server must be registered under a name equal to the
connector slug.** The tool prefix *is* the boundary, so a server wired as `gdrive` against a
connector granting `mcp__google-drive__*` gives the agent nothing while the drawer still lists it.

### 7. Four agents, all `status: draft`

`ux-researcher` · `product-designer` · `frontend-engineer` · `project-orchestrator`, chained by
`builds_on` so the A-to-Z is an edge on the map and not a paragraph. Rule 9 and invariant 6:
`draft` is the only status a file may declare, and zero runs have executed. **No number is
seeded anywhere.**

## Consequences

- The CHART tab bar renders **eight** tabs. At 1440px `DepartmentTabs` is `overflow-x-auto`
  rather than wrapping, so the eighth is a fidelity question for `chart-matrix-engineer` and
  `fidelity-qa-reviewer`; nothing in this change touched the component.
- `ChartView.test.tsx` asserted `toHaveLength(7)` twice and went red, correctly. Fixed in place:
  the rendered count now derives from the contract, the contract's own count stays a literal so
  a department silently *lost* still turns it red.
- Every department's **angle** moved. Stored coordinates are sticky, so the visible map did not:
  49 of 60 existing nodes are byte-identical and the 11 that moved are `back-office`'s
  neighbourhood, which is what `thawRadius` is for.
- Four of the ten connectors cost their declaring agent a git worktree. Free today — no run has
  ever been given one — and a deliberate refusal the day it is not.
- Reversing this is a migration: a folder move, three enum mirrors, the cluster registry, and a
  `positions.json` recompute. Which is why it is an ADR and not a commit message.

## Contract edits

`comms/contracts/frontmatter-schema.md`:

- *Connector registry* — new paragraph: `writes` is required on every row, with the runner's
  meaning, the `files ⇒ ungated / records ⇒ none` rule, and the explicit warning that `none` is
  not read-only.
- *Connector registry* — "keys are the seven department slugs" → "the department slugs —
  **eight since ADR-041**".

`packages/contracts/src/frontmatter.ts`: the `ClusterRegistry` doc comment said "exactly seven
keys"; it now follows the enum rather than restating a count.

## Deliberately not decided

- **Whether the existing seven `mcp__*` connectors should also be `available: false`.** They
  claim availability and no MCP server exists for any of them either — the same house defect,
  seven rows wide. It is `runner-engineer`'s field on `runner-engineer`'s rows, and flipping
  them changes the warning surface for twelve agents. Filed to their inbox with the observation,
  not fixed here.
- **Whether `schedule:` belongs on any of the four.** `scheduler-engineer`'s open
  decision-request about `schedule:` needing intent is unanswered; adding a fifth clock badge
  to a contract question in flight is not the moment. None of the four carries one.
- **Where `Product` sits in the tab bar.** Appended, because index stability was worth more than
  reading order. If a product company wants it earlier, that is a renumbering with a
  `positions.json` migration and it should be its own decision.
