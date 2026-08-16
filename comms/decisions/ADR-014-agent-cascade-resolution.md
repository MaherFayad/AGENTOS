# ADR-014 — Agent cascade resolution: identity is the mount point, capability narrows downward

**Date:** 2026-08-16 · **Author:** `agent-library-curator` · **Status:** proposed
**Affects:** `contracts/frontmatter-schema.md` (destination) · `contracts/agent-cascade.md`
(working draft, merges and is deleted on acceptance) · `contracts/project-scoping.md` §5.2
Q9–Q15 · `contracts/api-contracts.md` (new `cascade_unresolved` / `connector_uncredentialed`) ·
M15 (P1) · `scripts/validate-frontmatter.mjs` · every view that projects frontmatter

> **Numbering.** Filed as **014** because `comms/contracts/project-scoping.md` §5.2 assigns the
> cascade ADR that number, and that contract's routing wins over my own choice. (Drafted as 012;
> renumbered on discovering the orchestrator's skeleton, which also took 012 for a different
> decision.) 013 is `runner-engineer`'s `ops.project` decision; 015 is identity.
>
> Separately: `AGENTOS-V2-PLAN.md` §3 and §18 reuse **009**, **010** and **011**, all three of
> which are already accepted here for unrelated decisions, and reserve **ADR-016** for a
> "project scoping" ADR that the real sequence has now split across 013/014/015. The plan's
> numbers need one reconciling edit before anyone cites one in a commit message. Raised with
> `commandcenter-orchestrator`; not fixable from here.

## Context

`AGENTOS-V2-PLAN.md` §9 reframes AgentOS as a coordinator that mounts N project libraries;
§10 specifies a three-layer cascade (global → project library → project-local override)
resolved by slug, most-specific wins, with promote, fork and provenance badges. §20 makes M15
first and non-negotiable because it re-scopes every table and every route.

The plan does not say what a resolved agent *is*. That gap is load-bearing in four places:

- **BOARD rule 9 / Part VII.3** — `status: live` comes from actual runs. If a fork or a
  promotion carries `status` in its bytes, a file that has never run acquires a copper halo and
  the LIVE counter starts lying. No error is raised at any point.
- **BOARD rule 4 / §3.2** — the runner's allowlist is exactly `wired_into`. If a project layer
  may add to `wired_into`, then editing a project's library repo is a capability grant.
- **§21 risk 9** — "running the code-reviewer and getting the global one when you meant the
  fork is a class of bug with no error message."
- **ADR-009** — twelve of twelve agents declared capabilities they did not have and the
  validator passed the library. Per-file validation cannot see a resolved agent.

Two failures from the same night set the standard for this ADR. `workspace` confinement was a
code comment claiming a boundary; a test that asserted on the *filesystem* proved a run could
overwrite the repo-root `.env`. And the twelve-of-twelve case was a validator that checked
every file and never checked the thing that runs. **A "must not" that names no enforcer is the
bug, not the fix.**

## Options

### Identity of a resolved agent

| Option | For | Against |
|---|---|---|
| **A. Identity = the file.** A fork is the same agent at a different version; history follows the text. | Matches §10's `⑂ forked from global@sha` reading. One "code-reviewer" everywhere. | A fork inherits `status: live` it never earned — BOARD rule 9 dies silently. Ledger rows from ClientX's fork mix into the global agent's error rate. Cross-project history in one row is a PDPL surface. |
| **B. Identity = the mount point** `{project}/{department}/{slug}`. Provenance recorded per *run*. | Liveness is per-thing-that-ran, so rule 9 holds by construction. Ledger stays project-scoped, which §10 requires of every ops table anyway. One rule answers fork, promote and status. | Promotion loses history; a project deleting its override "loses" its node's runs. Deviates from §10's phrasing. |

### Capability under override

| Option | For | Against |
|---|---|---|
| **A. Free override.** Any layer sets `wired_into`. | Simple. Matches CSS intuition. | A `git push` to a project library grants tools while the node keeps the global agent's name, icon and halo. Directly contradicts BOARD rule 4. |
| **B. Frozen.** `wired_into` set only by the introducing layer. | Maximum safety. | A project cannot even *remove* a tool it does not want, which perversely discourages narrowing. |
| **C. Monotonic narrowing.** Subtract yes, add no; widening requires a new slug. | Escalation and trust-reset are the same event. Narrowing — the safe direction — stays cheap. | The common case "global researcher + our CRM" needs a new slug, which may push people to widen the global agent instead. Real risk; see Consequences. |

### Merge semantics

| Option | For | Against |
|---|---|---|
| **A. Field merge**, CSS-style. | An override is three lines. No duplication, no drift. | A patch has no required fields, so it cannot be validated standalone. "Which layer set `approval`?" becomes archaeology on a security field. Manufactures configurations nobody wrote. |
| **B. Whole-file replacement.** | Every layer's file is independently valid and independently readable. What runs is one file. | Overrides duplicate; real divergence follows. Requires drift detection to stay honest. |

## Decision

**We resolve by `(department, slug)`, most-specific layer wins, whole file — and:**

1. **Identity is the mount point** (option B). `agent_ref = {project}/{department}/{slug}` is the
   addressable agent and the foreign key of every operations row. `source_ref = {layer}:{path}@{digest}`
   is recorded on every *run*, never on the agent. A fork is a different agent; run history,
   ledger rows and liveness never follow one.
2. **`status` is not an authored field.** Every file in every layer declares `draft`; the
   resolver overwrites it from `ops.run_ledger` keyed by `agent_ref`. Any other authored value
   is a validator error. All 12 agents in this repo are already `draft`, so adopting this costs
   nothing today and would cost a great deal the day after the first agent goes live.
3. **Capability narrows downward** (option C). A lower layer may subtract from `wired_into` and
   may tighten `approval`; it may never add or loosen. Widening requires a new slug, hence a new
   `agent_ref` with zero history. Enforced by the validator on the resolved agent **and,
   independently, by the runner at dispatch**, which fails closed with `cascade_unresolved` if
   it cannot read the introducing layer.
4. **`deliver` never cascades.** It may not be declared at L0 at all. A global agent carrying a
   Slack channel and inherited into a client project leaks that client's data into our workspace
   with no code bug required.
5. **Whole-file replacement** (option B), with fork lineage recording *both* the parent's commit
   SHA (for a human diff) and a content digest of the parent's normalized frontmatter+body (so
   "has the parent actually changed?" is answerable offline and does not report false drift on
   every unrelated commit to the global repo).
6. **A file that fails validation does not fall through.** The `(department, slug)` is excluded
   with a named reason. Fall-through would silently run the global agent *and* silently restore
   its wider capability ceiling.
7. **Promotion is a pull request against the global library that a human merges**, gated on
   preconditions that are queries, not opinions: `builds_on` closes within L0, no `deliver`,
   connectors exist globally, ≥ 5 successful runs across ≥ 2 days with zero failures in the last
   5. It does not carry history.
8. **Promotion never touches the source project's files** (`project-scoping.md` Q14). The
   project copy stays and keeps winning that project's cascade. Deleting it is a separate,
   explicit act by the project, and the UI must warn that falling through to L0 lands on a
   *different* `agent_ref` with zero runs. Auto-deleting would silently change which file runs
   in the project that did the work, at the moment it was being rewarded.
9. **Resolution is precomputed, deterministic and single-sourced** (Q15), the same shape as
   ADR-003/ADR-006: one pure resolver, N callers, `{resolved[], excluded[]}` as the one artifact
   MAP, CHART, DASHBOARDS, the drawer and the runner all read. MAP and CHART resolving
   independently would eventually disagree, and the disagreement would be intermittent — the
   worst failure mode available, and the exact reason ADR-003 exists for layout.

## Consequences

**Easy.** Liveness cannot be forged by copying a file, in any direction, without an error being
raised. The MAP's copper halo means one thing in every project. A project can always make an
agent *safer* without asking anyone. Reading one file tells you what runs. Deleting a global
agent cannot break a downstream fork.

**Hard.** Promotion loses run history, which will feel wrong the first time someone promotes a
well-worn agent — mitigated by showing inherited runs in the drawer, labelled, next to a counter
that stays honest. Overrides duplicate whole files and genuinely diverge; the drift dot is the
price of copy-not-patch and the two decisions stand or fall together. Every ops table and route
gains a `project_id` — §21 risk 1, already accepted, and the reason M15 is first.

**The decision I am least confident in is 3, and specifically the split of §10's single "fork"
into *override* (same slug, narrowing) and *fork* (new slug, may widen).** §10's badge text
reads as though a fork keeps its identity. The named failure mode of my rule: the common case —
"the global researcher, plus our CRM" — is exactly the case that needs a new slug, and if that
feels bureaucratic enough, people will instead add `hubspot` to the *global* researcher so every
project inherits it. That makes the global ceiling the union of everyone's needs, which is the
widest possible blast radius and strictly worse than option A.

**The tripwire that would falsify it:** `operations/agent-auditor` reports, per audit, the mean
and max length of `wired_into` across the global library, and the count of connectors declared
globally but used by fewer than two projects. If either climbs while project-layer overrides
stay near-empty, this rule is pushing capability upward and should be revisited with a targeted
escape hatch — a per-project, per-connector grant file that is reviewed as a grant rather than
edited as a field. I have not designed that escape hatch, deliberately, because designing it now
would remove the pressure that makes the tripwire meaningful.

**If we reverse this later:** reversing 1 or 2 requires a ledger migration and re-derivation of
every halo. Reversing 3 is cheap in the safe direction (relaxing a check) and expensive in the
other. Reversing 5 (whole-file → merge) invalidates every stored digest and every override file.

## Contract edits

**Home:** `comms/contracts/project-scoping.md` §4 routes resolution semantics to
`frontmatter-schema.md`, owned by me, and deliberately does not restate them — "two documents
describing one resolution algorithm will drift, and the drift will be invisible until a run
picks the wrong agent." That routing is accepted. `comms/contracts/agent-cascade.md` is
therefore a **working draft of this ADR, not a third contract**: on acceptance it merges into
`frontmatter-schema.md` and is deleted. It exists separately only while this ADR is `proposed`,
because amending an accepted contract on the strength of a proposed decision is the same
mistake in the other direction.

This ADR answers `project-scoping.md` §5.2 **Q9–Q15** in full. See `agent-cascade.md` §10 for
the question-by-question mapping.

On acceptance, `comms/contracts/frontmatter-schema.md` gains:

- optional field `forked_from: {ref, commit, digest}`, legal only at L1/L2;
- the field-class table (agent-cascade §3.2) as a new section;
- invariants **8–13** (identity fields fixed · Class C monotonicity · `deliver` absent at L0 ·
  `status` authored as `draft` only · `forked_from` resolution as warnings · one department per
  slug per layer);
- invariant **6** amended — "hand-set values get overwritten by `agent-auditor`" becomes "an
  authored value other than `draft` is a validator error, and the resolver sets the field from
  the ledger without reading the file."

`comms/contracts/api-contracts.md` (owner `runner-engineer`) needs two new refusals:
`cascade_unresolved` (422) and `connector_uncredentialed` (422). Requested by message, not
edited here.

**No `agents/**` file changes.** Every rule above is satisfied by the current twelve.
