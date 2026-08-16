# WORKING DRAFT — The agent cascade

**Owner:** `agent-library-curator` · **Status:** **draft of [ADR-014](../decisions/ADR-014-agent-cascade-resolution.md),
not a contract** · **Milestone:** M15 (P1)
**Source:** `AGENTOS-V2-PLAN.md` Plan §9, §10, §19, §21 risks 8–9, §22, §23.12 —
*a plan that amends the spec of record, not spec* ([ADR-012](../decisions/ADR-012-part-two-standing-and-spec-coverage.md))
**Answers:** [`project-scoping.md`](project-scoping.md) §5.2 **Q9–Q15** — see §10
**Depends on:** [`frontmatter-schema.md`](frontmatter-schema.md) ·
[ADR-001](../decisions/ADR-001-department-taxonomy.md) ·
[ADR-009](../decisions/ADR-009-artifact-write-capability.md)

> This is a **design proposal, not an implementation**. No feature code exists for any rule
> below. Every "must" here names the thing that enforces it, because tonight proved twice
> that a sentence which names no enforcer enforces nothing.

---

## 0. Where this lives — reconciled with the orchestrator's skeleton

`comms/contracts/project-scoping.md` landed while this was being drafted. **Its routing is
accepted, in full, and it is the reason this file is a draft rather than a contract.** Three
things it settles:

1. **The cascade is mine.** §5.2 assigns Q9–Q15 to `agent-library-curator`. My own claim was
   the same; there is nothing to arbitrate.
2. **Its home is `frontmatter-schema.md`, not a new contract.** §4: *"Resolution semantics are
   defined in `comms/contracts/frontmatter-schema.md`, owned by `agent-library-curator`, and are
   deliberately not restated here… Two documents describing one resolution algorithm will drift,
   and the drift will be invisible until a run picks the wrong agent."* That is correct and I am
   not going to create the third document it warns about.
3. **The ADR is 014**, not the 012 this was drafted as (012 is taken, and accepted).

**So: on acceptance of ADR-014, everything below merges into `frontmatter-schema.md` and this
file is deleted.** It exists separately only while ADR-014 is `proposed`, because amending an
accepted contract on the strength of a proposed decision is the same mistake pointing the other
way. Until then, **cite ADR-014, not this file.**

The division of labour, restated so no one has to reconcile two headers:
`project-scoping.md` owns the **mount** — which roots are read, in what order, for which
project. This owns the **resolution** — what happens once they are read.

---

## 1. The resolution rule

Three layers, ordered least- to most-specific:

```
L0  global library        <global>/agents/{department}/{slug}/SKILL.md        ⌂ global
       ↓ overridden by
L1  project library       <repo>/agents/{department}/{slug}/SKILL.md          ▣ project
       ↓ overridden by
L2  project-local         <repo>/agents/_overrides/{department}/{slug}/SKILL.md
```

**Resolution is by `(department, slug)`, most-specific layer wins, whole file.**

For a given project P, the resolved library is: take the union of `(department, slug)` keys
across L0/L1/L2 as mounted for P; for each key, the winning file is the one from the
highest-numbered layer that defines it; **the winning file is the resolved agent in its
entirety — frontmatter and body — with no field-level merge with lower layers.** The
resolved set is what MAP, CHART and DASHBOARDS project, and it is per-project: the same
`(department, slug)` in two projects is two different agents (§2).

### 1.1 Why whole-file and not field merge

CSS merges declarations; we do not. Three reasons, in order of weight:

1. **Every layer's file is independently validatable and independently readable.** A patch
   has no required fields, so pass 1 (§7.1) could not run on it, and "what actually runs"
   could not be answered by opening one file.
2. **No merge means no archaeology on a security field.** "Which layer set `approval`?" is
   never a question. `wired_into` is answered by the file that won, full stop.
3. Field merge quietly manufactures configurations no human ever wrote, which is precisely
   §21 risk 9 ("the cascade can produce silent surprises") with an extra step.

The cost is real and named: an override that wants to change one sentence duplicates the
whole file and then genuinely diverges. **That cost is why §4's drift machinery exists.**
Copy-not-patch and drift detection are one decision, not two.

### 1.2 A broken file does not fall through

If the winning file fails pass-1 validation, **the whole `(department, slug)` is excluded
from the project's resolved set**, with a warning naming the failing layer and path. It does
**not** fall through to the layer below.

This is the fail-closed direction and it is deliberate. Fall-through would mean a typo in
your override silently runs the global agent — §21 risk 9 exactly — and, worse, silently
restores the global agent's *wider* capability ceiling (§3). A missing node with a named
reason is a bug you find in ten seconds. A node that runs the wrong agent is a bug you find
in a Langfuse trace three weeks later.

**Enforced by:** the resolver (`packages/contracts` per ADR-002), which returns
`{resolved[], excluded[{ref, layer, path, reason}]}`. `excluded[]` is not optional and is
not a log line — §7.4.

### 1.3 `_overrides/` keeps the department segment

L2 lives at `_overrides/{department}/{slug}/`, not `_overrides/{slug}/`. The path/department
agreement of `frontmatter-schema.md` invariant 1 holds in every layer, unchanged, because
`department` is half of the identity (§2) and a layer that can drop it can silently move a
node between MAP branches.

`agents/_overrides/` and `agents/_registry/` are the only reserved names under `agents/`.
Neither is a department, and the validator already rejects a department segment outside
ADR-001's seven.

---

## 2. Identity — what a slug *is*

> **Decision (ADR-014): identity is the mount point, not the file.**

Two distinct things, and conflating them is the whole question:

| Concept | Form | Meaning |
|---|---|---|
| **`agent_ref`** | `{project}/{department}/{slug}` | The **addressable identity.** One node on one project's MAP. The foreign key of every `ops.run_ledger` row, every thread, every schedule, every cost split. |
| **`source_ref`** | `{layer}:{path}@{digest}` | **Which file won, at what content.** Provenance. Recorded on every *run*, never on the agent. |

Consequences, stated as answers rather than implications:

- **A project fork of `sales/database-mining` is a different agent.** `agentos/sales/database-mining`
  and `clientx/sales/database-mining` are two `agent_ref`s and therefore two rows, two run
  histories, two ledgers, two status halos. Run history does **not** follow a fork, in either
  direction.
- **`status` is not inherited, because it is not stored.** See §5. A fork starts at zero runs
  and therefore at `draft`, which is what BOARD rule 9 requires: liveness is earned by the
  `agent_ref` that actually ran.
- **A global agent has no `status` of its own.** L0 files are never executed directly — a run
  always executes *a project's resolved agent*. The global library's map view (if one is ever
  built) shows an aggregate — "live in 3 of 4 projects" — never a single halo. This is the
  honest reading and it prevents the LIVE counter from double-counting one file as N live
  agents.
- **`department` and `slug` are not overridable.** They are the identity tuple. An L1/L2 file
  whose `department` differs from the introducing layer's is a validator **error**, not a move
  (invariant 8). To change either, author a new agent.

### 2.1 The LIVE counter under N projects

The counter is scoped to the current project and says so: `N OF M LIVE`, where M is that
project's resolved set. There is no global LIVE counter, because there is no global run
ledger — runs happen in projects. A cross-project figure, if one is ever wanted, is a sum of
per-project figures and must be labelled as such.

---

## 3. Capability — the field classes, and the one rule that matters

Every frontmatter field falls in exactly one class. The class determines what a lower layer
may do to it.

### Class A — identity. Not overridable.

`name` · `department`

An L1/L2 file must declare the same `name` (hence the same slug, invariant 2) and the same
`department` as the introducing layer. Divergence is an **error**. Want a different name?
That is a different agent.

### Class B — presentation and behaviour. Freely overridable.

`description` · `cluster` · `icon` · `tier` · `phase` · `replaces` · `ladder.*` · `the_human` ·
`breaks_into` · `builds_on` · `inputs[]` · `produces` · `schedule` · the body / system prompt

This is where "the global code-reviewer, Arabic-aware" lives, and it is where nearly every
real override will live. `tier` and `phase` differing per project is not a defect — it is the
point: Sales-in-ClientX being `assisted` while Sales-in-AgentOS is `autonomous` is exactly the
same agent shape at two rollout stages (§10, "shape is shared, roster is not").

### Class C — capability. Overridable **only in the narrowing direction**.

`wired_into` · `approval`

> **Narrowing is an override. Widening is a fork, and a fork takes a new slug.**

Precisely:

- The layer at which a `(department, slug)` **first appears** for a project is its
  **introducing layer**, and its `wired_into` is that agent's **capability ceiling**.
- For every layer below the introducing layer:
  `resolved.wired_into ⊆ introducing.wired_into`, and
  `approval` may go `none → required` but never `required → none`.
- To grant a connector the ceiling does not contain, you must **change the slug.** That makes
  it a new `agent_ref`, with zero run history and its own introducing layer.

**Why this shape.** `wired_into` is the runner's allowlist and never a superset (BOARD rule 4,
§3.2). If a project override could add to it, then *editing a project's library repo would be
a capability grant* — a `git push` that widens what a node reaches while the node keeps the
name, the icon and the copper halo the global agent earned. The rule ties escalation and reset
together: **the act that widens capability is the same act that discards the trust.** You
cannot inherit a halo and a new tool in one commit.

**What enforces it — two independent mechanisms, because CI is not a wall:**

1. **The validator**, on the resolved agent, in the coordinator's watcher (§7.2, invariant 9).
   This is the fast feedback loop and it is not a security boundary.
2. **The runner**, at dispatch: it re-derives the ceiling from the introducing layer's file and
   refuses any resolved `wired_into` that exceeds it. If the runner cannot read the introducing
   layer — global library unfetched, mount unavailable — it **fails closed** with
   `cascade_unresolved` (422). It does not fall back to the local file's list. This is the
   mechanism; the validator is the courtesy.

**Explicitly not a mechanism:** the note in `connectors.json`, the sentence in this contract,
and the reviewer's attention. Tonight's `workspace` confinement bug was a code comment that
claimed a boundary and delivered none, and it took a test asserting on the *filesystem* to
prove it. The equivalent test here is a runner test that mounts a fixture project whose L1 file
declares `[shell]` over an L0 ceiling of `[workspace]`, dispatches, and asserts the process
never receives `Bash` — asserting on the **allowlist the session actually got**, not on the
validator's opinion of the file.

### Class D — egress. Project-scoped, never cascaded.

`deliver`

> **`deliver` may not be declared in the global layer at all.** Validator **error**.

A global agent carrying `deliver: {slack: "#sales-ops"}` and inherited into ClientX posts
ClientX's data into *our* Slack. That is a cross-client leak against `COMPANY.md`'s own PDPL
block, and it requires **no code bug whatsoever** — just the cascade working as designed. The
BOARD already has "any `deliver:` target that leaves the tailnet is a data-egress decision
needing its own ADR" open under `rtl-arabic-pdpl-specialist`; N projects makes it sharper, not
different.

Resolved `deliver` therefore comes only from L1 or L2. Today's repo is unaffected: it becomes
`project: AgentOS` in place (§24), so its five `deliver:` declarations are L1 files and legal.
The rule only bites at **promotion** (§6), which is correct — that is the moment a delivery
target stops being one project's.

### 3.1 Names cascade; secrets never do

A resolved `wired_into: [hubspot]` means **this project's HubSpot credential**. Connector
*names* are library-plane vocabulary and cascade freely. Connector *credentials* are
`ops.credential` rows keyed by `(project_id, connector)` (§9, §11).

**There is no global credential fallback.** A project that declares `hubspot` and holds no
credential for it fails the run with `connector_uncredentialed`; it does not silently reach
another project's HubSpot. *The mechanism is the absence of a fallback path in the lookup* —
which is worth stating as a rule precisely because "fall back to the global one" is the
obvious convenience a future implementer adds without thinking. Assert it with a test that
seeds a credential for project A only and dispatches in project B.

Owner: `runner-engineer` (registry, allowlist) with `identity-access-engineer` (`ops.credential`).
Named here because it is the cascade's sharpest cross-project edge and belongs written down
before either builds.

### 3.2 The field-class table, for reference

| Field | Class | Lower layer may… |
|---|---|---|
| `name` | A | nothing (must match) |
| `department` | A | nothing (must match) |
| `description`, `cluster`, `icon`, `tier`, `phase`, `replaces`, `ladder.*`, `the_human`, `breaks_into`, `builds_on`, `inputs[]`, `produces`, `schedule`, body | B | anything |
| `wired_into` | C | **subtract only** |
| `approval` | C | **tighten only** (`none`→`required`) |
| `deliver` | D | declare, if and only if it is L1/L2 |
| `status` | — | **not authored in any layer** (§5) |
| `forked_from` | new | L1/L2 only (§4) |

---

## 4. Fork, drift, and what the badge means when global moves

### 4.1 The two operations are different, and §10 currently calls both "fork"

- **Override** — same `(department, slug)`, an L1 or L2 file, Class C narrowing only. Badge:
  `▣ project`. This is the `_overrides/**` case §10 illustrates ("the global code-reviewer,
  Arabic-aware") and it is the common case.
- **Fork** — a *copy under a new slug*, which is a new `agent_ref` with its own history and
  its own capability ceiling. Badge: `⑂ forked from ⌂ global/{dept}/{slug}@{sha}`.

§10 describes fork as recording `forked_from` and a parent SHA, which reads as same-identity.
This contract splits it, and **that split is the single least-confident decision in this file**
— see ADR-014 §Consequences for the named failure mode and the metric that would falsify it.

An override may *also* carry `forked_from` when it is a heavy divergence rather than a tweak;
the badge then shows lineage and drift for a same-slug file. Lineage and identity are
orthogonal here: `forked_from` is documentation of where the text came from, never a claim on
history.

### 4.2 What is recorded

```yaml
forked_from:
  ref: global/sales/database-mining      # layer + department + slug
  commit: a1b2c3d                        # parent library's git commit at fork time
  digest: sha256:9f2c…                   # content digest of the parent's normalized frontmatter + body
```

**Both, deliberately.** `commit` is what makes `git show a1b2c3d:agents/…` and a real diff
possible for a human. `digest` is what makes *"has the parent actually changed?"* answerable
**offline, without fetching the parent's history** — which matters because the global library
is a remote a given host may not have cloned, and because a commit SHA advances on every
unrelated commit to that repo, so commit-equality would report permanent false drift. §10 asks
for the SHA; this adds the digest for the machine and keeps the SHA for the human.

### 4.3 The three drift states

Computed by the resolver on every recompute; rendered as the provenance badge (§23.12, P1,
`shell-navigation-engineer`).

| State | Condition | Badge | Severity |
|---|---|---|---|
| `current` | parent resolves and its digest equals `forked_from.digest` | `⑂ forked from global@a1b2c3` | — |
| `drifted` | parent resolves, digest differs | same + **staleness dot** | warning |
| `orphaned` | parent slug no longer resolves in the named layer | `⑂ orphaned from global@a1b2c3` | warning |

### 4.4 When global is deleted, nothing breaks

A fork is a **complete file, not a patch** (§1.1), so a deleted parent cannot break it. The
fork keeps running, keeps its history, keeps its status. The badge becomes `orphaned` and the
validator **warns**. It is never an error, because erroring would mean *deleting a file in the
global library can un-render another project's working agent* — the same promise §9 makes one
level up ("deleting a project row detaches a library, it never deletes one").

### 4.5 Drift is never auto-merged, and the notification has a mechanism

Accepting a parent improvement is a human action producing a commit in the project library,
which re-records `commit` and `digest`. There is no silent update path and no "offer to
upgrade" that writes a file.

**How the project gets told:** `operations/agent-auditor` (§3.4) already walks the repo and
reports stale agents, frontmatter gaps and failing agents into `audit/report.md`. Fork drift
joins that list — same agent, same report, same cadence. That is a mechanism that already
exists and runs on a schedule, rather than a notification system this contract invents. The
auditor's report gains, per drifted fork: the `agent_ref`, the parent ref, both digests, and
the parent's commit range so a human can read the diff.

---

## 5. `status` stops being an authored field

Today's invariant 6 says `status: live` is set by observability and hand-set values get
overwritten by `agent-auditor`. **Under a cascade that convention is not strong enough**,
because copying a file copies the claim: promote an agent, or fork one, and `live` travels
with the bytes into a place that has never run anything. BOARD rule 9 and Part VII.3 both die
quietly at that moment, and no error is raised.

> **Rule: `status` is authored as `draft` in every file, in every layer, always. The resolver
> overwrites it from `ops.run_ledger`, keyed by `agent_ref`. A file declaring `live` or
> `failing` in any layer is a validator error.**

- **Costs nothing to adopt now:** all 12 agents in this repo are `status: draft` today (zero
  runs have executed), so this rule is satisfiable with zero file changes. It becomes expensive
  to adopt the day the first agent goes live, which is the argument for writing it tonight.
- The field stays **required** in the schema — five consumers read it and removing it is a
  breaking change for all of them. What changes is that the only legal authored value is
  `draft`, and the resolved value is computed.
- `failing` likewise comes only from error-rate evidence (§3.4), never from a file.

**Enforced by:** validator invariant 11 (CI, per file, cheap) *and* the resolver, which sets
the field unconditionally from the ledger rather than reading it — so even an unvalidated file
cannot inject a halo. Two mechanisms; the resolver is the one that counts.

---

## 6. Promotion — the cascade running backwards

Promotion is a project agent claiming general applicability. It is a privilege escalation in
the library plane: after it, N projects run this file. It gets preconditions, and they are
mechanically checkable or they are not preconditions.

### 6.1 Two operations, not one

- **`promote-new`** — the slug is free in the global layer. Adds an agent to every project's map.
- **`promote-over`** — the slug already exists globally. This **changes behaviour in every
  project that resolves to it**, which is a different and much larger act. It requires explicit
  acknowledgement from every project that currently overrides or forks that slug — the
  coordinator knows exactly who those are, so this is a query, not a poll.

### 6.2 Preconditions for `promote-new` — all machine-checked

1. **Validates standalone in L0.** Every `builds_on` slug must resolve *within the global
   library alone*. A project agent that builds on a project-only agent cannot be promoted; you
   promote the closure or nothing. (A project agent building on a global one is always legal —
   global is in the project's resolved set. The reverse never is.)
2. **No `deliver`** (§3, Class D). A delivery target is one project's, by rule.
3. **Every `wired_into` connector exists in the global registry**, and — because L0 sets the
   ceiling for everyone — the promoted set must be the *narrowest* set the agent actually needs.
   The reviewer's question is "which of these would you refuse to grant in the client project
   you know least about?"
4. **Real run evidence.** From `ops.run_ledger`, for that `agent_ref`: **≥ 5 successful runs
   across ≥ 2 distinct days, and zero failures in the last 5 runs.** A `draft` agent cannot be
   promoted. This is §10's "proven in one project" turned into a query, and the thresholds are
   deliberately low and deliberately non-zero — the number to argue about later; the *zero is
   not allowed* is the part that matters.
5. **Passes pass 2 as an L0 file** (§7.2) — invariant 7 in particular, since `produces` and the
   write connector must survive the move.

### 6.3 Who approves

**The button opens a pull request against the global library repo. A human merges it.** There
is no auto-merge path and no coordinator-side write to the global library. The mechanism is
branch protection on that repo, not a rule in this document — a coordinator that can push to
the global library is a coordinator that can grant every project a new agent without review.

§10 says "one button, one PR" and this is the strict reading of it.

### 6.4 Promotion does not carry history

The promoted global agent is a new `agent_ref` at L0. It starts at zero runs. If the source
project keeps resolving to its own L1 file, that file keeps its history; if the project deletes
its L1 file and falls through to L0, **the node's history does not follow** — it becomes a
different `agent_ref` on the MAP.

This is uncomfortable and it is the same answer as §2, from the same rule, which is the reason
to trust it: the global copy has not itself run anywhere, and a copper halo on it would be the
LIVE counter telling its first lie. Part VII.3 is the whole credibility of the map.

*Mitigation, not exception:* the ledger records `source_ref` on every run, so "runs of the file
this was promoted from" is answerable as a query and can be shown in the drawer as history
**labelled as inherited**, next to a live counter that stays honest. Showing lineage is fine;
counting it is not.

---

## 7. What the validator must enforce

The failure this section exists to prevent: **a project override producing a resolved agent
that no single file's validation ever saw.** Tonight, twelve of twelve agents declared
capabilities they did not have and the validator passed the whole library. A cascade multiplies
that surface by the number of projects.

### 7.1 Pass 1 — per file, per layer, repo-local

Syntax, unknown fields, enums, required fields, slug/name agreement, path/department agreement,
cron validity, unique `inputs[]` keys, lucide icon existence, `deliver` shape.

Runs with **no coordinator and no other layer present**, which is what makes it the check a
project library's own CI can run. This is today's `scripts/validate-frontmatter.mjs`, gaining a
`--layer global|project|override` flag (default `project`) for the rules that are layer-specific
(§3 Class D, §5).

A pass-1 failure excludes the `(department, slug)` from the resolved set entirely and does not
fall through (§1.2).

### 7.2 Pass 2 — per **resolved** agent, per project, coordinator-side

Every semantic invariant is evaluated **on the merged result**, not on files:

| # | Invariant | Level |
|---|---|---|
| 3 | every `builds_on` slug resolves **within the same project's resolved set** (and, for an L0 file, within L0 alone) | error |
| 5 | every `wired_into` name exists in the **project's effective connector registry** | error |
| 7 | `produces ≠ none` ⇒ at least one connector granting `Write`/`Edit`/`Bash` (ADR-009) — re-checked after narrowing, because **narrowing `wired_into` is exactly how an override removes the write tool and re-creates tonight's bug** | error |
| 8 | Class A fields match the introducing layer | error |
| 9 | Class C monotonicity: `wired_into ⊆ ceiling`; `approval` tightens only | error |
| 10 | `deliver` absent at L0 | error |
| 11 | `status` is `draft` in every file | error |
| 12 | `forked_from` parses; parent resolves (`orphaned`) and digest matches (`drifted`) | warning |
| 13 | within one layer, a slug appears in at most one department | error |

Invariant 7 as a re-check on the resolved agent is the single most valuable line in this table
and the direct lesson of ADR-009: an override that trims `wired_into` "for safety" and drops
`workspace` produces an agent that runs, reports `ok`, and delivers nothing.

Pass 2 runs in the coordinator's repo watcher **before layout recompute**, over the cross
product of (project × resolved agent) — not over files. It reports the count it validated, so
a project whose agents were never pass-2 validated shows as a number rather than as an absence.

### 7.3 Pass 3 — the runner, at dispatch

Not validation; enforcement. Re-derives the Class C ceiling and fails closed
(`cascade_unresolved`, 422) if it cannot read the introducing layer. §3.

Three passes, and only pass 3 is a boundary. Passes 1 and 2 are feedback.

### 7.4 Failures must reach a human who can act

A project maintainer never reads the coordinator's console. Pass-2 exclusions must surface in
the UI — the resolver's `excluded[]` array rendered as a named warning on MAP, with the layer
and path — not only as a `console.warn`. A node that vanished with its reason in a log nobody
tails is the same defect class as a schedule that fails at 03:00 (§21 risk 6).

*Requested from:* `map-galaxy-engineer` and `shell-navigation-engineer`. FYI filed.

---

## 8. Open — routed, not answered

### 8.1 One brain or N? → `rtl-arabic-pdpl-specialist`

§3.3 injects `COMPANY.md` into every invocation and it is global today. With N projects this
is a PDPL question before it is an engineering one, `COMPANY.md`'s own block says client data
does not cross clients, and §22 gives that agent a **mandatory** sign-off on cross-project
isolation. **This contract does not answer it.** Routed:
`comms/inbox/rtl-arabic-pdpl-specialist/20260816-2340-agent-library-curator-company-md-cross-project.md`.

Until they rule, this contract assumes nothing about brain scoping and no rule above depends
on the answer.

### 8.2 The engineering department — and two documents that already disagree

Plan §10 adds an eighth department, `engineering`, per project, holding `.claude/agents/**`.
**`project-scoping.md` invariant 6 says seven** ("every project gets the same seven departments
(ADR-001)"). Both cite Plan §10. That is a live contradiction between an accepted invariant and
the plan it is drawn from, and it is better found now than during implementation.

Either way it is an ADR-001 amendment (seven canonical branches, §2.1; a tab bar built for
seven, §2.6.1) touching the MAP's radial force groups, the CHART tab bar, `clusters.json` and
a department enum with five consumers. Mine to file. **Not filed** — it needs
`map-galaxy-engineer` and `chart-matrix-engineer` to price the layout and tab-bar cost, and
M15's scope to decide whether it is in P1 at all. Raised with `commandcenter-orchestrator`.

### 8.3 ADR numbering in the plan

`AGENTOS-V2-PLAN.md` §3 and §18 reuse **ADR-009**, **ADR-010** and **ADR-011**, all three
already accepted in `comms/decisions/` for unrelated decisions, and reserve **ADR-016** for a
project-scoping ADR the real sequence has now split across **013** (`ops.project`, `runner-engineer`),
**014** (this cascade) and **015** (identity). One reconciling edit to the plan, before anyone
cites a plan number in a commit message. Raised with `commandcenter-orchestrator`; not fixable
from here.

### 8.4 Are `panels/*.json` cascaded too? — `runner-engineer` (`project-scoping.md` Q8)

Not answered here, and **nothing above should be read as answering it.** Every rule in this
document is written about `agents/**` specifically; the field classes, the monotonicity rule and
the `status` derivation all depend on properties panels do not have. If panels do cascade, they
need their own resolution rules from `dashboards-engineer` and ADR-004's six Command Centers.

---

## 9. Changes this proposes to `frontmatter-schema.md`

None yet — ADR-014 is `proposed`. On acceptance, that contract gains: `forked_from` as an
optional field (L1/L2 only), the field-class table (§3.2), invariants 8–13, and an amendment to
invariant 6 replacing "hand-set values get overwritten" with §5's hard rule — and this file is
deleted (§0). All of it is additive to today's twelve agents: **zero existing files change.**

---

## 10. `project-scoping.md` §5.2 — Q9 to Q15, answered

The orchestrator's skeleton asks seven questions and names what each costs to specify loosely.
This is the map from those questions to the rules above, so a reader of that contract does not
have to reconstruct it.

| Q | Question | Answer | Where |
|---|---|---|---|
| **Q9** | Unit of resolution — slug, or department + slug? | **`(department, slug)`.** `department` is half the identity and is **not overridable** in any layer; an L1/L2 file whose department differs from the introducing layer's is an error, not a move. Their loose-cost — "a node that moves between projects for reasons nobody can name" — becomes structurally impossible rather than discouraged. | §1, §2, invariant 8 |
| **Q10** | Replace, or merge field by field? **What happens to `wired_into`?** | **Whole-file replace, no merge at all** — three reasons in §1.1, of which the security one is that no merge means no archaeology on a security field. Their recommendation was replace-not-union for `wired_into`; this goes further: `wired_into` may only be **narrowed**, never replaced with a wider set, and widening requires a new slug. Enforced twice — validator on the resolved agent, and the **runner at dispatch**, which fails closed. | §1.1, §3 Class C, §7.3 |
| **Q11** | Override keyed by path or by an `overrides:` field? | **Path** — `_overrides/{department}/{slug}/SKILL.md`, keeping the department segment. Their counter for field-keying was "it survives a rename": under §2 a rename changes the slug, which changes the `agent_ref`, which means it *is* a different agent. Surviving a rename is not a property we want; it is the thing §2 is built to prevent. Path-keyed is also greppable, which is what makes a wrong resolution findable at all. | §1.3 |
| **Q12** | Override that fails validation — fall back, or exclude? | **Exclude the whole `(department, slug)` with a named reason. Never fall through.** Agrees with their recommendation and adds the reason they did not have: fall-through does not merely run the wrong agent, it silently **restores the wider capability ceiling** of the layer below. | §1.2, §7.4 |
| **Q13** | Where does the parent SHA live, who computes staleness? | **Frontmatter stores only fork-*time* values** — `forked_from: {ref, commit, digest}` — which are immutable and never change on an upstream commit. **Staleness is computed by the resolver** against the parent's current content digest and is never written to a file. This is a direct answer to their loose-cost ("put the current SHA in frontmatter and every upstream commit becomes a commit in every downstream project"): nothing downstream changes when the parent moves; only the badge does. The digest exists alongside the commit SHA because the global library is a remote a host may not have cloned, and because commit-equality would report false drift on every unrelated commit. | §4.2, §4.3 |
| **Q14** | What does promote do to the project copy? | **Nothing. It is left in place** and keeps winning that project's cascade. Deleting it is a separate, explicit act, and the UI must warn that falling through to L0 lands on a *different* `agent_ref` with zero runs (§2, §6.4). Auto-deleting would silently change which file runs in the project that did the work, at the exact moment it was being rewarded. | §6.4, ADR-014 decision 8 |
| **Q15** | Precomputed and deterministic, like ADR-003? | **Yes — one pure resolver, N callers**, the same shape as ADR-003/ADR-006. `{resolved[], excluded[]}` is the single artifact MAP, CHART, DASHBOARDS, the drawer and the runner all read. Independent resolution would eventually disagree intermittently, which is the worst failure mode available and the reason ADR-003 exists for layout. | §1.2, ADR-014 decision 9 |

**One question of theirs I have made harder, deliberately:** Q8 (are `panels/*.json` cascaded?)
is `runner-engineer`'s, and §8.4 says nothing here answers it. **And one their §6 raises that I
can confirm:** *"the cascade picks the right agent"* cannot be validated without
`RUNNER_ANTHROPIC_API_KEY`. That is correct, and it is why §3's enforcement is specified as a
runner test asserting on **the allowlist the session actually received** rather than on the
validator's opinion of the file — a structural proof, available before the key lands, of the
one property whose failure has no error message.
