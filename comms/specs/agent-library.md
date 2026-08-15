# Spec — Agent library, frontmatter schema, seeding, audit engine

> The implementation spec for one owned slice of `skilltree-clone-spec.md`.
> It is checked by `npm run validate:coverage`. Every heading below is required.

## Owner

`agent-library-curator`

## Spec sections covered

PART IV · §3.4

Part IV is the data model — the agent library, the frontmatter that is the single source
of truth for all three views, the repo layout for `agents/`, and the seeding/normalization
of external agent repos. §3.4 is the audit engine, which is authored here as an agent
(`agents/operations/agent-auditor/SKILL.md`) because it *is* a library artefact; its
runtime (scheduling it, giving it Langfuse credentials) belongs to `runner-engineer` and
`observability-engineer` at M7.

Cited but **not** claimed: §2.2 (cluster captions consume the registry — owner
`map-galaxy-engineer`), §2.3 (the drawer projects these fields — owner `drawer-engineer`),
§2.6 (the matrix projects `tier × phase` — owner `chart-matrix-engineer`), §3.2 (`wired_into`
becomes the runner allowlist — owner `runner-engineer`), §3.3 (`company/COMPANY.md` is
seeded here, the interview runtime is `runner-engineer`'s).

## Decisions

- **ADR-001 — the seven departments and `cluster` as a registry-validated free string.**
  Accepted before this spec; implemented here. See `comms/decisions/ADR-001-department-taxonomy.md`.
- **Cluster registry entries are `{slug, label}` objects, not bare strings.** ADR-001's
  illustrative JSON showed strings. §2.2 renders the caption verbatim — `SEQUENCING & SEND` —
  and no slug transform produces an ampersand, so the label is data, not a derivation. The
  keys of `agents/_registry/clusters.json` are still exactly the seven department slugs, as
  the ADR specifies. Recorded in `comms/contracts/frontmatter-schema.md`.
- **The first three clusters of a department are its three map sub-labels** (§2.1). Order in
  the registry is therefore meaningful, not alphabetical, and reordering it changes the map.
- **`status: draft` on all twelve seed agents, including the Part IV canonical example**,
  which the spec shows as `live`. Only a real run promotes a node (Part VII.3, CLAUDE.md
  rule 9). Every other field of that example is reproduced exactly.
- **`breaks_into` entries are self-declaring leaf dots.** Contract invariant 4 says they need
  not be full agents. They resolve to a full agent if one exists; otherwise the map
  synthesises the dot from the slug. Only `builds_on` requires a resolvable agent, because
  it draws a prerequisite edge.
- **Unknown frontmatter keys are an error, not a warning.** `wired-into` instead of
  `wired_into` parses fine and renders an empty drawer section with no error anywhere —
  strict is the only setting that catches it.
- **The seeder stages; it never publishes.** Imports land in `agents/_incoming/` (skipped by
  the validator) with placeholders that fail validation by design. Part VII.3 is a warning
  about volume, so the tool that produces volume is the one that has to resist it.
- **A connector registry is assumed but not authored here.** `wired_into` is the runner's
  allowlist (§3.2), so `runner-engineer` owns the list of connectors that exist. The
  validator reads `agents/_registry/connectors.json` if it appears and shape-checks only
  until then. Message filed.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-LIB-01 | PART IV | One agent = one folder at `agents/{department}/{slug}/SKILL.md` | `agents` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-02 | PART IV | The frontmatter type exports every Part IV field with no additions | `packages/contracts/src/frontmatter.ts` | `npm run typecheck` |
| REQ-LIB-03 | PART IV | `tier` union is exactly `human-led \| assisted \| autonomous` (CHART rows) | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-04 | PART IV | `phase` union is exactly `1-foundation \| 2-capture \| 3-generate \| 4-orchestrate` (CHART columns) | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-05 | PART IV | `department` enum is the seven ADR-001 slugs in ADR-001 order | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-06 | §2.2 | Every department has ≥3 registered clusters; the first three are its map sub-labels | `agents/_registry/clusters.json` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-07 | §2.2 | Sales' clusters are §2.2's five verbatim, including the label `SEQUENCING & SEND` | `agents/_registry/clusters.json` | manual diff against §2.2 |
| REQ-LIB-08 | PART IV | Validator: every required field present | `scripts/validate-frontmatter.mjs` | negative fixture run, 18 findings |
| REQ-LIB-09 | PART IV | Validator: every enum value checked against its union | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-10 | PART IV | Validator: path department segment must equal the `department` field | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-11 | PART IV | Validator: folder slug must equal the kebab-cased `name` | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-12 | PART IV | Validator: `cluster` must exist in the registry for that department | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-13 | PART IV | Validator: every `builds_on` target resolves to an existing agent | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-14 | PART IV | Validator: `breaks_into` entries are unique, kebab-case, non-self-referential | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-15 | PART IV | Validator: `icon` resolves to a real lucide name | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-16 | §3.2 | Validator: `schedule` is a valid 5-field cron; 6-field is rejected | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-17 | §2.3 | Validator: `inputs[].key` unique and snake_case; `select` requires `options[]` | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-18 | §3.2 | Validator: `deliver` targets limited to known `slack` / `email`, format-checked | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-19 | PART IV | Validator: unknown frontmatter keys fail the file | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-20 | §2.3 | Validator: all three `ladder` rungs present and distinct | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-21 | §2.3 | Validator: `the_human` may not be "nothing" | `scripts/validate-frontmatter.mjs` | negative fixture run |
| REQ-LIB-22 | PART IV | A failing file is excluded from the map, never rendered half-parsed | `scripts/validate-frontmatter.mjs` | `--json` report `excluded[]` is disjoint from `agents[]` |
| REQ-LIB-23 | PART IV | `--json` emits a machine-readable exit report the watcher and graph builder consume | `scripts/validate-frontmatter.mjs` | `node scripts/validate-frontmatter.mjs --json` |
| REQ-LIB-24 | PART IV | Validator enums are asserted equal to the contract package's enums (no silent drift) | `scripts/validate-frontmatter.mjs` | run with a deliberately edited enum |
| REQ-LIB-25 | PART IV | Validator runs with zero dependencies (CI, watcher, pre-commit, before `npm install`) | `scripts/validate-frontmatter.mjs` | runs on a clean checkout |
| REQ-LIB-26 | PART IV | Seeder normalizes gtm-agents / wshobson / contains-studio to our frontmatter | `scripts/seed-agents.mjs` | synthetic-source end-to-end run |
| REQ-LIB-27 | PART IV | Seeder preserves upstream licences and refuses a source with no LICENSE file | `scripts/seed-agents.mjs` | synthetic-source end-to-end run |
| REQ-LIB-28 | PART IV | Seeder records provenance in the body, never in frontmatter | `scripts/seed-agents.mjs` | synthetic-source end-to-end run |
| REQ-LIB-29 | PART IV | Seeder is idempotent — re-runs skip staged and already-curated agents | `scripts/seed-agents.mjs` | second run reports "already staged" |
| REQ-LIB-30 | PART IV | Seeder stages to `agents/_incoming/`; a raw import cannot pass validation | `scripts/seed-agents.mjs` | promotion of an uncurated import is excluded |
| REQ-LIB-31 | PART IV | Upstream categories that do not map to the seven departments are reported, not forced | `scripts/seed-agents.mjs` | `--unmapped` |
| REQ-LIB-32 | PART IV | The Part IV canonical example exists field-for-field as the drawer's reference frame | `agents/sales/account-enrichment/SKILL.md` | manual diff against Part IV |
| REQ-LIB-33 | PART IV | ≥1 agent in each of the seven departments, so no map branch is empty | `agents` | validator's by-department line |
| REQ-LIB-34 | §2.6 | Seed agents span the `tier × phase` matrix so both cards and hatched cells render | `agents` | `--json` report, 6 of 12 cells filled |
| REQ-LIB-35 | §3.4 | `agent-auditor` reports frontmatter gaps, stale agents, error rates, missing creds, orphan skills | `agents/operations/agent-auditor/SKILL.md` | — |
| REQ-LIB-36 | §3.4 | `agent-auditor` writes `audit/report.md` and commits only the `status` field | `agents/operations/agent-auditor/SKILL.md` | — |
| REQ-LIB-37 | §3.4 | `agent-auditor` is the only writer of `status: live`, from real Langfuse runs | `agents/operations/agent-auditor/SKILL.md` | — |
| REQ-LIB-38 | §3.4 | Pointed at a prospect's answers, the auditor produces a marked map + deployment plan | `agents/operations/agent-auditor/SKILL.md` | — |
| REQ-LIB-39 | §3.3 | `company/COMPANY.md` carries the interview's section structure with honest gap markers | `company/COMPANY.md` | manual read |
| REQ-LIB-40 | PART VII | `company/COMPANY.md` carries the PDPL data-handling block every runner invocation inherits | `company/COMPANY.md` | `rtl-arabic-pdpl-specialist` review |
| REQ-LIB-41 | §3.3 | `company-interview` asks the ~20 questions incl. Arabic/MSA register, red lines, PDPL | `agents/intelligence/company-interview/SKILL.md` | — |
| REQ-LIB-42 | PART IV | Every agent ships `status: draft`; nothing hand-sets `live` | `agents` | validator warns on any hand-set `live` |

## Interfaces we expose

- **`packages/contracts/src/frontmatter.ts`** — `DEPARTMENTS` (ordered, ADR-001),
  `DEPARTMENT_LABELS`, `TIERS`, `PHASES`, `STATUSES`, `APPROVALS`, `INPUT_TYPES`,
  `LADDER_RUNGS`; types `AgentFrontmatter`, `InputField`, `Delivery`, `Ladder`,
  `ClusterRegistry`, `AgentFile`, `ValidationReport`; schemas `agentFrontmatterSchema`,
  `clusterRegistrySchema`; helpers `toSlug`, `isCronExpression`, `parseAgentFrontmatter`.
  Nothing else in the repo may hardcode a department name, a tier or a phase.
- **`agents/_registry/clusters.json`** — the cluster registry. Keys are the seven
  department slugs; each value is an ordered `{slug, label}[]` whose first three entries are
  the department's map sub-labels (§2.1).
- **`scripts/validate-frontmatter.mjs`** — CLI (`--json`, `--strict`) and importable
  (`validateAll()`, `parseFrontmatter()`, `toSlug()`, `isCronExpression()`). `validateAll()`
  returns `ValidationReport`; consumers render `agents[]` and surface `excluded[]` as a
  warning. Run it before every layout recompute.
- **`agents/**/SKILL.md`** — the library itself. Twelve curated agents at M0.
- **`company/COMPANY.md`** — the brain the runner injects into every invocation (§3.3).

## Interfaces we consume

- `comms/decisions/ADR-001-department-taxonomy.md` — the department enum and order.
- `comms/decisions/ADR-002-repo-shape.md` — `packages/contracts/` is the code half of
  `comms/contracts/`, and the validators assert the two agree.
- `comms/contracts/frontmatter-schema.md` — our own contract; the prose is normative.
- `packages/contracts/package.json` (owner `infra-compose-engineer`) — must declare `zod`.
- `agents/_registry/connectors.json` (owner `runner-engineer`, does not exist yet) — the
  connector registry `wired_into` is validated against once it lands (§3.2).
- Langfuse API shape (owner `observability-engineer`) — `agent-auditor` reads runs, error
  rates and trace URLs from it at M7.

## Test plan

- **Contract, automated.** `node scripts/validate-frontmatter.mjs` over the whole library
  in CI and in the repo watcher. Exit non-zero on any error; `--json` for consumers.
- **Negative fixtures, manual today.** A deliberately broken agent was written, run, and
  removed during M0 — it produced 18 distinct findings covering every rule in the table
  above, plus a second fixture for dangling `builds_on`. These are not yet checked-in
  fixtures; see *Deliberately not done*.
- **Drift, automated.** The validator extracts the enum literals from
  `packages/contracts/src/frontmatter.ts` and fails on any disagreement with its own, so
  the dependency-free duplication cannot rot silently.
- **Seeder, manual.** Exercised end-to-end against a synthetic local source repo (clone,
  licence discovery, classification, normalization, provenance, staging, idempotency,
  promotion gate). Never bulk-run against the real sources — that is a curation session
  with a human, not a CI step.
- **Not automatable.** Whether `replaces` has contempt for the manual work, whether the
  ladder rungs genuinely escalate, and whether `the_human` names something real. The
  validator checks presence, length, distinctness and placeholder text; the judgement is
  `agent-auditor`'s finding list and a human's read.
- **`typecheck` is not runnable yet** — `packages/contracts` has no `package.json` or
  `tsconfig.json` (owner `infra-compose-engineer`). REQ-LIB-02 is unverified until it does.

## Deliberately not done

- **The other ~48 agents.** The spec says curate to ~60 (Part IV) and grow weekly
  (Part VII.3 — "their new agent every week is your git log"). Twelve excellent ones with
  every branch populated and a working matrix spread is the M0 obligation; a batch of
  thin ones this week would make the count look better and the library worse.
- **Bulk-running the seeder.** Deliberate, and the reason the script defaults to a dry run.
  Dumping 137 unreviewed agents is the exact failure Part VII.3 warns about.
- **`agents/_registry/connectors.json`.** `wired_into` is the runner's tool allowlist, so
  the authoritative list of connectors belongs to `runner-engineer`. The validator has the
  hook and will start enforcing membership the moment the file exists. Until then a typo in
  `wired_into` is caught only at run time — that is a real gap, filed, not forgotten.
- **Checked-in negative fixtures + `node --test`.** `package.json` points `test` at
  `scripts/__tests__/*.test.mjs`, which is not a path I own at M0. The fixtures exist as a
  documented manual procedure; converting them is a 30-minute job for whoever owns that
  directory.
- **`packages/contracts/departments.ts`** (ADR-001's angle/rail table). Not my file. The
  ordered array lives in `frontmatter.ts` and `departments.ts` must import it rather than
  restate it — message filed to `infra-compose-engineer`.
- **Leaf skill files.** `breaks_into` entries are declared inline and the map synthesises
  the dots. Writing 36 stub files for the twelve agents' leaves would add files nothing
  reads. `agent-auditor` reports orphans in the other direction (a file nobody references).
- **Promoting anything to `status: live`.** Nothing has run. The LIVE counter reads zero
  and that is the correct number today.
- **Lucide as an authoritative check.** `lucide-react` is not installed at M0, so icons are
  checked against an embedded name list. The validator switches to the installed package's
  real export list automatically once M1 adds the dependency.
