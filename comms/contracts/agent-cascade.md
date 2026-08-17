# CONTRACT — The agent cascade

**Owner:** `agent-library-curator` · **Status:** **accepted**
([ADR-014](../decisions/ADR-014-agent-cascade-resolution.md), accepted 2026-08-17) ·
**Milestone:** M15 (P1)
**Source:** `AGENTOS-V2-PLAN.md` Plan §9, §10, §19, §21 risks 8–9, §22, §23.12 —
*a plan that amends the spec of record, not spec* ([ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md))
**Answers:** [`project-scoping.md`](project-scoping.md) §5.2 **Q9–Q15** — see §10
**Depends on:** [`frontmatter-schema.md`](frontmatter-schema.md) ·
[ADR-001](../decisions/ADR-001-department-taxonomy.md) ·
[ADR-009](../decisions/ADR-009-artifact-write-capability.md)

> **Accepted ≠ enforced. Read [§11](#11-mechanism-state--what-is-built-and-what-is-a-sentence)
> before you cite any rule below as a guarantee.** Every "must" here names the thing that
> enforces it, and §11 says whether that thing exists yet. Three rules are enforced in
> `apps/runner/src/lib/cascade.ts` at dispatch and are proved by a test that asserts on the
> allowlist a session actually received. Most of the rest are specified and unbuilt, with an
> owner each. The one thing this contract may never become is a document claiming a boundary
> it does not have — that mistake has been made twice in this repo and cost a session each
> time.

---

## 0. Where this lives — settled

**This file is a contract and it stays.** The earlier text here said the opposite: that on
acceptance everything below would merge into `frontmatter-schema.md` and this file would be
deleted. It is corrected in place, with the correction visible, because a reader who saw the
old sentence needs to know it was reversed rather than to wonder which version they remember.

What happened is worth one line, since it is the same failure the rest of this contract is
built to prevent: I reconciled to a line in `project-scoping.md` §4 that its author had
already deleted, and the author had meanwhile moved to my position. **Two agents reading each
other's stale drafts each adopted the other's abandoned view.** Ruled on the merits by
`commandcenter-orchestrator` (answered 2026-08-16T22:48) and recorded in
[ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md), which accepts this
file's boundary verbatim.

**The split, which is the ruling:**

| Subject | Contract | Why there |
|---|---|---|
| What one file's fields mean; `forked_from`; `status` authorable only as `draft` | [`frontmatter-schema.md`](frontmatter-schema.md) | per-file schema |
| Which of three files wins; the four field classes; promote/fork/provenance; the three validator passes | **this file** | cross-layer semantics |
| Which roots are mounted, in what order, for which project | [`project-scoping.md`](project-scoping.md) | the mount, not the resolution |

Two contracts about two subjects is not the third-document warning §4 was making — that
warning was about **one algorithm described twice**, and there is exactly one description of
the resolution algorithm in this repo: §1 below.

Three things `project-scoping.md` settles and this file does not re-litigate:

1. **The cascade is mine.** §5.2 assigned Q9–Q15 to `agent-library-curator`; the questions
   have since been deleted from that file rather than marked answered, and §5.2 is a pointer
   here. A question living in two contracts is one contract with two readings, and the second
   reading is the one that gets built.
2. **The mount is theirs.** Which roots are read, in what order, for which project.
3. **The ADR is 014.** Drafted as 012, which was raced and is now deliberately vacant.

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
   refuses any resolved `wired_into` that exceeds it with **`capability_widened` (403)**. This
   is the mechanism; the validator is the courtesy. **Built** —
   `apps/runner/src/lib/cascade.ts`, `resolveForDispatch`, which is the only way the run
   pipeline may obtain a runnable agent: the `AgentRecord` does not exist until
   `assertNarrowsDownward` has returned, so a future caller cannot resolve without asserting.

**Two kinds of missing, and collapsing them breaks something either way.** This distinction is
not in the proposed text; it was found while building and it belongs in the contract:

| The introducing layer is… | Answer | Why not the other one |
|---|---|---|
| configured but **unreadable** — permissions, a half-fetched mount | **`cascade_unresolved` (422). Nothing runs.** | Reading "cannot open" as "does not define this agent" silently promotes the local file to introducing layer and hands it *its own* ceiling. That is the widening this rule exists to stop, arrived at through an I/O error. |
| **not configured at all** — no global library on this host | **Not an error.** The project layer is then the introducing layer and sets the ceiling. | There is no global library repo yet (BOARD, M15 scope), so erroring here breaks every machine; and trusting a local list *because* the global one is absent is the same bug as the row above. Same disease as `unknown` vs `zero`, one plane up. |

**Explicitly not a mechanism:** the note in `connectors.json`, the sentence in this contract,
and the reviewer's attention. Tonight's `workspace` confinement bug was a code comment that
claimed a boundary and delivered none, and it took a test asserting on the *filesystem* to
prove it. The equivalent test here is a runner test that mounts a fixture project whose L1 file
declares `[shell]` over an L0 ceiling of `[workspace]`, dispatches, and asserts the process
never receives `Bash` — asserting on the **allowlist the session actually got**, not on the
validator's opinion of the file.

**That test exists**, and `commandcenter-orchestrator` made it a condition of M15's PASS
rather than a suggestion: `apps/runner/src/lib/__tests__/cascade-ceiling.test.ts`, six cases,
driving the real dispatch path with a session factory that records `options.allowedTools`.
It is the one structural proof of a no-error-message property that was obtainable **before**
`RUNNER_ANTHROPIC_API_KEY` lands. What it proves is narrow and worth stating exactly: *whatever
the cascade picks, its tool list cannot exceed the introducing layer's.* It does not prove the
cascade picks the agent a human meant — that has no error message and needs a real run.

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

### 3.2 Who may *write* into a layer — the classes are about resolution, not the write path

Added 2026-08-17, on a question from `runner-engineer` that the field classes did not answer
and should have. `POST /api/schedule` writes `schedule:` into a `SKILL.md` and commits it, and
it writes to **the project layer** — which is today always the winner, because this repo has no
global library and no `_overrides/`. The day an override wins, the runner would write a cron
into **a file that does not run**, and the clock badge — which reads frontmatter — would render
it. One identifier, two readings, in the scheduling plane.

`schedule` is Class B, and Class B says a lower layer may freely *declare* a different value.
It says nothing about who may author one on a human's behalf. **These are different questions
and only the first was answered.**

> **Rule: a write into the library plane must name the layer it is writing to, and refuse when
> that layer is not the winner — naming the winning file in the refusal.** It never writes to
> a layer it did not resolve, and it never writes to L0 at all.

This is the general form; `schedule` is the first instance and the brain write-back (ADR-007)
is the second. Three reasons, and the third is the one that decided it:

1. **Writing to a non-winning layer manufactures a value that never runs.** Under whole-file
   replacement (§1.1) there is no merge to carry it upward. The file would hold a cron, the
   resolved agent would not have one, and both readings would be defensible.
2. **Writing to the winner is not always available.** If the winner is L0 the coordinator
   would be committing to the global library, and §6.3 forbids that outright — a coordinator
   that can push to L0 can grant every project a new agent without review. Promotion is a pull
   request a human merges, and a schedule endpoint must not become a second door into it.
3. **Writing to a winning L2 is *legal* and still refused today, for a reason that is mine to
   fix rather than theirs.** `agents/_overrides/**` is invisible to every enumerator in this
   repo — MAP, CHART and the validator all skip `_`-prefixed folders (§11). A cron written
   there would be a schedule no view can show and no CI run can check. **Refusing costs a
   manual edit; permitting costs a scheduled run nobody can see.**

**So, concretely, until the resolver lands:** write when the project layer is the winner;
refuse otherwise with the winning file named. This is `runner-engineer`'s option 2, adopted —
with the third reason above, which strengthens it from *"the safest of three"* to *"the only
one with no invisible outcome"*. When the resolver lands and `_overrides/**` is validated and
rendered, the rule relaxes to *write to the winner, refuse at L0*, and that relaxation is a
one-line change in the same place.

**Direction of travel, so nobody builds the permanent version of the interim answer:**
`schedule` in frontmatter cannot survive N projects. One L0 file cannot carry four projects'
crons, and the moment a global agent is scheduled differently per project the value belongs in
the operations plane, not in git. That is `ops.schedule` (`Plan §14`, M18, `scheduler-engineer`),
and when it lands the frontmatter field becomes a default that seeds a row — not a thing an API
writes back into a library. **Do not build a richer write path into `agents/**` in the
meantime.**

### 3.3 The field-class table, for reference

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

## 8. Routed — three answered, one open

Everything in this section was routed to an owner rather than decided here. Three have come
back. The fourth is out of M15 by BOARD ruling and is an ADR-001 question, not a cascade one.

### 8.1 One brain or N? — **ruled, `rtl-arabic-pdpl-specialist`, 2026-08-17**

§3.3 injects `COMPANY.md` into every invocation and it is global today. With N projects that
is a PDPL question before it is an engineering one, and `Plan §22` gives that agent a
**mandatory** sign-off on cross-project isolation, so it was routed rather than answered here
(`comms/inbox/rtl-arabic-pdpl-specialist/20260816-2340-agent-library-curator-company-md-cross-project.md`).

**The ruling: two tiers, and the split is drawn by a test rather than by taste.**

> Global holds what is true about the operator regardless of who the client is. Project holds
> everything else. **If a fact would be wrong or embarrassing in another client's prompt, it is
> project-tier — and if you have to think about it, it is project-tier.**

Against `COMPANY.md`'s twenty questions: **§5 Voice** and **§7 Data handling** are global;
§1 Identity, §2 Offers, §3 ICP, §4 Pricing, §6 Red lines, §8 Operations and §9 Sources are
project. §1 is the one that looks global and is not — *who we are as presented to a client* is
positioning, and positioning is per-client. The ruling is written into `company/COMPANY.md` §7
as rule 9, which is the only place that binds everything: §3.3 injects that file into every
run, so a rule inside it is inherited without anyone importing anything.

One global brain was rejected as a **breach, not a risk** — string concatenation puts client
A's pricing and red lines into every prompt of every run for client B. N copies were rejected
too, and that reason is the less obvious one: *a safety rule copied N times is a safety rule
with N versions, and the weakest one is the one that governs.*

**What this contract owes it — the sibling of Class D, requested by them and worded here:**

> **A `company/COMPANY.md` in the global layer may contain only the sections on the global
> allowlist — `Voice`, `Data handling`. Any other `## ` heading at the global layer is a
> validator error.**

Section-level, not content-level, deliberately and for the same reason Class D scopes a
*field* rather than a target list: *"does this sentence name a client"* is undecidable and a
checker attempting it is wrong in both directions, while *"is this file carrying a §4 Pricing
block it is not allowed to have"* is a heading match that fails in the safe direction.

**Mechanism state: not built.** It needs pass 1's `--layer` flag (§7.1), which does not exist
— §11. Two things carry the rule meanwhile, and neither is this document: the global tier has
**no write path** (ADR-007 gates brain write-back on the interview agent, which is
client-facing and must write only the project tier), and rule 9 lives inside the file that is
injected into every run.

*Not adopted, and named so nobody adds it thinking it was implied:* a redaction pass at
injection. Redaction finds names, emails, IBANs and national IDs; it does not find *"we price
the retainer at 18k for this account"*, which is client-identifying with no PII token in it. It
would supply the feeling of a boundary without the boundary.

### 8.2 The engineering department — **still open, out of M15, and not a cascade question**

Plan §10 adds an eighth department, `engineering`, per project, holding `.claude/agents/**`,
one sentence after saying *"the same seven departments"*.

**The contradiction this section was filed to report is fixed.** `project-scoping.md`
invariant 6 quoted only the first half; `commandcenter-orchestrator` corrected the invariant
in place, visibly, and ruled the eighth department **out of M15**. What remains is an
**ADR-001 amendment** — seven canonical branches (§2.1), a tab bar built for seven (§2.6.1),
the MAP's radial force groups, `clusters.json`, and a department enum with five consumers,
plus a frontmatter adapter, since Claude Code frontmatter and Command Center frontmatter are
not the same schema (`Plan §3`).

**It does not block anything in this contract, and the reason is structural rather than
convenient: no rule here counts departments.** Resolution is by `(department, slug)` over
whatever set `department` ranges over; adding an eighth member changes no decision in ADR-014.
It blocks ADR-001, which is a different decision with different consumers.

Mine to file. **Blocked on a price, and the request is now dated rather than sitting with me:**
`map-galaxy-engineer` (radial force groups, §2.1–2.2) and `chart-matrix-engineer` (the §2.6.1
tab bar) were asked on 2026-08-17 what an eighth branch costs their surfaces
(`comms/inbox/map-galaxy-engineer/20260817-…-agent-library-curator-eighth-department-price.md`,
same to `chart-matrix-engineer`). The ADR-001 amendment is written when both answer.

**The cheap half is already bought:** M15 bakes no `7` into anything project-shaped — no
`CHECK (department IN (…))`, no literal `7` in `0005_project_axis.sql`, and a test in
`project-id.test.ts` that strips SQL comments before asserting it, because a test matching its
own documentation is the purest form of the mistake this repo keeps auditing for.

### 8.3 ADR numbering in the plan — **resolved**

`AGENTOS-V2-PLAN.md` §3 and §18 reuse **ADR-009**, **ADR-010** and **ADR-011**, all already
accepted here for unrelated decisions, and §18 reserves "ADR-016" for content the real sequence
split across 014 and 015. Ruled in ADR-013's 2026-08-17 amendment: **filed ADRs keep their
numbers; the plan's are re-allocated**, on the principle *allocate against the side with no
dependents*. The concordance is [`decisions/README.md`](../decisions/README.md) and the register
is BOARD. **Translate a plan number through that file before citing it** — a citation followed
literally lands on an unrelated decision. The plan itself is deliberately not edited; it is the
user's file.

### 8.4 Are `panels/*.json` cascaded too? — **answered by `runner-engineer`, ADR-015 Q8**

**No, not in M15.** Panels are mounted per project; they are not resolved through layers.
The reasoning is the one this section asked for: every rule in this document is written about
`agents/**` specifically, and the field classes, the monotonicity rule and the `status`
derivation all depend on properties panels do not have — a capability ceiling, an `agent_ref`,
a status earned by runs. Symmetry is not a reason. If panels ever do cascade they need their
own resolution rules from `dashboards-engineer` against ADR-004's six Command Centers, and
§2.5.6's warning applies first: a seventh centre or a rename is a rail-order change in six
files, and that multiplies by N projects.

---

## 9. What landed in `frontmatter-schema.md`

ADR-014 is accepted, and its **per-file** half landed there on 2026-08-17 (§0's split — that
contract describes one file, this one describes which of three files wins):

- **`forked_from: {ref, commit, digest}`** — optional, legal only at L1/L2.
- **Invariant 6 amended** — "hand-set values get overwritten by `agent-auditor`" becomes §5's
  hard rule: `draft` is the only authorable `status`, anything else is a validator **error**,
  and the resolved value comes from the ledger without the file being read.
- The canonical example's `status:` changed from `live` to `draft`, because the example is the
  thing people copy.

The field-class table (§3.3) and invariants 8–13 stay **here**, because they are statements
about layers rather than about a file. **Zero `agents/**` files changed:** all twelve are
already `draft` and none declares `forked_from`.

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

---

## 11. Mechanism state — what is built, and what is a sentence

> This section is the reason acceptance is safe. Every row is a rule from this contract; the
> **Mechanism** column is what would actually stop a violation today. A row marked *not built*
> is a specification, and citing it as a guarantee is the exact error — a comment claiming a
> boundary — that ADR-009's twelve-of-twelve finding and the `workspace` confinement bug both
> were. Provenance: repo state at 2026-08-17, tree clean.

| § | Rule | Mechanism today | State |
|---|---|---|---|
| §1, §1.1 | Resolve by `(department, slug)`, most-specific wins, **whole file, no merge** | `resolveThroughCascade` walks the three roots and returns one winner; nothing merges fields anywhere | **built** (dispatch only) |
| §1.2 | A file that fails **pass-1 validation** is excluded and does not fall through | At dispatch: `frontmatterOf` throws `cascade_unresolved` on unparseable frontmatter, and `recordFromSource` throws `invalid_frontmatter` on a department/path mismatch. Unknown `wired_into` names refuse separately with `unknown_connector` (422). **But that is three checks, not pass 1.** A winning file with a bad `tier`, a bad `phase` or a missing `replaces` still dispatches: the runner refuses what would make the run wrong, and the contract says the *node* is excluded. The two agree only because nothing else has an opinion yet | **partial** |
| §2 | `agent_ref = {project}/{department}/{slug}`; `source_ref` recorded per run | `makeAgentRef`, `sourceRef`; `CHECK agent_ref_ends_with_agent`; `source_ref NOT NULL`; both on the SSE `start` frame before any token | **built** |
| §3 Class C | Capability narrows downward; widening is `capability_widened` (403) | `assertNarrowsDownward`, reachable only through `resolveForDispatch`; asserted in `cascade-ceiling.test.ts` on `options.allowedTools` — the allowlist the session actually received | **built — the one real boundary** |
| §3 two-kinds-of-missing | unreadable ⇒ 422; unconfigured ⇒ the project layer is the ceiling | both cases in `readLayer`, both tested | **built** |
| §3.1 | Names cascade, credentials never; no global fallback | the *absence* of a fallback: `ops.credential` is keyed `(project_id, connector)` with no nullable column to fall through to. **The test that seeds project A and dispatches in project B is not written** — it needs Postgres, not an API key | **partial** — `runner-engineer` |
| §5 | `status` authorable only as `draft` | `validate-frontmatter.mjs` — **error** as of this commit. Feedback, not a boundary | **built (pass 1)** |
| §5 | The resolver overwrites `status` from `ops.run_ledger` | **nothing.** No ledger-derived status exists; every view projects the file's value, which is `draft` for all twelve. Honest today (zero runs), and it is the half that makes the copper halo *possible* | **not built** — mine + `observability-engineer` |
| §3 Class D | `deliver` illegal at L0 | **nothing.** Needs pass 1's `--layer` flag | **not built** — mine |
| §8.1 | Global `COMPANY.md` limited to the section allowlist | **nothing.** Same `--layer` flag. Carried meanwhile by ADR-007's write gate and by rule 9 living inside the injected file | **not built** — mine |
| §7.2 | Invariants 8, 9, 10, 12, 13 on the **resolved** agent | **nothing.** Pass 2 needs a resolver that sees three layers outside the runner | **not built** — mine |
| §7.4, decision 9 | One resolver, `{resolved[], excluded[]}`, read by MAP · CHART · DASHBOARDS · drawer · runner | **nothing.** `resolveForDispatch` has exactly one caller, `runService.ts`. The views enumerate `agents/{department}/**` directly and **skip `_`-prefixed folders**, so they cannot see `agents/_overrides/**` at all | **not built** — mine, with `map-galaxy-engineer` + `shell-navigation-engineer` |
| §4.3 | Fork drift states, rendered as the badge | `ProvenanceBadge` exists (`design-system-guardian`) and the drawer has the header slot; nothing computes a digest comparison | **not built** |
| §6 | Promotion, its five preconditions, the PR | **nothing.** There is no global library repo to promote into | **not built** |

**The two gaps that would bite first, stated plainly rather than left to be inferred:**

1. **An `_overrides/` file today would run and be invisible.** The dispatch cascade honours
   L2; the views skip it; **pass 1 never validates it**, since the validator also skips
   `_`-prefixed folders. So an override could win a run while MAP, CHART and the drawer render
   the L1 file's `wired_into` — a drawer displaying a tool list that is not what ran. It is
   latent, not live: `agents/_overrides/` does not exist and no project has a second layer.
   Anyone creating the first override file before the resolver lands is creating that bug.
2. **The cascade has two real levels, not three.** There is no global library repo (BOARD, M15
   scope), so for every agent in this repo the project layer *is* the introducing layer and
   §3's ceiling check passes trivially. It is proved on fixtures, not on production layers.

---

