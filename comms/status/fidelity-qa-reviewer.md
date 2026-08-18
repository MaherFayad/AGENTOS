# status — fidelity-qa-reviewer

**Updated:** 2026-08-18T22:55
**Milestone:** M16 re-gate — all three FAIL items cleared
**State:** review

## Now

**All three M16 FAIL items PASS. Plus three claims graded: the `steer` proof holds, the
`withhold.ts` fail-open is closed with its residual stated at real width, and the deleted
known-gap test was the right call with a sufficient tombstone.**

- **PASS** — `ThreadView` `--ink-3` (fixed by deletion; the new gate
  `threads-contrast.test.ts` reads its class set from the CSS and its file list from the
  directory, and fails loudly rather than skipping) · `AddressComposer` radiogroup (fixed by
  `rtl-arabic-pdpl-specialist` at `306039e`, graded as theirs) · the erasure spec's verbs
  (four, not the three I counted).
- Verdict handoff: `comms/handoffs/M16-fidelity-qa-reviewer-m16-re-gate.md`.
  **`comms/verdicts/` still does not exist and I still have not created it.**

**M16 does not flip, and the blocker is my queue, not anyone's code.**
`rtl-arabic-pdpl-specialist`'s rule-6 review-request (`20260818-2225`) is **open and
ungraded**, its `re:` is an `M16-` handoff, and BRIEF line 14 counts that sweep inside M16.
One dispatch, mine. If the orchestrator scopes it out of M16, M16 flips on my verdict and I
will not argue — but that call is made out loud, not by my silence.

**Gated on a still tree at `4337eb6`, 22:41–22:52 +03:00**, after `rm -rf apps/web/.next`.
`verify` 0 · `typecheck:tests` 0 · rtl gate **holding 308** · `smoke:browser` exit 0 ·
tokens `scanned at 2026-08-18 22:42 +03:00 · 4337eb6 · clean`, 0 violations / **15**
exemptions — 5→15 because `drawer/` and `sessions/` are now **scanned** (`90167f4` closed my
expired-PROVISIONAL follow-up; I was not the instrument this round).
**The browser green printed its NOTE: 66 backend absences across 12 routes.** Client renders
without a backend; nothing more.

**The 1440px side-by-side has still never been run, on any milestone.** Reference frames are
with the user — the only remaining half of the Part VI bar.

## Blocked on

Nothing. Tree still and clean throughout.

## The four findings worth carrying

1. **When a finding is "this claims a derivation it does not have", make the derivation and
   read what stops compiling.** I named one `=== 'steer'` literal by reading; the flip found
   two, and the second was in the keyboard path that had just become load-bearing.
2. **A bound that drops protection is not a bound.** `size() <= 32` was true and graded the
   resource while the protection failed open under it. Ask of every ceiling: when it is
   reached, what is lost, and who is told?
3. **A known-gap test should carry its own closing instruction.** *"Delete this and say so —
   do not weaken it to keep it green"* made the right action cheap and the wrong one
   visibly wrong.
4. **The absence of a constraint deserves the same evidence as its presence.** *"No length
   `CHECK` on `ops.message.body`, no `LIMIT` on `readMailbox`"* was checked before a residual
   was written — *grade a constraint from both sides*, in the direction nobody uses.

## Last handoff

`comms/handoffs/M16-fidelity-qa-reviewer-m16-re-gate.md`

## Next

1. **`rtl-arabic-pdpl-specialist`'s rule-6 pass** (`20260818-2225`) — the only thing between
   M16 and a flip. Arabic register, `<bdi>`/LRI-PDI, ADR-038 (`proposed`, not to be graded
   as accepted), two PDPL items.
2. **`shell-navigation-engineer`'s two M15 messages** (`tablist-rtl-arrow-keys`,
   `m15-coverage-gate-review`) — still the oldest open thing I owe.
3. **Fold into `cc-fidelity-check`:** read the `smoke:browser` NOTE before citing the green ·
   the worktree method for grading a ratchet raise · findings 1 and 2 above.
4. **Add to BRIEF:** finding 1 (make the derivation, read the compiler) and finding 3
   (a known-gap test carries its own closing instruction), plus
   `sessions-relay-engineer`'s second instance of the `git add` + bare `git commit` trap.
