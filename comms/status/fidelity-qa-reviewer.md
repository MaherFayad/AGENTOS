# status — fidelity-qa-reviewer

**Updated:** 2026-08-18T23:05
**Milestone:** M16 — the §23.11 rule-6 pass graded **PASS**
**State:** review

## Now

**M16's last open item is graded and M16 flips.** `rtl-arabic-pdpl-specialist`'s rule-6 pass
(`20260818-2225`) is **PASS** — answered and archived. It was **not** scoped out: §23.11 rule
6, `Plan §22` and §21.8 put it inside the milestone and M15 set the separate-artefact
precedent.

- Verdict: `comms/handoffs/M16-fidelity-qa-reviewer-the-rule-6-pass-verdict.md`.
  **`comms/verdicts/` still does not exist — four verdicts now cite it.**
- **The bidi placeholder fix is the strongest artefact in M16.** I derived it rather than
  taking the measurement: UAX #9 **N2** moves the leading `@` (neutral, R→L, at `sor`=R);
  **N1** leaves the interior `·`/`#`/`@@` (L→L) alone. One sigil detaches, the others cannot —
  which is exactly why the two misread tokens are the two that mean different money. The gate
  scans the whole catalogue (`Object.entries(ar)`), so later strings are covered.
- **The jsdom ruling holds: do not split the test.** Re-declared, not re-graded. The
  `AddressComposer` keyboard work stays graded at `0351add`, not re-graded here.
- **ADR-038 graded as `proposed`**, and its **refusal of option D is the better half** — in
  the options table, by name, reasoned as the house defect, so a later agent must overturn it
  in writing rather than fill a blank.

**Three follow-ups, none blocking:** (1) ADR-038 cites `0007_projects.sql`; the constraint is
`0005_project_axis.sql:75` and 24 citations across 20 comms files say so — fix before a human
reads the ADR. (2) `i18n.test.ts:78` skips `todo()` entries, which render **English inside the
RTL paragraph**; four current todos are clean but `threads.address.default` is one. (3)
`rtl.css:238`'s `.u-auto` is unused and its name claims `dir="auto"` semantics (`plaintext`)
that `inherit`+`isolate` does not have — the same class as the comment just corrected.

**Gated by me on a still tree at `d808fb2`, 22:55–23:00 +03:00.** `validate:tokens` 0
violations, banner `scanned at 2026-08-18 22:57 +03:00 · d808fb2 · clean`, 337 files ·
`validate:rtl:gate` **holding 308** · `test:web` both halves green. I did **not** re-run
`verify`/`smoke`/`smoke:browser` — run twice at `4337eb6` by the author and the orchestrator,
and the browser green **printed its NOTE: 66 backend absences**, which is why none of it is
evidence about a running backend.

**The 1440px side-by-side has still never been run, on any milestone.** Reference frames are
with the user — still the only remaining half of the Part VI bar. This dispatch's commits
touch **no CSS at all**, so nothing about proportion, tracking or density moved.

## Blocked on

Nothing. Tree still and clean throughout.

## The findings worth carrying

1. **A falsification whose baseline was never green proves nothing** — the inverse of *"a test
   that has never been red proves nothing"*, and the half we had not written down. Found by
   an author catching their own harness (`node --test` on a suite needing `tsx`).
2. **Derive the measurement, don't just trust it.** The bidi claim was checkable against UAX
   #9 N1/N2 in five minutes, and deriving it is what proved the *reason* right, not just the
   patch — which is what the next person copies.
3. **A name is a claim too.** `.u-auto` asserts platform behaviour it does not implement, in
   the same file as the comment that was just corrected for doing exactly that.
4. **A wrong citation is not automatically a block.** ADR-038 names the wrong file *and*
   quotes the constraint's unique name verbatim in the same sentence, so a reader recovers by
   grep. Gate on whether the error is recoverable from what is beside it — not on whether it
   is annoying.

## Last handoff

`comms/handoffs/M16-fidelity-qa-reviewer-the-rule-6-pass-verdict.md`

## Next

1. **`shell-navigation-engineer`'s two M15 messages** (`tablist-rtl-arrow-keys`,
   `m15-coverage-gate-review`) — now the oldest open thing I owe, and my whole queue.
2. **Fold into `cc-fidelity-check`:** finding 1 above · read the `smoke:browser` NOTE before
   citing the green · the worktree method for grading a ratchet raise · *a bound that drops
   protection is not a bound* · *make the derivation and read the compiler*.
3. **Add to BRIEF:** *make the derivation, read the compiler* · *a known-gap test carries its
   own closing instruction* · `sessions-relay-engineer`'s second instance of the `git add` +
   bare `git commit` trap.
4. **`comms/verdicts/`** — decide it or stop citing it. Four verdicts deep is too many.
