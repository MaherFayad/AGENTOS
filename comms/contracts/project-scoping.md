# CONTRACT — Project scoping, the cascade, and identity

**Owner:** `runner-engineer` — **in trust** for `platform-projects-engineer`, who is defined
in `.claude/agents/` but is not on the BOARD roster and cannot yet be spawned. Ownership
transfers on the session that agent first runs; until then every edit is `runner-engineer`'s
and every change request goes to them.

**Source:** `AGENTOS-V2-PLAN.md` Part Two §9 · §10 · §11 — **a plan that amends the spec of
record, not spec** ([ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md)).
Cite these as `Plan §10`, never `§10`.

**Sibling contract:** [`agent-cascade.md`](agent-cascade.md), owned by
`agent-library-curator`. It owns **resolution**; this file owns the **mount**. The boundary
is its §0 and it is accepted verbatim in ADR-013.

**Status:** **partly authoritative.** §5.1's Q1–Q8 are **answered** by
[ADR-015](../decisions/ADR-015-project-scoping.md) (proposed, 2026-08-17) and are built —
§5.1 now records the answers rather than the questions. **Q8b and §5.3's Q17/Q19 remain OPEN
and nothing may be built against them.** A section still marked OPEN is a question, and a
consumer who guesses an answer to it has invented a contract; each names the single agent who
must answer it and the ADR that will record it.

**What "built" does and does not mean here.** The schema exists, the routes carry a project,
the cascade resolves and refuses. **None of it is validated.** §6 is the list of what cannot
be, it is a section of this contract rather than a footnote because consumers need to read
it, and it has not shrunk.

---

## 1. What this contract governs

The project axis, added to a system that has none. Three things that arrive together and
cannot be separated:

| Half | Plan § | Answered by |
|---|---|---|
| **Projects** — `ops.project`, mounting libraries, project-scoping every table and route | §9 · §10 | [ADR-015](../decisions/ADR-015-project-scoping.md) *(proposed 2026-08-17)*, this file |
| **The cascade** — global → project → project-local override, resolved by slug | §10 | ADR-014 *(proposed)*, `agent-cascade.md` |
| **Identity** — identity, device and billing account as three orthogonal things | §11 | [ADR-016](../decisions/ADR-016-identity-device-billing-account.md), `identity-access-engineer` |

---

## 2. Invariants — already fixed by Part Two, not open for design

These are constraints, not preferences. A design that violates one is a bug.

1. **`ops.project` describes a mount, never a capability.** ADR-009's rule is unchanged and
   now load-bearing at N projects: the Operations plane may never be the only place a
   capability is described. A project row may reference `agents/sales/account-enrichment`;
   it may never define it. (Plan §9)

2. **Deleting a project detaches a library. It never deletes one.** `rm -rf` on the
   Operations volume loses history, board state and memory — **not a single agent, in any
   project**. (Plan §9)

3. **BOARD constraint #4 survives intact.** Frontmatter is still the single source of truth.
   The cascade changes **which files are read**, never where the truth lives. (Plan §10)

4. **Provenance is always on screen.** `⌂ global` · `▣ project` ·
   `⑂ forked from global@a1b2c3`, on the node, the job card, the roster row and the drawer
   header. Running "the code-reviewer" and getting the global one when you meant the fork is
   a bug class **with no error message**; provenance is its only mitigation and it is not
   optional. (Plan §10, §21.9)

5. **A forked agent whose parent has moved on shows a staleness dot** — the same honesty
   rule as connector health. (Plan §10)

6. **The shape is shared; the roster is not.** Every project gets the same departments so
   navigation transfers instantly. Sales-in-AgentOS and Sales-in-ClientX are different
   rosters in an identical frame. (Plan §10)

   **Seven or eight — corrected, and scoped out of M15.** An earlier revision of this line
   said "the same **seven** departments (ADR-001)" and cited Plan §10. That was half a
   quotation: the same §10 also says *"An eighth department, `engineering`, holds the build
   specialists per project."* `agent-library-curator` caught it. Both halves are in the
   plan, so the plan is not contradicting itself — seven **business** departments per
   ADR-001, plus `engineering` for the build specialists.

   **The eighth is out of M15 scope, by decision.** It is an ADR-001 amendment touching
   radial force groups, a §2.6.1 tab bar built for seven, `clusters.json` and a department
   enum with five consumers — and `Plan §3`/§23 also want an adapter, because Claude Code
   agent frontmatter and Command Center frontmatter are not the same schema. None of that
   is needed to mount a project. `agent-library-curator` files it when
   `map-galaxy-engineer` and `chart-matrix-engineer` have priced the layout cost. **What
   M15 must not do is bake `7` into a project-shaped structure** — nothing here may assume
   the count.

7. **Project-scoping is an audit of everything already built, not an addition to it.**
   `ops.run_ledger`, `ops.memory`, `ops.task`, `ops.question`, `ops.thread`, `ops.schedule`,
   the index, all 34 metrics endpoints and the panels resolver. Budget it as an audit.
   (Plan §10, §21.1)

8. **Isolation is proved by a failing query, not by a filter.** A query that reaches a
   project-scoped table without a project predicate **fails**, in a test, rather than
   returning another project's rows. A nullable project column and a forgotten `WHERE` is
   the exact mechanism by which client A's data reaches client B. (Plan §21.8)

9. **Identity, device and billing account are three tables, orthogonal.** One you, N
   devices, M paying accounts. **Scopes live on the device, not the identity** — losing a
   phone is then a revocation, not an incident. (Plan §11)

10. **Every run records the account that paid, per project.** Cost surfaces split by account
    *and* by project. (Plan §11)

11. **Nothing moves on disk.** AgentOS becomes `project: AgentOS` in place; the coordinator
    mounts what is already there. (Plan §24)

12. **Transport is unchanged.** Tailnet-only. Nothing in this contract is safe only because
    auth exists (BOARD #5, spec §3.6).

---

## 3. `ops.project` — the columns, and what enforces each claim

Types, keys, nullability and migration order are **fixed** by ADR-015 and built in
`apps/runner/src/db/migrations/0005_project_axis.sql`.

The third column is the point of this table. Two of these columns are **declared and read by
nothing**, and both say so in the API rather than looking enforced — a cap rendered next to
no enforcement is a UI telling a lie it was handed.

| Column | Meaning | What enforces the claim |
|---|---|---|
| `id` | `md5('agnetos.project:' || slug)::uuid`, derived then **stored** — so renaming a slug keeps the id and every ledger row on it | `project-id.test.ts` reads the migration and asserts the SQL expression against `projectIdForSlug` character-for-character |
| `slug`, `name` | kebab, and never `all` / `p` / `api` | `CHECK slug_is_a_slug`, `CHECK slug_is_not_reserved`, mirrored by `isProjectSlug` and asserted equal |
| `library_path` | the repo holding `agents/`, `panels/`, `company/` on **this** host | `NOT NULL` |
| `library_remote` | **cannot be stored.** A git remote is an egress event of the same class as a `deliver:` target leaving the tailnet | `CHECK library_remote_needs_egress_adr (library_remote IS NULL)` — until that ADR lands, no code path can act on one |
| `workspace_root` | where runs get their scratch space | `NOT NULL`; confined per run by `isPathInsideScratch` |
| `host_affinity[]` | which execution hosts may run this project | **Declared, read by nothing.** `ProjectSummary.hostAffinityEnforced: false` |
| `default_account_id` | which billing account pays, by default | composite FK to `ops.billing_account (id, kind)`, so it cannot point at a connector secret |
| `budget_monthly` | a hard cap | **Declared, not enforced in M15** (ADR-015 Q6). `ProjectSummary.budgetEnforced: false`. The one enforced ceiling is Part V's workspace cap in the runner |
| `status` | `active · paused · archived` | `CHECK` on the enum; `CHECK archived_has_a_date`; `project_not_active` (409) is a distinct refusal |

Deleting a row is **refused** while any history hangs off it: every foreign key into this
table is `ON DELETE RESTRICT`. Archiving is the removal path (ADR-015 Q4).

---

## 4. The cascade — a pointer, not a copy

```
global library         ~/agentos/global/agents/**
      ↓ overridden by
project library        <repo>/agents/**
      ↓ overridden by
project-local override <repo>/agents/_overrides/**
```

Resolution is by slug; most-specific wins; the resolved set is what MAP, CHART and
DASHBOARDS project.

**Resolution semantics are defined in [`agent-cascade.md`](agent-cascade.md), owned by
`agent-library-curator`, and are deliberately not restated here.** This contract owns only
the **mount**: which roots exist, where they are fetched from, in what order they are read,
for which project. Two documents describing one resolution algorithm will drift, and the
drift will be invisible until a run picks the wrong agent — which is §21 risk 9, the bug
class with no error message.

`agent-cascade.md` has already fixed, as proposals under ADR-014, several things this file
would otherwise have had to ask. The two that matter most to a consumer of *this* contract:

- **Resolution is by `(department, slug)`, whole-file, with no field-level merge.** That
  closes the security question a merge would have opened: a project layer cannot add to a
  global agent's `wired_into`, so editing a project library is not a capability grant
  (CLAUDE.md rule 4, spec §3.2).
- **A file that fails validation is excluded and does not fall through to the layer below.**
  Fall-through would mean a typo in your override silently runs the global agent with the
  global agent's wider tool list.

Read that contract before building anything that consumes a resolved agent.

**The mount is what a read derives from — amended 2026-08-17.** This contract owns which
roots exist for which project, and it now also owns the shape that keeps that true at the
call site: **the resolved project carries its own `agentsDir`, `overridesDir`, `panelsDir`,
`companyFile` and `graphFile`, and every library read takes the project rather than the
coordinator's configuration.** Until 2026-08-17 five read handlers resolved `:project` and
then read the coordinator's paths — agreeing with the run path only because one library is
mounted. That is invariant 8's argument in the library plane: agreement between two variables
is not derivation from one, and the difference is invisible until a second mount exists.
`MountedProject` has no `RunnerConfig` shape, so the agreement is now a compile-time property
of the parameter list rather than a thing a reviewer has to notice
(`apps/runner/src/routes/__tests__/project-derived-reads.test.ts`).

---

## 5. OPEN — the questions that must be answered before code

Grouped by the one agent who owns the answer. Each says what it costs to specify loosely,
because that is the only way to tell a question worth an ADR from a preference.

### 5.1 `ops.project` and project-scoped routes — **ANSWERED by ADR-015**

Q1–Q8 are decided and implemented. Kept here as answers rather than deleted, because a
consumer reading this section needs the ruling and the reason, and the reason is what stops
someone re-opening it out of convenience. The full argument is in
[ADR-015](../decisions/ADR-015-project-scoping.md); this is the summary a consumer can build
against.

| Q | Answer | The mechanism, not the intention |
|---|---|---|
| **Q1** How does a request name its project? | **Path segment, `/api/p/:project/…`. There is no default, no header and no session state.** Coordinator-scoped routes (`/api/status`, `/api/projects`) carry no segment and say so; deliberately cross-project routes live under `/api/all/` and there are exactly two. | `resolveProject` in `lib/project.ts`, called at the head of every scoped handler — a **function, not a hook**, so a route that forgets it fails to compile rather than serving unguarded. Asserted at the wire in `routes/__tests__/api.test.ts`. |
| **Q2** Is there a server-side "current project"? | **No.** Not a cookie, not a header, not "the only one we mount". An ambient default is how one client's data gets served under another client's name. | There is no such variable to find. The pre-project paths stay mounted and answer **400 `project_scope_missing`** naming the scoped path — never a 404 (reads as a deleted feature) and never a redirect to a default. Registered from `LEGACY_UNSCOPED_PATHS`, so the contract decides which exist. |
| **Q3** The project of a row that predates projects? | **Backfill to `agentos`, then `NOT NULL`.** Decided before the first migration, as this section demanded. | `UPDATE … WHERE project_id IS NULL` then `ALTER COLUMN … SET NOT NULL` in `0005_project_axis.sql`. The backfill is written although zero rows exist, because the migration will only ever be re-applied to a database that has some. |
| **Q4** Delete cascade or tombstone? | **Neither. The delete is refused while history exists; archiving is the removal path.** `Plan §9` guarantees the library survives; this extends the same promise to history. | Every FK into `ops.project` is `ON DELETE RESTRICT`, so `DELETE FROM ops.project` with one ledger row behind it **fails in the database**. `CHECK archived_has_a_date`. |
| **Q5** Is `library_remote` a clone the coordinator performs? | **Not in M15, and it cannot even be recorded.** A `git push` sends a project library to a third party — the same class of event as a `deliver:` target leaving the tailnet (BOARD, Part VII.4). | `CONSTRAINT library_remote_needs_egress_adr CHECK (library_remote IS NULL)`. Until that ADR lands and a later migration drops it, **no remote can be stored, so no code path can act on one.** Dropping a constraint is reviewable; ignoring a comment is not. |
| **Q6** Which of the two enforcement points is authoritative? | **Part V's capped API-key workspace in the runner, and it is the only enforced one.** `ops.project.budget_monthly` is declared and **not** enforced in M15: spend-per-project can only be computed from ledger rows, and zero runs have ever executed, so any cap derived from it is a false refusal or a silent pass. | `ProjectSummary.budgetEnforced: false` ships next to the number on every response. A cap rendered beside no enforcement is a UI telling a lie it was handed. |
| **Q7** `host_affinity[]` now or later? | **Built now, read by nothing.** Deferring means a migration on a live ledger later; the column is free. | `ProjectSummary.hostAffinityEnforced: false`, same rule as Q6. `project_not_mounted` (503, not 404) is the refusal a project on another host gets, so "wrong machine" never reads as "wrong name". |
| **Q8** Are `panels/*.json` cascaded like agents? | **No — not in M15.** Panels are mounted per project, not resolved through layers. ADR-014's rules are written about `agents/**` and depend on properties panels do not have: a capability ceiling, a `status` derived from runs, an `agent_ref`. **A project with no `panels/` of its own shows nothing — see Q8a below, which was deferred and is now answered.** | `GET /api/p/:project/panels[/:id]` reads `MountedProject.panelsDir`; `apps/runner/src/lib/panels.ts` cannot import `RunnerConfig`, so a project route cannot serve the coordinator's dashboards. `project-derived-reads.test.ts`. **The web app's own `loadPanels()` still walks a fixed candidate list and is `dashboards-engineer`'s — see the amendment below.** |

#### Q8a — what a project with no `panels/` of its own shows. **ANSWERED: nothing.**

Q8 deferred this deliberately (*"answering it now would mean designing it with one project to
test against"*), and `dashboards-engineer` reported on 2026-08-17 that it had become the thing
blocking the build. It is answered here rather than deferred again, because the alternative is
a contract asserting a behaviour nobody chose.

> **A project with no `panels/` shows an empty carousel. There is no fallthrough to a
> coordinator-level set, and no coordinator-level set exists to fall through to.**

Three reasons, and **none of them is inherited from ADR-014** — that ADR ruled against
fallthrough for *agents*, on an argument about capability ceilings that panels do not have,
so borrowing its conclusion would be borrowing a result without its reason:

1. **A panel is a query shape, not a document.** It names agents, departments and metrics from
   the library it was written against. Inherited into another project it renders that
   project's *frame* filled with this project's numbers — and there is no state in which that
   is distinguishable, on screen, from a dashboard someone meant to build. A widget that is
   empty because the panel does not belong here looks exactly like a widget that is empty
   because nothing has run.
2. **There is no coordinator tier in the mount model.** `panelsDir` is a field of
   `MountedProject`; today's "coordinator panels" *are* the one mounted project's. A
   fallthrough answer would require inventing a second tier first, and inventing a tier to
   hold a default is how the ambient default this whole ADR removes gets back in through
   another door.
3. **An empty carousel is an honest empty state** (BOARD rule 9), and it is a state the
   product already renders. Six Command Centers appearing in a client project that never
   asked for them is not a nicer default; it is six dashboards a person has to disprove.

*Reversible, and cheaply:* adding a fallthrough later is additive and touches one function.
Removing one after projects have relied on it is not. The conservative direction is the one
that can still change its mind.

**What is built, and what is not — so this row cannot become the thing it is correcting:**

| | State |
|---|---|
| `GET /api/p/:project/panels` and `…/panels/:id` serve `MountedProject.panelsDir` | **built**, `apps/runner/src/lib/panels.ts`, verified in `project-derived-reads.test.ts` |
| A project with no `panels/` answers `{panels: []}` and `panel_not_found` naming the project | **built**, same test |
| `apps/web/src/dashboards/data/load.ts` — `loadPanels()` takes no project and walks `PANELS_DIR`, `/panels` and three monorepo-relative candidates | **not built, and it is `dashboards-engineer`'s.** The resolver they asked for is a route, not a fourth candidate: `GET /api/p/:project/panels`. The web app has no business reading `ops.project.library_path` off a disk it may not share |
| Both dashboard routes destructure only `id` and discard `:project` | **not built**, `dashboards-engineer` |
| Resolution rules if panels ever *do* cascade | not written, and correctly not — `dashboards-engineer` against ADR-004's six centres, when a second project exists to write them against |

Until the web half lands, **six Command Centers render identically in every project** — which
is true of exactly one project today, so it is a latent defect rather than a live one. Filed
back with the owner and named here so a reviewer reading Q8 is not told it was done.

**Still OPEN in this subsection — one question, and it is the highest-stakes one:**

- **Q8b. Does each project get its own `COMPANY.md`, or is there one brain across projects?**
  (`Plan §15` says both: a **global** tier that follows you across every project *and* a
  **project** tier.) *Loose costs:* the brain is injected into **every run** (spec §3.3).
  Getting this wrong is not a display bug — it is client A's company context reaching an
  agent running for client B, on every single invocation, which is the PDPL boundary rather
  than a scoping preference. Owner: `rtl-arabic-pdpl-specialist` answers the isolation half;
  `runner-engineer` implements the mount half. **This is the highest-stakes question in the
  contract and it does not look like it.**

  **What M15 built while it waits, and why that direction:** `company/` resolves **per
  project, with no global fallback**. That is the conservative side of an unanswered
  question — if the ruling is "one brain", adding a fallback is additive; if a global brain
  had been assumed and the ruling goes the other way, the leak would already have happened,
  on every run, with no error message. Nothing in ADR-015 depends on the answer.

### 5.2 The cascade — **not asked here.** → [`agent-cascade.md`](agent-cascade.md), ADR-014

This section deliberately contains no questions.

An earlier draft of this file posed seven (resolution unit, replace-vs-merge, `wired_into`
under merge, override-keying, validation failure, fork SHA and staleness, promote
semantics, determinism). While it was being written, `agent-library-curator` filed
`agent-cascade.md` and ADR-014, which answer all of them as proposals — and answer the
security-relevant one, `wired_into` under merge, in the safe direction.

Those questions were deleted rather than kept "for reference". **A question asked in two
contracts is one contract with two readings**, and the second reading is the one that gets
built. ADR-013 accepts the boundary: resolution is `agent-cascade.md`'s, the mount is this
file's.

What remains genuinely open on the cascade is listed in `agent-cascade.md` §8 and routed by
its owner — including one item that is *not* the curator's to answer and is flagged there:
**"one brain or N?"**, routed to `rtl-arabic-pdpl-specialist`. That question belongs to this
file's subject matter too, because `company/COMPANY.md` is mounted by a project row, and it
is tracked as Q8b below.

- **Q8b. Does each project get its own `COMPANY.md`, or is there one brain across
  projects?** (`Plan §15` says both: a **global** tier that follows you across every project
  *and* a **project** tier.) *Loose costs:* the brain is injected into **every run**
  (spec §3.3). Getting this wrong is not a display bug — it is client A's company context
  reaching an agent running for client B, on every single invocation, which is the PDPL
  boundary rather than a scoping preference. Owner: `rtl-arabic-pdpl-specialist` answers the
  isolation half; `runner-engineer` implements the mount half. **This is the highest-stakes
  question in the contract and it does not look like it.**

### 5.3 Identity, device, billing account — owner: `identity-access-engineer` → ADR-016

**The gap this section recorded is closed.** `identity-access-engineer` was written on
2026-08-16 and now owns §11 and [ADR-016](../decisions/ADR-016-identity-device-billing-account.md).
The interim split below is kept as history, because the transfer was a written exchange rather
than a drift — and because Q17 and Q19 are still open under their new owner.

**What ADR-015 settled here, and why it is here rather than in ADR-016:** `Plan §11` names one
`ops.credential`; ADR-014 §3.1 needs it keyed `(project_id, connector)`. Those are two tables,
not one, because a **billing account is deliberately cross-project** (one work account pays for
four clients) and a **connector credential is deliberately project-only**. One table would have
forced a nullable `project_id`, which is invariant 8's failure mode with the safety off. So:
`ops.billing_account` and `ops.credential`, split in ADR-015, named in ADR-016.

| Concept | Question it answers | Table | M15 interim owner |
|---|---|---|---|
| Identity | who is asking? | `ops.identity` | `runner-engineer`, as schema custodian only |
| Device | from what, with what powers? | `ops.device` | `sessions-relay-engineer` |
| Billing account | who *pays* for this run? | `ops.credential` | `runner-engineer` |

- **Q16. Which of the three tables does M15 build, and which does it only define?**
  **ANSWERED (ADR-015):** all three are defined; `billing_account` and `credential` are built
  and project-scoped; `ops.identity` is a foreign-key target that nobody populates; **no
  scopes enforcement** is built. Reason in Q17.

- **Q17. Scopes live on the device — enforced at what point?** BOARD #5 says there is no
  auth boundary in v1 by design. *Loose costs:* **a scope with no enforcement point is a
  comment.** Building a scopes model now means building it against no threat model and
  rewriting it when the auth ADR lands (`Plan §3`'s "auth exists in v2", still unwritten and
  unnumbered here). Recommend deferring enforcement and saying so in the handoff rather than
  shipping a decorative column.

- **Q18. `ops.credential` is "encrypted at rest with the key outside Postgres" — outside
  where?** **ANSWERED (ADR-015): nowhere, because there is no ciphertext.** Neither table
  stores secret material; `secret_ref` is the *name* of a secret — an env var, a file on a
  mounted volume — resolved at dispatch. "The key is outside Postgres" is then **structurally
  true** rather than a claim about an encryption routine nobody has written: there is no
  column to decrypt and no key to lose. A `secret_ref` that resolves to nothing fails the run
  with `connector_uncredentialed` and names the ref in the hint.

  **And there is no global credential fallback.** A project that declares `hubspot` and holds
  no credential for it fails; it does not reach another project's. *The mechanism is the
  absence of a fallback path*: the primary key has no nullable `project_id` to fall through
  to, and the lookup has no second branch (ADR-014 §3.1). Stated as a rule precisely because
  "fall back to the global one" is the convenience a future implementer adds at 2am to unblock
  one project.

- **Q19. Does `account_id` join the E2E envelope allowlist (§3.1)?** `sessions/relay/
  envelope.ts` **rebuilds** rows from an allowlist rather than filtering them, and its own
  comment demands that any added key arrive by deliberate ADR. *Loose costs:* this is one of
  the best-designed files in the repo and the E2E boundary is CLAUDE.md rule 5. Whoever
  answers this must be `sessions-relay-engineer`.

- **Q20. How is the paying account chosen per run?** **ANSWERED (ADR-015): project default
  plus a per-run override, and no frontmatter field** — billing is not part of an agent's
  identity, and the same agent in two projects must be able to bill to two accounts.
  Recorded on `ops.agent_runs.account_source`, whose third value is **`unattributed`** and is
  a named state rather than a `NULL`: "we do not know who paid" must be its own bucket on a
  cost-by-account surface, not rows the chart quietly drops. *Enforced by:*
  `CHECK account_provenance`, which makes `account_id IS NULL` legal **only** when
  `account_source = 'unattributed'`.

---

## 6. What this contract cannot validate yet

Stated here because a contract that hides its own untestability is worse than one that has
gaps. Every item below is blocked on a **human** decision on the BOARD, not on an agent.

| Cannot be validated | Why | Unblocked by |
|---|---|---|
| The cascade picks the right agent | resolution can be unit-tested; **choosing wrong has no error message** and only a real run reveals it (Plan §21.9) | `RUNNER_ANTHROPIC_API_KEY` |
| Cross-project isolation, empirically | `ops.run_ledger` has no rows to leak; isolation can only be proved **structurally** in M15 | `RUNNER_ANTHROPIC_API_KEY` |
| `budget_monthly` refusal | no run has ever cost anything | `RUNNER_ANTHROPIC_API_KEY` |
| `default_account_id` / "the run recorded who paid" | there are no runs | `RUNNER_ANTHROPIC_API_KEY` |
| `host_affinity[]` | there is one host and Tailscale is not installed | the Tailscale decision |
| Per-project `COMPANY.md` | the one project that exists is 0/20 answered, so a per-project brain has no observable difference from a global one | the 20 interview answers |
| Switcher, breadcrumb and provenance badge at 1440px | there is no reference frame and no headless browser | the headless-browser / reference-frames pair |

`rtl-arabic-pdpl-specialist`'s sign-off is **mandatory** on cross-project isolation
(Plan §22) and must state which of the two it is: **structural** (a query without a project
predicate fails) or **empirical** (real rows in two projects, proven not to cross). In M15
it can only be the first. Signing it off as the second would be the lie this whole project
is organized to avoid.

---

## 7. Consumers

`agent-library-curator` (cascade) · `shell-navigation-engineer` (switcher, routes,
breadcrumb, project-scoped search and cost ticker) · `observability-engineer` (project axis
on all 34 metrics endpoints, account split) · `sessions-relay-engineer` (`ops.device`, the
envelope) · `drawer-engineer` (provenance in the drawer header) · `design-system-guardian`
(the provenance badge as a monochrome primitive) · `rtl-arabic-pdpl-specialist` (isolation
sign-off, RTL of the switcher).

Anything not written above is not a promise. Ask; do not guess.
