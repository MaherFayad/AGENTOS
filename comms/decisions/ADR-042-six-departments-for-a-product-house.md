# ADR-042 — Six departments for a product house; the seven business ones deleted

**Date:** 2026-08-22 · **Author:** `commandcenter-orchestrator` · **Status:** accepted
**Affects:** `packages/contracts/src/departments.ts` · `scripts/validate-frontmatter.mjs` ·
`scripts/lib/departments.mjs` · `scripts/validate-panels.mjs` · `scripts/seed-agents.mjs` ·
`agents/_registry/{clusters,positions}.json` · `agents/**` · `panels/**` ·
`comms/specs/agent-library.md` · MAP / CHART / DASHBOARDS (as projections, rule 2)
**Supersedes:** [ADR-001](ADR-001-department-taxonomy.md) — the department table entirely.
Its two structural rules survive untouched: `departments.ts` is the single declaration site,
and `cluster` stays a registry-validated free string.
**Supersedes:** [ADR-041](ADR-041-product-department-and-connector-vocabulary.md) — the
department half. Its connector vocabulary is unaffected and still stands.

## Context

ADR-001 adopted §2.6.1's tab bar verbatim — Sales, Deals, Marketing, Operations,
Intelligence, Customer, Back Office — and said so plainly: *"We take their seven verbatim
rather than inventing our own… matching them keeps the fidelity comparison honest."* That
was the right call for a fidelity clone. It is the wrong call for this instance.

The owner of this instance is a product designer. The domains they work in are product,
business intelligence, design, frontend, backend and AI. Six of the eight departments in
the tree described a sales agency none of that work passes through.

The cost of leaving them was not neutral. Each empty department is a radial branch on the
MAP, a tab in the CHART, a set of cluster sub-labels, and — for four of them — a dashboard
whose widgets query for numbers that can never arrive, because no agent will ever run in
them. BOARD constraint 9 says numbers must be real and an honest empty state beats a
plausible fake one. Seven-eighths-empty chrome is the plausible fake one.

## Decision

**The department enum is exactly these six slugs, in this order.**

| # | slug | Label | Angle | Rail neighbours |
|---|---|---|---|---|
| 0 | `product` | Product | −90° | intelligence ← → design |
| 1 | `design` | Design | −30° | product ← → frontend |
| 2 | `frontend` | Frontend | 30° | design ← → backend |
| 3 | `backend` | Backend | 90° | frontend ← → ai |
| 4 | `ai` | AI | 150° | backend ← → intelligence |
| 5 | `intelligence` | Intelligence | 210° | ai ← → product |

The order is the shape of the work, clockwise from twelve o'clock: a problem enters at
`product`, is specified at `design`, is built across `frontend` and `backend`, gets its
agent surface at `ai`, and is measured at `intelligence` — which feeds the next thing
`product` picks up. §2.1 draws the departments as a ring, so a ring that means something
costs nothing over a ring that does not.

**`product` and `intelligence` keep their slugs and their agents.** `design`, `frontend`,
`backend` and `ai` are new. The other six slugs are **deleted**, not deprecated, not hidden
behind a flag: a slug that still validates is a slug something eventually gets filed under.

### What moved, and what was deleted

Three agents moved to the department that now describes them:

| From | To |
|---|---|
| `product/product-designer` | `design/product-designer` (cluster `design` → `interaction`) |
| `product/frontend-engineer` | `frontend/frontend-engineer` (cluster `build` unchanged) |
| `operations/agent-auditor` | `ai/agent-auditor` (cluster `quality-and-audit` → `agent-ops`) |

`agent-auditor` is the one judgement call worth recording. It audits the agent library —
frontmatter gaps, stale agents, error rates, orphan skills. That is `ai`'s subject matter,
not a generic operations chore, and `ai/agent-ops` is where a reader looks for it.

Nine agents were deleted with their departments: `sales/account-enrichment`,
`sales/database-mining`, `deals/deal-reactivation`, `deals/proposal-drafter`,
`marketing/brand-voice-guard`, `marketing/content-repurposer`,
`operations/follow-up-coordinator`, `customer/support-triage`,
`back-office/invoice-chaser`. None had ever run; all were `status: draft`.

Four dashboards were deleted — `pipeline`, `content-studio`, `finance`, `client-delivery` —
because each is scoped to a department that no longer exists. `mission-control` moves from
`operations` to `ai`; `product-funnels` stays on `intelligence`. Carousel `order` was
renumbered to stay 1-based contiguous.

### `backend` ships empty, and that is the honest state

REQ-LIB-33 requires ≥1 agent per department so no map branch is empty. `backend` has zero.
That row is now marked **UNMET** in `comms/specs/agent-library.md` rather than reworded to
be satisfiable. An unstaffed branch renders §2.6's hatched empty state, which is the view
telling the truth; a fabricated backend agent to turn the row green would be the exact
defect BOARD constraint 9 exists to prevent.

## Consequences

- **Stored MAP positions are re-seeded, not preserved.** ADR-041's append-don't-insert rule
  cannot apply to a decision that removes rows: every surviving index moves, and `360/6` is
  not `360/8`, so the rays move regardless. `npm run graph:build` rewrote
  `agents/_registry/positions.json` in the same commit.
- **The three mirrored department tables were all updated together**, and the drift check in
  `validate-frontmatter.mjs` proved it — it failed loudly on each one until it agreed with
  the enum. The mirror in `apps/web/src/dashboards/data/endpoints.test.ts` was a fourth,
  hand-typed copy nobody had registered as one; it had already silently missed ADR-041's
  `product` and now reads `DEPARTMENT_SLUGS` directly.
- **The seeder's classifier was rewritten, not renamed.** `scripts/seed-agents.mjs` maps
  upstream agent names onto the taxonomy, and every rule in it pointed at a deleted
  department. The replacement is ordered specific → general and was checked against 18
  real upstream agent names plus 5 negative controls — GTM agents that ADR-042 says must
  come back *unmapped*. All 23 behaved correctly. ADR-001's rule that unmapped is a signal
  rather than a failure now does more work than it used to: a cold-email agent has nowhere
  honest to land, and widening a rule to absorb it is how a curated library becomes a junk
  drawer.
- **A latent bug in that classifier was found by the same check.** Every rule had the shape
  `` /\b(stem|…)\b/ ``, and a trailing `\b` after a truncated stem can never match the word
  it was written for: `accessibilit` cannot be followed by a word boundary in
  "accessibility-auditor". Four of eighteen names were silently unmatched. The bug is
  inherited from ADR-001's original table, where `` \b(competit|…)\b `` likewise never
  matched "competitive-analyst" — for a year, in a gate nobody had run a positive control
  through. Fixed to `` )\w*\b ``.
- **Test fixtures that use a department slug as arbitrary sample data were left alone.**
  A blind repo-wide rename was attempted and reverted: it corrupted `company-interview`'s
  `section` options (a COMPANY.md heading called "operations" became "ai"), rewrote prose in
  the spec of record and in eight contracts, and broke 38 runner tests plus a dozen web ones
  by renaming values whose *meaning* was "a department that does not exist". The lesson is
  recorded because the sweep looked mechanical and was not: **a slug used as a negative
  fixture is not the same token as a slug used as a department**, and only reading each site
  tells them apart.

## Alternatives considered

- **Keep the seven and hide them behind a preference.** Rejected: the enum gates the
  validator, the panel schema and the frontmatter contract. A hidden department still
  validates, still accepts an agent, and still has to be reasoned about at every one of
  those sites — all of the cost, none of the visibility.
- **Rename rather than delete** (`sales` → `frontend`, and so on) so indices and positions
  survive. Rejected: it preserves nine agents' worth of business content under engineering
  names, and the positions it saves are recomputed deterministically in one command anyway.
- **Seven departments, adding `research` as a seventh** to keep §2.1's literal "seven radial
  branches". Rejected: §2.1's seven was already broken by ADR-041's eight, the branch angle
  is computed from the table length, and `research` would have been a department invented to
  satisfy a count rather than because work lands in it — which is the same defect as keeping
  `back-office`. Research lives in `product/discovery` and `intelligence`.
