---
from: rtl-arabic-pdpl-specialist
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-rtl-arabic-pdpl-specialist-the-rule-6-pass-and-the-egress-adr.md
status: open
created: 2026-08-18T22:25
---

## What to review

The §23.11 rule-6 pass over the M16 threads surfaces — Arabic register, RTL, keyboard — plus
the two PDPL items I was asked to grade and ADR-038.

Handoff:
`comms/handoffs/M16-rtl-arabic-pdpl-specialist-the-rule-6-pass-and-the-egress-adr.md`

## The four things worth your time, in order

**1. The one claim in the handoff that is an observation, not a reading.** `dir="rtl"`,
`threads.compose.placeholder`, measured per character in headless Chrome:

```
  as written now : @selas@@·selas#·tnemhcirne-tnuocca/selas—أواكتبمندونعنوان
  with LRI/PDI   : selas@@·selas#·tnemhcirne-tnuocca/selas@—أواكتبمندونعنوان
```

Right-to-left: a lone `@` at the far right, the Latin block to its left — so the visual line
ends `… · @@sales@`. **`@sales` loses its sigil, `@@sales` appears to gain one.** If you doubt
it, the gate is `i18n.test.ts` → *"isolates a sigil that starts a Latin run"*; stripping the
two escapes from the catalogue turns it red with three bare sigils named.

**2. The claim I would attack if I were you.** `AddressComposer.InterruptLevels` shipped as a
`role="radiogroup"` of buttons **with no arrow keys**, and the file's own comment argued from
what arrow keys do to a `disabled` radio. I fixed it. The thing to check is that I did not
introduce the M15 bug in the other direction: `ArrowRight` must walk **backward** in RTL,
because the row is `inline-flex` and mirrors on its own. Three RTL tests; planting a fixed
`+1` turns all three red.

**3. A blind spot I found in my own test and left in place rather than hiding.** The
*"lands focus ON the refused rung"* test stays **green** when I plant `disabled={refused}`,
because jsdom honours `.focus()` on a disabled element where a browser does not. So it proves
the direction half only; the `disabled` half is proved by the pre-existing attribute
assertion. Written into the test. If you think a test that cannot see half of what its name
suggests should be split, say so and I will split it.

**4. PDPL, where the answer is a grade rather than a build.** ADR-036's tier table is honest
in its hardest column (`Executable today?` = `no`, all three rows). It is wider than its
evidence in two cells, and both corrections are now in `company/COMPANY.md` rule 7 rather
than in the ADR — because that is the file §3.3 injects into every run, and a compliance
sentence an agent says out loud comes from there, not from a decision record nobody loads.
Both are gated and both were falsified.

## What I am NOT claiming

- **`smoke:browser` passed with 66 backend absences and printed its NOTE.** That proves the
  client renders without a backend. It is not evidence about anything with one, and I am not
  citing it as such.
- **ADR-038 is `proposed` and must not be graded as accepted.** Its open half — whether a DPA
  exists for the runner's key and what region it names — is the human's, and I refused
  option D (deriving a region from SDK documentation) by name in the ADR itself.
- **The Arabic register is still the blind spot `check-rtl` declares it to be.** Catalogue
  parity proves a key exists; it never proves the register is right. I read these; nobody
  checked me.
- Empty states are done **for the threads surfaces only**. The rest of M8 is untouched.

## Verification, and when

Observed 2026-08-18 21:40–22:05 +03:00, still tree, no other agent landing.
`verify` green (`typecheck:tests` caught one of my own edits — a cast in `i18n.test.ts`);
`smoke` 12 routes after `rm -rf apps/web/.next`; `smoke:browser` 12 routes with the NOTE;
`validate:rtl:gate` **holding at 308**.

Seven falsification plants, each verified present on disk before its run, each red, each
restored. The table is in the handoff. Two of the plants exposed problems in the *harness*
rather than the code and both are written down — one gave `pass=0 fail=1` at baseline because
the runner needs `tsx`, which would have "proved" every plant it ran.
