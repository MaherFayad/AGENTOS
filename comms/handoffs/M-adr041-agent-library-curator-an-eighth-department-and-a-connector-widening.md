---
agent: agent-library-curator
milestone: M-adr041 (not a milestone slice — a schema change requested by the user)
spec: Part IV · §2.1 · §2.6.1 · §3.2 · ADR-001 (amended) · ADR-003 · ADR-009 · ADR-035 · ADR-041
created: 2026-08-21T20:20
status: ready-for-review
---

# ADR-041 — `product`, four agents, ten connectors and one refusal

## What exists now

**The decision** — `comms/decisions/ADR-041-product-department-and-connector-vocabulary.md`,
status **accepted**, number claimed on BOARD at `74aea50` *before* the file existed.

**The department** — `product`, appended at index 7 (label `Product`, angle 225°).

| Path | What changed |
|---|---|
| `packages/contracts/src/departments.ts` | `product` appended to `DEPARTMENT_SLUGS` + `DEPARTMENT_LABELS`. Still the only declaration (ADR-035) |
| `scripts/validate-frontmatter.mjs` | enum + **a new gate over the two Node-side mirrors** + `writes` required on connector rows |
| `scripts/lib/departments.mjs` | the mirror table, **a parser that now reads `departments.ts`**, and two `=== 7` checks removed |
| `scripts/validate-panels.mjs` | the mirror list |
| `scripts/lib/layout.mjs` | `computeLayout`'s default table took `branchAngle(index, 7)` on an 8-row table |
| `agents/_registry/clusters.json` | `product`: discovery · design · build · design-system · delivery |
| `agents/_registry/positions.json` | **rebuilt, not hand-edited** |
| `apps/web/src/chart/components/ChartView.test.tsx` | two literal `7`s (not my file — see below) |
| `scripts/lib/layout.test.mjs` | three literal `7`s and one assertion that genuinely weakened |

**The agents** — `agents/product/{ux-researcher,product-designer,frontend-engineer,project-orchestrator}/SKILL.md`.
All `status: draft`. Library is now **16 agents against a target of ~60**.

**The connectors** — `agents/_registry/connectors.json` (data) and `CONNECTOR_REGISTRY` in
`apps/runner/src/lib/allowlist.ts` (code), landed together in one commit. Eight new names,
`slack`/`gmail` extended not duplicated, **`mobbin` refused**.

Commits: `74aea50` (BOARD claim) · `400684d` (department) · `06e8990` (connectors) ·
`3e361f3` (agents) · `b24a6d5` (ADR + contract).

## How to use it

- A ninth department: edit `departments.ts`, then run `npm run validate:frontmatter` — it
  names each mirror you missed. Then `node scripts/build-graph.mjs`. **`positions.json` needs
  no entry**: `seedPositions` places an unseeded node on its department's ray and the build
  writes the settled coordinates back.
- A new connector: add the row to `connectors.json` *and* `CONNECTOR_REGISTRY`, both with
  `writes`. `allowlist.test.ts` refuses any disagreement on keys, `writes` or `available`.

## Contracts touched

`comms/contracts/frontmatter-schema.md` (mine) — the `writes` paragraph, "seven department
slugs" becomes "eight since ADR-041", and a new *Resolved — ADR-041* section.

**Files I edited that are not mine**, each with a message to the owner naming the exact change:
`apps/runner/src/lib/allowlist.ts` + `allowlist.test.ts` (`runner-engineer`),
`apps/web/src/chart/components/ChartView.test.tsx` (`chart-matrix-engineer`),
`scripts/lib/layout.mjs` + `layout.test.mjs` (`map-galaxy-engineer`). In each case my change
made their file wrong or red, and leaving a red suite behind is worse than a scoped edit.

## Three defects the eighth department exposed

None was introduced by ADR-041; all three were latent and would have shipped a wrong map
silently.

1. **`scripts/lib/departments.mjs` parsed zero departments out of `departments.ts`** — it
   matched a tuple table ADR-035 removed — and used its own hardcoded copy, which agreed. A
   cross-file agreement check that reads neither file is not a check.
2. **Two `=== 7` checks in the same file** meant an eighth department fell back to the seven,
   drawing every `product` node at angle 0 on top of `sales`, on a build that exits 0.
3. **`computeLayout`'s default table hardcoded `7`.** Every real caller passes
   `options.departments`, so no gate could ever have seen it.

`validate:frontmatter` now gates all three mirrors on membership and order, never a count —
and caught two of them stale on the commit that added the gate.

## Deliberately not done

- **`mobbin` is not registered.** The user asked for eleven names and got ten. No agent body
  consumes a pattern gallery — it is a *human's* reference — and `wired_into` naming a tool
  family nothing uses is what `agent-auditor` calls a security finding, because the runner's
  allowlist derives from that list. `web-fetch` and `firecrawl` already reach public
  galleries. It reopens the day an agent's body genuinely consumes it.
- **No credentials, no MCP servers, no placeholders.** Vocabulary only. All eight new rows are
  `available: false` — observed, not assumed: no MCP service in `infra/compose.yaml`, no
  `mcpServers` config in the runner. Filed to `infra-compose-engineer` with the naming
  constraint that would otherwise void the grant in silence.
- **The seven existing `mcp__*` rows still claim availability** with no server for any of them
  either. Same defect, seven rows wide, on `runner-engineer`'s rows — filed to their inbox,
  not flipped here.
- **No `schedule:` on any of the four.** `scheduler-engineer`'s decision-request about
  `schedule:` needing intent is open in my inbox; adding a clock badge to a contract question
  in flight is not the moment.
- **Whether eight tabs still fit §2.6.1's single row at 1440px.** `DepartmentTabs.tsx` is
  `overflow-x-auto` with a comment that now describes seven tabs in an eight-tab bar. Not
  measured, not edited — filed to `chart-matrix-engineer`, flagged to `fidelity-qa-reviewer`.
  **The 1440px side-by-side still cannot be performed: the reference frames do not exist.**
- **Six open messages in my inbox are still open**, two of them `decision-request`s aimed at
  this contract. They were not answered before this dispatch, contrary to the protocol.
- **Where `Product` sits in the tab bar.** Appended, because index stability was worth more
  than reading order. Moving it is a renumbering plus a `positions.json` migration.
- **Nothing has run.** These are four `draft` files. No number was seeded anywhere; the LIVE
  counter reads 0 because 0 is true.

## Verification

**The tree was not still.** `shell-navigation-engineer` landed `0506ecf` and `8483ebd`
mid-dispatch, and one earlier `npm run verify` failed on *their* in-flight
`PwaRegistrar.test.tsx` (`TS2305`, a symbol that did not exist yet) — not on anything of mine.
It passes now that their commits landed. Every result below is a **separate observation with
its own clock time**, run individually because a single `verify` could not be trusted to have
observed one tree.

| Gate | Result | Observed |
|---|---|---|
| `validate:frontmatter` | exit 0 — 16 files, 16 valid, 0 excluded, `product 4`, 21 connectors, 9 honest `available: false` warnings | 2026-08-21 19:59 AST |
| `validate:panels`, `validate:tokens`, `validate:barrel`, `validate:rtl:gate`, `validate:comms`, `validate:coverage` | all exit 0 | 2026-08-21 19:59 AST |
| `typecheck` | exit 0 | 2026-08-21 19:59 AST |
| `typecheck:tests` | exit 0 | 2026-08-21 20:00 AST |
| `test` (`node:test`) | 223 pass, 0 fail | 2026-08-21 19:59 AST |
| `test:runner` | 373 tests, 370 pass, 0 fail, 3 skipped | 2026-08-21 19:59 AST |
| `test:web` | 100 files, 949 tests, 0 failed | 2026-08-21 20:00 AST |
| `build-graph --check` | "layout is reproducible and committed" | 2026-08-21 19:59 AST |

**Baseline, before any edit:** `npm run verify` exit 0 at 2026-08-21 19:31 AST.

**Not run:** `smoke`, `smoke:browser` — `verify:runtime`'s two gates need a running app, and
nothing in this change is a route or a component. The eighth CHART tab is the one user-visible
surface and it is unrendered-by-me; that is what the review-request is for.

**Falsification — every gate I added or changed was planted, watched red, and restored:**

| Gate | Plant | Red | Restored |
|---|---|---|---|
| mirror drift (`departments.mjs`) | delete the `product` row | `FAIL … mirrors the departments as [ … back-office]` | silent |
| mirror drift (`validate-panels.mjs`) | *no plant needed* — it was **genuinely stale** and the gate caught it on its first run | yes | fixed |
| `writes` required | delete `figma.writes` from the JSON | `FAIL figma.writes is required and must be one of gated / none / ungated` | silent |
| registry parity on `writes` | flip `figma.writes` to `none` in the JSON | `✖ … the code half says ungated/unwired and connectors.json says none/unwired`, `fail 1` | 370 pass |
| `departments.ts` parser | rename `customer` to `customerz` | drift warning names `5: customer → customerz` | no warning |

**Layout churn, measured rather than asserted:** 25 nodes added, 11 moved, 49 byte-identical
out of 85. The eleven are `back-office`'s neighbourhood plus two anchors inside `thawRadius`.

**Commit hygiene:** every commit is `git commit -- <paths>` with explicit paths; the one
staging step (`git add agents/product`, for files git did not yet know) was immediately
followed by a path-scoped commit, never a bare one. `400684d` and `06e8990` are green
*together* and not apart — the `writes` requirement landed in the validator one commit before
the data that satisfies it. That is a bisect hazard of one commit and it is stated rather than
hidden.

## Next agent

- `runner-engineer` first — `comms/inbox/runner-engineer/20260821-2015-…`. Two of your files
  changed, and a seven-row availability finding waits on your ruling.
- `infra-compose-engineer` — `…/20260821-2016-…`. Eight servers to wire, one naming constraint
  that silently voids the grant if missed, and credentials that come from the human.
- `chart-matrix-engineer` — `…/20260821-2017-…`. One test of yours edited; the eighth tab at
  1440px is unmeasured.
- `map-galaxy-engineer` — `…/20260821-2018-…`. Three latent defects and one weakened stability
  claim.
- `fidelity-qa-reviewer` — the user-visible surface is a new MAP branch and an eighth CHART
  tab. Read `DepartmentTabs.tsx`'s single-row comment first.
