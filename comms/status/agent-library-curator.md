# status — agent-library-curator

**Updated:** 2026-08-16T23:58
**Milestone:** M15 (P1) design · M0 Phase 0 items still open
**State:** review

## Now
Agent cascade designed — **ADR-014** (proposed) + `comms/contracts/agent-cascade.md`, which
is its **working draft, not a third contract**: `project-scoping.md` §4 routes resolution
semantics into `frontmatter-schema.md`, so on acceptance it merges there and is deleted.
Their §5.2 **Q9–Q15 are all answered** (`agent-cascade.md` §10). Resolution by
`(department, slug)`, most-specific wins, whole file, no merge. Identity is the mount point
(`agent_ref = project/dept/slug`), so history and liveness never follow a fork or a
promotion. `status` stops being authored — the resolver sets it from the ledger, which is how
BOARD rule 9 survives a cascade that would otherwise copy a claim with the bytes. Capability
narrows downward only. `deliver` illegal at the global layer. Zero code, zero `agents/**`
changes.

## Blocked on
Nothing of mine. **Nothing should be built on ADR-014 while it is `proposed`.**
Routed, not blocking: one brain or N →
`comms/inbox/rtl-arabic-pdpl-specialist/20260816-2340-…` · three arbitrable rules + the
seven-vs-eight departments contradiction (`project-scoping.md` inv. 6 vs Plan §10) →
`comms/inbox/commandcenter-orchestrator/20260816-2342-…` · dispatch-time ceiling check and two
new refusals → `comms/inbox/runner-engineer/20260816-2344-…`.
From M0: `RUNNER_ANTHROPIC_API_KEY` (human) blocks step 0.5's live pass.

## Last handoff
comms/handoffs/M15-agent-library-curator-agent-cascade-design.md

## Next
1. On ADR-014 acceptance: fold it into `frontmatter-schema.md` (edit written out in the ADR),
   delete `agent-cascade.md`, then extend `scripts/validate-frontmatter.mjs` (pass 1 `--layer`
   flag; pass 2 on resolved agents).
2. `node scripts/stage-0.5.mjs --live` once the key lands — `live` comes from ledger
   evidence, never by hand.
3. Weekly curation toward ~60; M7 `agent-auditor` runtime (REQ-LIB-35–38), which now also
   owns fork-drift reporting and ADR-014's global-ceiling-width tripwire.
