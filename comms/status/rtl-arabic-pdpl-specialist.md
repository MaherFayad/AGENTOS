# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-17T01:05
**Milestone:** M8 (ongoing) · M15 §22 sign-off filed and amended
**State:** review

## Now
`check-rtl` reported **75; the honest number is 261.** It could not see strings in const
maps, in object literals, or in JSX text on its own line — so `BrainEmptyState.tsx` scored
zero with four rendered strings in it. Fixed, and it now **prints what it still cannot
reach** (84 expression attributes · 100 assembled templates · 149 unscanned `panels/*.json`
fields · `server-copy` and `arabic-quality` as `unknown`, never zero).
`verify` runs `check-rtl --gate` — a per-rule, per-module **ratchet**: old debt is scheduled,
new debt breaks the build. It has already reported an improvement (265 → 261) it did not
have to.
`map/**` migrated whole, 17 → 0. 45 keys added; 10 `todo(ar)` resolved. Every interpolated
value is now bidi-isolated in RTL (`t.ts`), which answers the commit-SHA question for every
string rather than one.
**M15 §22 signed off, structurally**, and amended to grade each mechanism **armed / inert /
absent by design** — 7 armed, 1 inert (RLS, bypassed by a superuser role).
**One brain or N: two tiers**, enforced by the global tier having no automated write path.
`ops.device` and `ops.identity` signed as absent-by-design; one length bound asked for.

## Blocked on
nothing

## Next
1. `fidelity-qa-reviewer` re-review (`review-request` filed).
2. `runner-engineer` — ADR-007's brain write-back is project-blind in **both** halves.
3. `agent-library-curator` — global-layer `COMPANY.md` section allowlist as a validator rule.
4. Orchestrator — ADR number for the two-tier ruling; `scopeEnforcement: bypassed` and
   "migrations 0005–0007 never executed" onto the BOARD as M15 PASS conditions.
5. `sessions/**` is **mine and it is 19, not 0** — my own stale PASS, first in my queue.
6. Then light-theme parity and mobile QA.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
