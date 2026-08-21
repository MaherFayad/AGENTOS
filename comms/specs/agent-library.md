# Spec — Agent library, frontmatter schema, seeding, audit engine

> The implementation spec for one owned slice of `skilltree-clone-spec.md`.
> It is checked by `npm run validate:coverage`. Every heading below is required.

## Owner

`agent-library-curator`

## Spec sections covered

PART IV · §3.4

## Boundaries

Cited but **not** claimed — these mentions must not live under Spec sections covered or
the coverage checker steals another agent's section:

- §2.2 cluster captions consume the registry — owner `map-galaxy-engineer`
- §2.3 the drawer projects these fields — owner `drawer-engineer`
- §2.6 the matrix projects `tier × phase` — owner `chart-matrix-engineer`
- §3.2 `wired_into` becomes the runner allowlist — owner `runner-engineer`
- §3.3 `company/COMPANY.md` is seeded here; the interview runtime is `runner-engineer`'s

## Decisions

- **ADR-042 — the six departments; `cluster` stays a registry-validated free string.**
  ADR-001 set the pattern and ADR-042 replaced its table wholesale (`product`, `design`,
  `frontend`, `backend`, `ai`, `intelligence`). See
  `comms/decisions/ADR-042-six-departments-for-a-product-house.md`.
- **Cluster registry entries are `{slug, label}` objects, not bare strings.** ADR-001's
  illustrative JSON showed strings. §2.2 renders the caption verbatim — `SEQUENCING & SEND` —
  and no slug transform produces an ampersand, so the label is data, not a derivation. The
  keys of `agents/_registry/clusters.json` are still exactly the department slugs, as
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
- **The connector registry is authored here as data; the runner owns the grant.**
  `agents/_registry/connectors.json` is the vocabulary `wired_into` may use (invariant 5).
  The runner's `CONNECTOR_REGISTRY` is the code that turns a name into tools. Adding a
  connector is both files, or the validator and the runner disagree. The validator
  **requires** the JSON file and rejects unknown names — a typo in `wired_into` fails CI,
  not a 2am run. Keys starting with `$` are comments.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-LIB-01 | PART IV | One agent = one folder at `agents/{department}/{slug}/SKILL.md` | `agents/` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-02 | PART IV | The frontmatter type exports every Part IV field with no additions | `packages/contracts/src/frontmatter.ts` | `npm run typecheck` |
| REQ-LIB-03 | PART IV | `tier` union is exactly `human-led \| assisted \| autonomous` (CHART rows) | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-04 | PART IV | `phase` union is exactly `1-foundation \| 2-capture \| 3-generate \| 4-orchestrate` (CHART columns) | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-05 | PART IV | `department` enum is the six ADR-042 slugs in ADR-042 order | `packages/contracts/src/frontmatter.ts` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-06 | §2.2 | Every department has ≥3 registered clusters; the first three are its map sub-labels | `agents/_registry/clusters.json` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-07 | §2.2 | ~~Sales' clusters are §2.2's five verbatim~~ — **VOID: `sales` deleted by ADR-042.** §2.2's cluster labels have no department left to land in | `agents/_registry/clusters.json` | void — see ADR-042 |
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
| REQ-LIB-31 | PART IV | Upstream categories that do not map to the six departments are reported, not forced | `scripts/seed-agents.mjs` | `--unmapped` |
| REQ-LIB-32 | PART IV | The Part IV canonical example exists field-for-field as the drawer's reference frame | `agents/design/product-designer/SKILL.md` | manual diff against Part IV |
| REQ-LIB-33 | PART IV | ≥1 agent in each department, so no map branch is empty — **UNMET: `backend` has 0 (ADR-042)** | `agents/` | validator's by-department line |
| REQ-LIB-34 | §2.6 | Seed agents span the `tier × phase` matrix so both cards and hatched cells render | `agents/` | `--json` report, 6 of 12 cells filled |
| REQ-LIB-35 | §3.4 | `agent-auditor` reports frontmatter gaps, stale agents, error rates, missing creds, orphan skills | — | — |
| REQ-LIB-36 | §3.4 | `agent-auditor` writes `audit/report.md` and commits only the `status` field | — | — |
| REQ-LIB-37 | §3.4 | `agent-auditor` is the only writer of `status: live`, from real Langfuse runs | — | — |
| REQ-LIB-38 | §3.4 | Pointed at a prospect's answers, the auditor produces a marked map + deployment plan | — | — |
| REQ-LIB-39 | §3.3 | `company/COMPANY.md` carries the interview's section structure with honest gap markers | `company/COMPANY.md` | manual read |
| REQ-LIB-40 | PART VII | `company/COMPANY.md` carries the PDPL data-handling block every runner invocation inherits | `company/COMPANY.md` | `rtl-arabic-pdpl-specialist` review |
| REQ-LIB-41 | §3.3 | `company-interview` asks the ~20 questions incl. Arabic/MSA register, red lines, PDPL | `agents/intelligence/company-interview/SKILL.md` | manual read |
| REQ-LIB-42 | PART IV | Every agent ships `status: draft`; nothing hand-sets `live` | `agents/` | validator warns on any hand-set `live` |
| REQ-LIB-43 | PART IV | Validator: every `wired_into` name exists in `agents/_registry/connectors.json` (invariant 5); the file is required | `scripts/validate-frontmatter.mjs` | `node scripts/validate-frontmatter.mjs` |
| REQ-LIB-44 | PART IV | Seeder only emits `wired_into` names that exist in the connector registry | `scripts/seed-agents.mjs` | `node scripts/seed-agents.mjs` |
| REQ-LIB-45 | PART IV | The department enum is declared exactly once — `DEPARTMENT_SLUGS` in `departments.ts`; `frontmatter.ts` aliases the type and declares no `DEPARTMENT*` value (ADR-001, ADR-035) | `packages/contracts/src/departments.ts` | `scripts/__tests__/barrel-exports.test.mjs` |
| REQ-LIB-46 | PART IV | No runtime name is exported by two `export *` modules of `packages/contracts/src/index.ts` — the duplicate makes Next discard the whole barrel and every client import resolve to `undefined` (ADR-035) | `scripts/check-barrel-exports.mjs` | `scripts/__tests__/barrel-exports.test.mjs` |
| REQ-LIB-47 | PART IV | An explicit `export { X } from` that shadows a starred **value** is refused — it silences TS2308 and does not fix the bundler (ADR-035) | `scripts/check-barrel-exports.mjs` | `scripts/__tests__/barrel-exports.test.mjs` |
| REQ-LIB-48 | PART VI | A gate boots the app and observes the artifact: every route 2xx and renders the shell, the compile log is free of `Attempted import error` / `conflicting star exports`, and every `__barrel_optimize__?names=N` client module exports `N` | `scripts/smoke-routes.mjs` | `npm run smoke` — falsified against the live broken dev server (ADR-035) |

## Interfaces we expose

- **`packages/contracts/src/departments.ts`** — `DEPARTMENT_SLUGS` (the literal tuple; the
  **only** declaration of the department enum, ADR-001/ADR-035), `DEPARTMENT_LABELS`,
  `DEPARTMENTS` (the ordered angle/rail table), `DepartmentSlug`, `DepartmentInfo`,
  `isDepartment`, `getDepartment`, `findDepartment`, `departmentLabel`.
- **`packages/contracts/src/frontmatter.ts`** — `Department` (a **type alias** of
  `DepartmentSlug`, never a value), `TIERS`, `PHASES`, `STATUSES`, `APPROVALS`, `INPUT_TYPES`,
  `LADDER_RUNGS`; types `AgentFrontmatter`, `InputField`, `Delivery`, `Ladder`,
  `ClusterRegistry`, `ConnectorRegistry`, `ConnectorDefinition`, `AgentFile`,
  `ValidationReport`; schemas `agentFrontmatterSchema`, `clusterRegistrySchema`,
  `connectorRegistrySchema`; helpers `toSlug`, `isCronExpression`, `parseAgentFrontmatter`,
  `parseConnectorRegistryJson`.
  Nothing else in the repo may hardcode a department name, a tier or a phase.
- **`agents/_registry/clusters.json`** — the cluster registry. Keys are the seven
  department slugs; each value is an ordered `{slug, label}[]` whose first three entries are
  the department's map sub-labels (§2.1).
- **`agents/_registry/connectors.json`** — the connector registry. Vocabulary for
  `wired_into` (invariant 5). Keys are kebab-case slugs; values are `{label, tools[], note?}`.
  `$`-prefixed keys are comments.
- **`scripts/validate-frontmatter.mjs`** — CLI (`--json`, `--strict`) and importable
  (`validateAll()`, `parseFrontmatter()`, `parseConnectorRegistry()`, `toSlug()`,
  `isCronExpression()`). `validateAll()` returns `ValidationReport`; consumers render
  `agents[]` and surface `excluded[]` as a warning. Run it before every layout recompute.
- **`agents/**/SKILL.md`** — the library itself. Twelve curated agents at M0.
- **`company/COMPANY.md`** — the brain the runner injects into every invocation (§3.3).

## Interfaces we consume

- `comms/decisions/ADR-001-department-taxonomy.md` — the department enum and order.
- `comms/decisions/ADR-002-repo-shape.md` — `packages/contracts/` is the code half of
  `comms/contracts/`, and the validators assert the two agree.
- `comms/contracts/frontmatter-schema.md` — our own contract; the prose is normative.
- `packages/contracts/package.json` (owner `infra-compose-engineer`) — must declare `zod`.
- `apps/runner/src/lib/allowlist.ts` `CONNECTOR_REGISTRY` (owner `runner-engineer`) — the
  code half of `agents/_registry/connectors.json`. Same keys, or a name that validates
  here 422s at run time. We do not edit that file.
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
- **`typecheck`.** `packages/contracts` now has `package.json` with `zod` and a `typecheck`
  script (owner `infra-compose-engineer`). REQ-LIB-02 is verified by `npm run typecheck`
  in that workspace.

## Deliberately not done

- **The other ~48 agents.** The spec says curate to ~60 (Part IV) and grow weekly
  (Part VII.3 — "their new agent every week is your git log"). Twelve excellent ones with
  every branch populated and a working matrix spread is the M0 obligation; a batch of
  thin ones this week would make the count look better and the library worse.
- **Bulk-running the seeder.** Deliberate, and the reason the script defaults to a dry run.
  Dumping 137 unreviewed agents is the exact failure Part VII.3 warns about.
- **`agent-auditor` runtime (REQ-LIB-35–38).** The SKILL.md is authored under Operations.
  Walking Langfuse, writing `audit/report.md`, and committing `status` is M7, with
  `runner-engineer` and `observability-engineer`.
- **Keeping the runner's `CONNECTOR_REGISTRY` in lockstep.** The JSON is ours; the grant
  is theirs. A drift test on the runner side is `runner-engineer`'s. We do not edit
  `apps/runner/**`.
- **Checked-in negative fixtures + `node --test`.** `package.json` points `test` at
  `scripts/__tests__/*.test.mjs`, which is not a path I own at M0. The fixtures exist as a
  documented manual procedure; converting them is a 30-minute job for whoever owns that
  directory.
- **`packages/contracts/departments.ts`** (ADR-001's angle/rail table). Not my file. The
  ordered array lives in `frontmatter.ts` and `departments.ts` must import it rather than
  restate it — the collision is flagged in `packages/contracts/src/index.ts`.
- **Leaf skill files.** `breaks_into` entries are declared inline and the map synthesises
  the dots. Writing 36 stub files for the twelve agents' leaves would add files nothing
  reads. `agent-auditor` reports orphans in the other direction (a file nobody references).
- **Promoting anything to `status: live`.** Nothing has run. The LIVE counter reads zero
  and that is the correct number today.
- **Lucide as an authoritative check.** `lucide-react` is not installed at M0, so icons are
  checked against an embedded name list. The validator switches to the installed package's
  real export list automatically once M1 adds the dependency.
