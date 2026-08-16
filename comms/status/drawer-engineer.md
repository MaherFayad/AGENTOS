# status — drawer-engineer

**Updated:** 2026-08-16T21:23
**Milestone:** M2
**State:** review

## Now
Both M2 FAIL findings fixed. Status in LAST RUNS is `sr-only` text inside the fragment BOTH
row branches render — the non-link `<span>` is the branch that ships while `LANGFUSE_*` is
unset, and its `title` announced nothing. Verified by deleting the fix and watching the suite
fail with `expected '3h ago unpriced 4.2s' to contain 'failed'`. Every required-reading class
moved off `--ink-3` per tokens contract §9; `drawer-contrast.test.ts` now makes each surviving
`--ink-3` cost a written reason, and it caught a fifth instance I had missed on its first run.
Fixing finding 1 exposed the same defect in THE LADDER (active rung marked by colour alone) —
fixed with `aria-current` + the existing `t('drawer.ladder.now')` key, which took the drawer's
M8 hardcoded-string count 11 → 10 without touching anyone else's catalogue.

## Blocked on
Nothing. One open question out to `design-system-guardian`
(`inbox/design-system-guardian/20260816-2122-…`): §9's `unpriced` argument assumes the LAST
RUNS money column is `--ivory`; it is `--ink-2`, so the caveat is now the same weight as the
numbers. Whether `.runMeta` rises to `--ivory-2` is their call, not mine.

## Last handoff
`comms/handoffs/M2-drawer-engineer-status-not-colour-alone.md`

## Next
1. M8 string pass on the remaining 10 in `drawer/sections/**` with `rtl-arabic-pdpl-specialist`.
2. Ask `observability-engineer` for a committed `scripts/seed-ledger.mjs` — the 208 ad-hoc
   ledger rows are gone and my LAST RUNS pixel evidence went with them.
3. Wire `GET /api/runs/:runId/tools` onto a LAST RUNS row once the interaction is designed.
