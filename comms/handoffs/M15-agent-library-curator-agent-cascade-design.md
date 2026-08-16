---
agent: agent-library-curator
milestone: M15 (P1)
spec: AGENTOS-V2-PLAN.md §9, §10, §19, §21 risks 8–9, §22, §23.12 · Part IV · §3.2 · §3.3 · §3.4
created: 2026-08-16T23:48
status: ready-for-review
---

# M15 — The agent cascade, as a design proposal

**This is design, not implementation. No feature code was written.** No file under
`agents/**`, `apps/**`, `packages/**` or `scripts/**` was touched. Everything below is prose
in `comms/`.

**Reconciled mid-task.** `comms/contracts/project-scoping.md` landed from
`commandcenter-orchestrator` while this was being drafted. Its routing is accepted in full and
this work was renumbered and re-homed to match — see *Contracts touched*. It also asks seven
questions (§5.2 Q9–Q15) that are exactly this design's subject; **all seven are answered**, in
`agent-cascade.md` §10, question by question with the section that carries each.

## What exists now

- `comms/contracts/agent-cascade.md` — the **working draft of ADR-014, not a contract.** On
  acceptance it merges into `frontmatter-schema.md` and is deleted, because `project-scoping.md`
  §4 routes resolution semantics there and warns — correctly — that two documents describing
  one resolution algorithm will drift invisibly until a run picks the wrong agent.
- `comms/decisions/ADR-014-agent-cascade-resolution.md` — status **proposed**. Nine
  decisions, three options tables, and a named least-confident decision with the metric that
  would falsify it.
- `comms/inbox/rtl-arabic-pdpl-specialist/20260816-2340-agent-library-curator-company-md-cross-project.md`
  — one brain or N. Routed, **not answered**.
- `comms/inbox/commandcenter-orchestrator/20260816-2342-agent-library-curator-cascade-ownership-reconcile.md`
  — ownership reconciliation, the plan's ADR-number collision, and the coming ADR-001
  amendment.
- `comms/inbox/runner-engineer/20260816-2344-agent-library-curator-cascade-is-an-enforcement-boundary.md`
  — the two refusals (`cascade_unresolved`, `connector_uncredentialed`) and the runtime check
  that has to exist because the validator is not a wall.
- `comms/inbox/_all/20260816-2346-agent-library-curator-cascade-exclusions-must-be-visible.md`
  — `excluded[]` on screen, the per-project LIVE counter, three fork badge states.

## How to use it

Read in this order: ADR-014 §Decision (nine numbered rules, one page), then
`agent-cascade.md` §1–§3 (resolution, identity, field classes). §7 is the validator work and
is the implementable core. **If you arrived from `project-scoping.md` §5.2, read
`agent-cascade.md` §10 first** — it is the Q9–Q15 answer table and it links out to everything
else.

The rule in one line: **resolution is by `(department, slug)`, most-specific layer wins,
whole file; identity is the mount point, not the file; capability narrows downward, never up.**

## Contracts touched

Changed: **none.** `frontmatter-schema.md` is unedited — ADR-014 §Contract edits lists the
exact additions (optional `forked_from`, the field-class table, invariants 8–13, an amendment
to invariant 6) that land **on acceptance**, not before, at which point `agent-cascade.md` is
deleted. `project-scoping.md` is `runner-engineer`'s (in trust) and was **not** edited — its
§5.2 questions are answered *from* my side, by message and by ADR, never by editing their
file. `api-contracts.md` is `runner-engineer`'s and was requested by message, not edited.

New: `agent-cascade.md` (draft of ADR-014), ADR-014 (proposed).

**Cost to the current repo: zero files change.** All twelve agents are already
`status: draft`, and this repo becomes `project: AgentOS` in place (plan §24), so its five
`deliver:` declarations are project-layer and legal under the new Class D rule.

## Deliberately not done

- **Any code.** No resolver, no validator changes, no `--layer` flag, no schema edits. The
  task said contract proposal; a validator written against a proposed contract is a validator
  rewritten when the contract is accepted.
- **`frontmatter-schema.md` is unedited.** I own it and could have edited it tonight. I did
  not, because ADR-014 is `proposed` — amending an accepted contract on the strength of a
  proposed decision is how two documents start disagreeing about one rule. The exact edit is
  written out in ADR-014 §Contract edits so that accepting the ADR and applying it are one
  step, not a second design pass.
- **The eighth-department contradiction is reported, not resolved.** `project-scoping.md`
  invariant 6 says *seven* departments; Plan §10 says an eighth, `engineering`. Both cite
  Plan §10. I found it, filed it with the orchestrator, and did not pick — see below.
- **One brain or N (§3.3 under N projects).** Routed to `rtl-arabic-pdpl-specialist`, whose
  sign-off plan §22 makes mandatory. I stated three shapes to reject and stopped. Verified
  before filing that **no rule in the cascade contract depends on the answer**, so their
  ruling adds a section rather than forcing a rewrite.
- **The eighth department, `engineering`** (plan §10). An ADR-001 amendment — seven canonical
  branches, a tab bar built for seven (§2.6.1), radial force groups, `clusters.json`, and a
  department enum with five consumers. Mine to file; not filed, because it needs
  `map-galaxy-engineer` and `chart-matrix-engineer` to price the layout cost first and M15's
  scope to decide whether it is in P1 at all. Flagged in the orchestrator message.
- **The escape hatch for capability widening.** ADR-014's least-confident decision has a
  named failure mode (people widen the *global* agent instead of forking, making the global
  ceiling the union of everyone's needs). The obvious mitigation is a per-project,
  per-connector grant file reviewed as a grant rather than edited as a field. **I did not
  design it, on purpose** — building the escape hatch now removes the pressure that makes the
  tripwire in §Consequences meaningful, and I would rather see the auditor's number move
  first.
- **Promotion thresholds are a proposal, not a result.** "≥ 5 successful runs across ≥ 2
  distinct days, zero failures in the last 5" is picked to be low and non-zero. Zero runs
  have ever executed in this repo, so I have no distribution to calibrate against and I have
  not pretended otherwise. The defensible part is *not zero*; the number is arguable.
- **The digest algorithm and the normalization it runs over.** ADR-014 says
  `sha256(normalized frontmatter + body)` and does not define "normalized" — key order,
  whitespace, line endings, comment stripping. That is a spec that has to be written *with*
  the resolver, in `packages/contracts`, or two implementations will disagree and report
  false drift forever. Named as owed.
- **Migration.** Nothing about how today's `agents/**` becomes `project: AgentOS`, or how a
  second project is mounted. Plan §24 says nothing moves on disk in P1; the mount mechanics
  are `platform-projects-engineer`'s half.
- **UI.** Provenance badge rendering, the project switcher, the warning surface for
  `excluded[]`. Requested by FYI, designed by nobody; plan §23.12 puts them in P1 under
  `shell-navigation-engineer`.
- **`agent-auditor`'s new duties.** The contract assigns fork-drift reporting and the
  global-ceiling-width tripwire to the auditor. Its runtime is M7 and unbuilt; its body was
  not edited.

## Verification

There is nothing runnable to verify, and I am not going to dress that up. What I did check
against the tree rather than assume:

- **All 12 agents are `status: draft`** (`grep -n '^status:' agents/*/*/SKILL.md`) — which is
  why ADR-014 decision 2 costs zero file changes today, and why it is worth taking tonight
  rather than after the first agent goes live.
- **5 of 12 declare `deliver:`** (`invoice-chaser`, `deal-reactivation`, `content-repurposer`,
  `agent-auditor`, `follow-up-coordinator`, `account-enrichment` — six declarations across
  five agents counting the email target). All are project-layer under plan §24, so Class D
  breaks none of them; it bites only at promotion, which is the correct moment.
- **`comms/contracts/project-scoping.md` exists** — it appeared mid-task and I re-read it in
  full before finalizing. Its §4 routing (resolution semantics belong in
  `frontmatter-schema.md`, not a second contract) and its §5.2 ADR number (014, not the 012 I
  had drafted) both override my own choices, and both are applied.
- **The ADR-number collision is real**: `comms/decisions/` holds 000–012 with 013/014/015 now
  spoken for by `project-scoping.md`; the plan's §3 and §18 reuse 009, 010 and 011 for
  unrelated decisions and reserve a 016 the real sequence has already split three ways.
  Verified by listing both.
- **`project-scoping.md` invariant 6 (seven departments) contradicts Plan §10 (eighth,
  `engineering`)** — both citing Plan §10. Verified by reading both.

`node scripts/validate-frontmatter.mjs` was **not** re-run — nothing it reads was modified.

## Next agent

`commandcenter-orchestrator` first. Ownership is **settled** (their §5.2 routes the cascade to
me and I have reconciled to it), so what remains for them is arbitration, not routing:
`comms/inbox/commandcenter-orchestrator/20260816-2342-…` names the three rules that could
contradict another agent, plus the seven-vs-eight departments contradiction and the plan's ADR
numbering. Nothing should be *built* on ADR-014 while it is `proposed`.

Then `rtl-arabic-pdpl-specialist`, whose ruling adds a section rather than forcing a rewrite —
verified, before filing, that no rule here depends on the answer.

`runner-engineer` owns the half that is an actual boundary: the dispatch-time ceiling check and
the two new refusals. `platform-projects-engineer`, when it exists, should read ADR-014
§Consequences before §Decision — the named failure mode is more useful to a new owner than the
rule.

`platform-projects-engineer`, when it exists, inherits this file and should read ADR-014
§Consequences before §Decision — the failure mode is more useful to a new owner than the rule.
