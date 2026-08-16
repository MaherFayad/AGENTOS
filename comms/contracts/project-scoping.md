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

**Status:** **skeleton.** This file states what Part Two has already fixed and what is still
open. **It is not yet authoritative and nothing may be built against its open questions.** A
section marked OPEN is a question, and a consumer who guesses an answer to it has invented a
contract. Each open question names the single agent who must answer it and the ADR that
records the answer.

---

## 1. What this contract governs

The project axis, added to a system that has none. Three things that arrive together and
cannot be separated:

| Half | Plan § | Answered by |
|---|---|---|
| **Projects** — `ops.project`, mounting libraries, project-scoping every table and route | §9 · §10 | ADR-015 *(claimed, unwritten)*, this file |
| **The cascade** — global → project → project-local override, resolved by slug | §10 | ADR-014 *(proposed)*, `agent-cascade.md` |
| **Identity** — identity, device and billing account as three orthogonal things | §11 | ADR-016 *(claimed, unwritten)*, **owner unassigned** |

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

## 3. `ops.project` — the columns Part Two already names

Types, keys, nullability and migration order are **open** (§5.1).

| Column | Meaning |
|---|---|
| `id`, `slug`, `name` | identity |
| `library_path` / `library_remote` | the git repo holding `agents/`, `panels/`, `company/` |
| `workspace_root` | where runs get their scratch space |
| `host_affinity[]` | which execution hosts may run this project |
| `default_account_id` | which billing account pays, by default |
| `budget_monthly` | hard cap, enforced by the scheduler and the runner |
| `status` | `active · paused · archived` |

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

---

## 5. OPEN — the questions that must be answered before code

Grouped by the one agent who owns the answer. Each says what it costs to specify loosely,
because that is the only way to tell a question worth an ADR from a preference.

### 5.1 `ops.project` and project-scoped routes — `runner-engineer` → ADR-015

- **Q1. How does a request name its project?** Path segment (`/api/p/:project/runs`), an
  explicit header, or server-side session state? *Loose costs:* a header is invisible in a
  log and in a bug report; server-side session state is an **ambient default**, and an
  ambient default is the mechanism by which one project's data is served under another
  project's name. A path segment is greppable, cacheable, and impossible to forget.
  Recommend the path segment; it is the reversible choice.

- **Q2. Is there a server-side "current project" at all?** *Loose costs:* if yes, every
  route has two ways to be scoped and only one of them appears in tests.

- **Q3. What is the project of a row that predates projects?** `ops.run_ledger` and the
  metrics tables need a backfill or a NOT NULL default. *Loose costs:* a nullable
  `project_id` is invariant 8's failure mode with the safety off. Decide backfill-to-AgentOS
  vs NOT NULL-with-default **before** the first migration, not after.

- **Q4. Does deleting a project cascade-delete its ops rows, or tombstone them?** Plan §9
  guarantees the *library* survives and says nothing about history. *Loose costs:* history
  you cannot read is history you have lost, and this is discovered exactly once.

- **Q5. Is `library_remote` a clone the coordinator performs?** If yes: cloned where, with
  whose credentials, and **is a git remote an egress decision?** The BOARD already holds an
  open question that any `deliver:` target leaving the tailnet needs its own ADR (Part
  VII.4). A `git push` to GitHub is the same class of event.

- **Q6. `budget_monthly` is enforced in two places** — the runner refuses to start at the
  cap (Part V, already built) and the scheduler refuses to fire (Plan §14). *Loose costs:*
  two enforcement points reading one number will disagree, and the disagreement will look
  like a bug in whichever one you are watching. Name the authoritative one.

- **Q7. `host_affinity[]` with exactly one host.** Build the column now against a single
  localhost, or defer it? *Loose costs:* deferring means a migration on a live table later;
  building it now means a column nothing reads. Cheap either way — but decide, don't drift.

- **Q8. Are `panels/*.json` cascaded like agents?** ADR-004 fixed six Command Centers. Are
  those six global, per-project, or global-with-project-overrides? *Loose costs:* §2.5.6
  says a seventh centre or a rename is a rail-order change in six files. Multiply that by N
  projects before choosing.

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

### 5.3 Identity, device, billing account — **owner unassigned** → ADR-016

**This is the real gap in M15 and it is recorded here rather than papered over.** Plan §22
creates five specialists and none of them owns §11; the plan's intended owner,
`identity-access-engineer`, is carried over from Part One §6 and was never defined.

| Concept | Question it answers | Table | M15 interim owner |
|---|---|---|---|
| Identity | who is asking? | `ops.identity` | `runner-engineer`, as schema custodian only |
| Device | from what, with what powers? | `ops.device` | `sessions-relay-engineer` |
| Billing account | who *pays* for this run? | `ops.credential` | `runner-engineer` |

- **Q16. Which of the three tables does M15 build, and which does it only define?**
  Recommend: define all three; populate `credential` and `device`; build **no scopes
  enforcement**. Reason in Q17.

- **Q17. Scopes live on the device — enforced at what point?** BOARD #5 says there is no
  auth boundary in v1 by design. *Loose costs:* **a scope with no enforcement point is a
  comment.** Building a scopes model now means building it against no threat model and
  rewriting it when the auth ADR lands (`Plan §3`'s "auth exists in v2", still unwritten and
  unnumbered here). Recommend deferring enforcement and saying so in the handoff rather than
  shipping a decorative column.

- **Q18. `ops.credential` is "encrypted at rest with the key outside Postgres" — outside
  where?** An env var on the runner means a container recreated without it is a lockout with
  no recovery path. A file on a mounted volume means the volume is now a secret. *Loose
  costs:* this is discovered during an outage, at the worst possible moment.

- **Q19. Does `account_id` join the E2E envelope allowlist (§3.1)?** `sessions/relay/
  envelope.ts` **rebuilds** rows from an allowlist rather than filtering them, and its own
  comment demands that any added key arrive by deliberate ADR. *Loose costs:* this is one of
  the best-designed files in the repo and the E2E boundary is CLAUDE.md rule 5. Whoever
  answers this must be `sessions-relay-engineer`.

- **Q20. How is the paying account chosen per run?** Project default only, a run input, or a
  frontmatter field? *Loose costs:* a frontmatter field makes billing part of an agent's
  *identity*, which is very likely wrong — the same agent in two projects should be able to
  bill to two accounts. Recommend project default plus a per-run override, no frontmatter
  field.

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
