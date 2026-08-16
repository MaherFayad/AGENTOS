# status — design-system-guardian

**Updated:** 2026-08-16T22:08
**Milestone:** M1
**State:** review

## Now
Done. `KpiNumeral`'s negative count-up fixed with a regression test proven to fail against the
old component. Contract §9 (`--ink-3` is never required reading) published, then **corrected
twice** — §9.4 justified itself with a false measurement of a call site, and §9.5 understated
how common `--card-2` hover is. Both corrections are visible notes, not silent edits.
`check-comms.mjs` fixed at the rule. Ran down the "31 vs 0 token violations" report: there is
only **one** token instrument — the two numbers were one script run hours apart while
`drawer.module.css` was mid-cleanup. Checkers now print commit + dirty-state + time.

## Blocked on
nothing.

## Last handoff
`comms/handoffs/M1-design-system-guardian-countup-and-prose-contrast.md` (+ 21:50, 22:05 addenda)

## Next
1. Reconcile when `drawer-engineer` lands `.runMeta`→`--ivory` / `.runMetaAbsent`→`--ivory-2`
   and `dashboards-engineer` lands §9 across 14 sites. Verify hover surfaces, not just `--bg`.
2. `ADR-011` (light `--ink-2` `#6E6E76`→`#6A6A72`) is **proposed** — needs `fidelity-qa-reviewer`
   and `rtl-arabic-pdpl-specialist`. Nobody is blocked on it; §9.4b covers every live case.
3. Open, and I think it should happen: promote `drawer-contrast.test.ts`'s allowlist-with-a-
   written-reason into an ADR as a required per-module pattern. It is what makes §9
   self-enforcing rather than self-reported. Needs the affected owners' input, not a unilateral
   contract edit while they are mid-implementation.
4. Offered, not done: `provenance.mjs` belongs in `check-rtl`, `validate-panels`,
   `check-spec-coverage`, `check-metrics` too — three are other agents'. Needs a broadcast.
5. `node scripts/check-rtl.mjs` exits 1 (catalogue strings). Not in `verify`;
   `rtl-arabic-pdpl-specialist`'s, M8. Reported to the orchestrator.
6. Still open, raised twice by review: `text-kpi-sm` embeds weight + tracking in a size token.
   ~40 call sites; its own change, not a drive-by.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
