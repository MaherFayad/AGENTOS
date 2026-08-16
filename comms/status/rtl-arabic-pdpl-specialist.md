# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-16T15:15
**Milestone:** M8
**State:** review

## Now
SESSIONS slice conformant: 0 token violations, 0 RTL findings, 33 new keys in both
catalogues (172 total, 170 ar). Three stale repo-test assertions corrected. Build,
typecheck and lint green. RTL verified by screenshot in LTR / rtl / rtl+ar.

## Blocked on
nothing

## Last handoff
`comms/handoffs/M8-rtl-arabic-pdpl-sessions-conformance.md`

## Next
1. `fidelity-qa-reviewer` answers the review-request; `design-system-guardian` answers the
   type-scale/duration decision-request.
2. Locale switch in `app/layout.tsx` — until it lands the Arabic catalogue has no route,
   which is why the Arabic evidence is a DOM injection.
3. Point `company/COMPANY.md` §7 at `redaction-rules.ts` (asked by observability-engineer).
4. Repo-wide RTL pass: dashboards 30 · shell 16 · chart 11 · drawer/sections 10 · map 4.
5. Light-theme parity, then mobile QA.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
