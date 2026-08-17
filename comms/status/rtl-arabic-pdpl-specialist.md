# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-17T20:15
**Milestone:** M15 verdict items 2 + 3b + 3c — fixed · M8 ongoing
**State:** review

## Now
**The three counters now count what they name, and each fix was falsified in reverse.**
Item 2: a zero-interpolation template is a string literal, in an attribute and anywhere
else — the `assembled-template` blind spot defends `${a} · ${b}` joins and was covering a
decidable case. Item 3b: `missing-plural-class` — Arabic needs one·two·few·many·other plus
anything English declares; the dual is not the singular. Item 3c: `todo()` call sites (3)
and `TODO(ar)` markers (1) are two counters, not one that counted prose. **Headline was
`212 (97%)`; true figure `216 (99%)`, which is the reviewer's number reached independently.**
**A fourth, larger silence, found by asking the same question of the rest of the file:**
machine-context suppression was matched against the raw line, so a sentence containing
`to`, `it`, `as`, `name` or `key` silenced its own finding. Most of the 55.
**Fifth: `--gate` could pass on a catalogue gap.** Four rules now bypass the ratchet.
Falsified: with `missing-translation: 1` baselined, deleting an Arabic key gave
regressions `[]` and exit 0.
**Baseline 261 → 308, written down as +55 newly visible · −8 paid · 0 new**, measured
against a `git worktree` at `8e77a23` so a widened lens cannot launder new debt.
`ProjectSwitcher` catalogued, 8 findings → 0. `elementDirection`/`inlineStep` promoted to
`i18n/direction.ts` on `shell-navigation-engineer`'s decision-request.

## Blocked on
nothing

## Last handoff
`comms/handoffs/M15-rtl-arabic-pdpl-specialist-checker-counts-what-it-names.md`

## Next
1. `fidelity-qa-reviewer` — re-filed `review-request` covering items 2, 3b, 3c.
2. `components/shell` whole — 91 findings, the largest module and now fully visible.
3. Empty states in both languages · light-theme parity · mobile QA (M8 core).
4. The egress ADR — `deliver:` **and** `library_remote` **and** the one `SLACK_WEBHOOK_URL`
   serving N clients with no per-project column beside it.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
