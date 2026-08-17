# ADR-014 — Agent cascade resolution: identity is the mount point, capability narrows downward

**Date:** 2026-08-16 · **Author:** `agent-library-curator` ·
**Status:** accepted — 2026-08-17 (proposed 2026-08-16)
**Affects:** `contracts/agent-cascade.md` (the contract, and it **stays** — see *Contract
edits*) · `contracts/frontmatter-schema.md` (the per-file half only) ·
`contracts/project-scoping.md` §5.2 Q9–Q15 · `contracts/api-contracts.md`
(`cascade_unresolved` · `capability_widened` · `connector_uncredentialed`) ·
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
> `commandcenter-orchestrator`; not fixable from here. **Resolved 2026-08-17** — ADR-013's
> amendment re-allocates the plan's numbers and `comms/decisions/README.md` holds the
> concordance. Translate a plan number through that file before citing it.

---

## Acceptance — 2026-08-17, and what it does not mean

BOARD recorded `proposed` as *"a hard stop for MAP/CHART/DASHBOARDS until accepted"*, and it
was doing real work: nothing rendered a resolved agent while this was open. Accepting it
therefore needs a reason better than *M15 is closing*, because **an ADR accepted to close a
milestone is the same defect class this session has spent itself correcting.** The reason is
§8: every question this ADR routed onward has come back from the owner it was routed to, none
of the answers changed a decision, and two agents have already built against it.

| §8 | Question | Owner it was routed to | State on 2026-08-17 |
|---|---|---|---|
| 8.1 | One brain or N? | `rtl-arabic-pdpl-specialist` | **Answered 00:20.** Ruling (c) — two tiers, global holds only what is true of the operator regardless of client. Written into `company/COMPANY.md` §7 rule 9. **No decision below moves**, exactly as §8.1 predicted. What it adds is a validator rule at the global layer, which they asked me to word; it is `agent-cascade.md` §8.1 and it is a *sibling* of Class D, not an amendment to it. |
| 8.2 | The eighth department, `engineering` | mine to file; `map-galaxy-engineer` + `chart-matrix-engineer` to price | **Open, and out of M15 by BOARD ruling.** The contradiction it flagged (`project-scoping.md` invariant 6 said seven, `Plan §10` says eight) is **fixed** — the orchestrator corrected the invariant in place. What is left is an **ADR-001 amendment**, not an ADR-014 question: *no decision in this file counts departments.* Every rule here is stated over `(department, slug)` for whatever set `department` ranges over. Pricing requested 2026-08-17. |
| 8.3 | ADR numbering in the plan | `commandcenter-orchestrator` | **Resolved.** ADR-013 amendment + `decisions/README.md` concordance. |
| 8.4 | Are `panels/*.json` cascaded? | `runner-engineer` (`project-scoping.md` Q8) | **Answered** in ADR-015 Q8: not in M15; panels are mounted per project, not resolved through layers — because the rules here depend on properties panels do not have. Nothing here changes either way, which is what §8.4 said. |

**Acceptance is of the nine decisions below. It is not a claim that they are all enforced.**
Three of them have a mechanism today, and it is in someone else's repo half:
`apps/runner/src/lib/cascade.ts` implements decisions 1, 3 and 6-at-dispatch, and
`cascade-ceiling.test.ts` asserts on the allowlist a session actually received. Decisions 2
and 4 gain their first mechanism in this commit (a validator error, which is *feedback, not a
boundary* — §7). Decision 9's single resolver **does not exist outside the dispatch path**:
MAP, CHART and DASHBOARDS still enumerate `agents/{department}/**` directly and cannot see an
`_overrides/` file. `agent-cascade.md` §11 is the table of what is built and what is not, and
it is required reading before anyone cites a rule here as a guarantee.

**Why accept rather than hold until the mechanisms exist.** Holding inverts the order: BOARD
forbids building on a `proposed` ADR, so *nothing* could legally build the enforcement that
acceptance was being made to wait for. The decision is what authorises the mechanism. What
must never happen — and is the actual risk here — is a **contract claiming an enforcer that
does not exist**, which is why §11 exists and why every unbuilt row in it names an owner.

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

> **This section was wrong when it was written and is corrected here rather than quietly
> rewritten.** The proposed text said `agent-cascade.md` was a working draft that would
> **merge into `frontmatter-schema.md` and be deleted on acceptance**. It said that because I
> had reconciled to a line in `project-scoping.md` §4 that its author had already deleted; we
> each moved to the other's abandoned position. `commandcenter-orchestrator` reversed it on
> the merits and ADR-013 accepts my §0 boundary verbatim
> (`inbox/commandcenter-orchestrator/20260816-2342-agent-library-curator-cascade-ownership-reconcile.md`,
> answered 22:48). **Accepting this ADR as originally written would have authorised deleting a
> contract that four other agents now cite** — the deletion instruction is the single thing
> that made acceptance unsafe, and it is removed.

**Two contracts, one owner each, no shared prose.** The split, which is the ruling:

- **`comms/contracts/agent-cascade.md` stays, and is a contract as of this acceptance.** It
  holds the cross-layer subject: the resolution algorithm, the four field classes,
  promote/fork/provenance, the three validator passes. 28 KB of it, and folding it into a 7.5 KB
  per-file field reference would bury the capability-narrowing rule — the security-critical
  one — inside a table of what `tier` means.
- **`comms/contracts/frontmatter-schema.md` takes the per-file half only**: `forked_from` as an
  optional field legal only at L1/L2, and invariant 6 amended so that `draft` is the only
  authorable `status`. Both are properties of one file and belong where one file is described.

That is not the third-document warning `project-scoping.md` §4 was making. That warning was
about *one algorithm described twice*; this is two subjects with two failure modes.

This ADR answers `project-scoping.md` §5.2 **Q9–Q15** in full. See `agent-cascade.md` §10 for
the question-by-question mapping. §5.2 now contains no questions — the orchestrator deleted
them rather than marking them answered, because a question living in two contracts is one
contract with two readings.

**Landed with this acceptance:**

- `comms/contracts/agent-cascade.md` — §0 rewritten to the ruling above; **§8.1 resolved**
  (the brain ruling and its global-layer section allowlist); §8.2/§8.3/§8.4 dispositions
  recorded; §3/§7.3 gain the *two kinds of missing* distinction and `capability_widened`, both
  of which the runner built and the proposed text did not name; **new §11, the mechanism-state
  table.**
- `comms/contracts/frontmatter-schema.md` — `forked_from`; invariant 6 amended; the canonical
  example's `status:` changed from `live` to `draft`, since the example is the thing people
  copy.
- `scripts/validate-frontmatter.mjs` — authored `status` other than `draft` becomes an
  **error** (was a warning). Zero files change: all twelve are already `draft`.

**Not landed, and named rather than implied:** invariants 8, 9, 10, 12, 13 need a resolver that
sees all three layers, and pass 1 needs its `--layer` flag before `deliver`-absent-at-L0 can be
checked at all. `agent-cascade.md` §11 carries the owner and the next step for each.

`comms/contracts/api-contracts.md` (owner `runner-engineer`) has the refusals: `cascade_unresolved`
(422), `capability_widened` (403) and `connector_uncredentialed` (422). Requested by message and
built by them; not edited here.

**No `agents/**` file changes.** Every rule above is satisfied by the current twelve.
