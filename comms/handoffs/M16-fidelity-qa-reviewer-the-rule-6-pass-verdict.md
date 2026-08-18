---
agent: fidelity-qa-reviewer
milestone: M16
spec: Part VI (the acceptance bar) · §1.4 · §1.3 · Part VII.4 · `Plan §22` · `Plan §23.11` rule 6
created: 2026-08-18T23:01
status: verdict
---

# M16 — the §23.11 rule-6 pass: **PASS**, and with it M16 flips.

Filed as a handoff because **`comms/verdicts/` still does not exist and I still have not
created it.** Four verdicts now cite that path.

The scope call was made out loud and it was made against me: this pass was **not** scoped out
of M16. §23.11 rule 6 puts it inside the milestone, `Plan §22` and §21.8 make it mandatory,
and M15 set the precedent of a separate artefact for a separate sign-off. So it is graded,
not waived.

| Item | Verdict |
|---|---|
| 1 · the bidi placeholder defect and its gate | **PASS** — the sharpest thing in M16 |
| 2 · the false platform claim in the catalogue comment | **PASS**, one sibling of the class found (follow-up 3) |
| 3 · the two self-reported falsification failures | **PASS** — the ruling holds, no split |
| 4 · ADR-038, and the refusal of option D | **PASS** as `proposed`; one wrong citation (follow-up 1) |
| 5 · the four Arabic strings, `inMailbox`, `compose.levelLabel` | **PASS** |
| 6 · `check-rtl`'s `JSX_ARROW` | **PASS** |

## What this PASS covers, and what it does not

It covers **the source half of `Plan §23.11` rule 6 over the M16 threads surfaces**: the
Arabic register against this catalogue's own declared rules, bidi isolation, the RTL keyboard
path, and the two PDPL items. The keyboard half of `AddressComposer` was **already graded at
`0351add`** as this author's work and is not re-litigated here.

It does not mean:

- **Zero agent runs have ever executed.** Nothing here has been exercised by one.
- **`0005`–`0008` have never met a live Postgres.** `ops.message` has never held a row, so
  every string I graded above the message body was graded against a shape, not a row.
- **The 1440px side-by-side has still never been run, on this or any milestone.** The
  reference frames are with the user. No PASS I have ever granted implies it, and this one
  changes nothing about proportion, tracking, weight, radius, colour or density: the
  dispatch's commits touch **no CSS at all**.
- **The Arabic register is still unchecked by a native reader.** `check-rtl` declares that
  blind spot and the author declared it again. I graded the four strings for *internal
  consistency with this file's own rules* — which is a real standard and is not the same
  standard as a native review.

## The standard, per item

### 1 · The bidi finding — **PASS**, and it is the strongest artefact in M16.

`apps/web/src/i18n/strings.ar.ts:317` now reads
`'⁨@sales/account-enrichment · #sales · @@sales⁩ — أو اكتب من دون عنوان'`.

**I did not take the measurement on faith and I did not need to.** The claim is derivable and
it derives: under `dir="rtl"` the paragraph's `sor` is R, so the leading `@` sits between R
and L and UAX #9 **N2** resolves it to the paragraph level — it is laid out with the RTL run
and lands at the far end of the Latin block. The interior `·`, `#` and `@@` sit between L and
L, so **N1** resolves them to L and they never detach. That is exactly the asymmetry the
author measured: one sigil moves, the others do not, and the two that read wrong afterwards
are the two that mean different money. With `FSI … PDI` the isolate's first strong character
is `s`, the leading `@` is now L-between-L, and it re-attaches. The fix is correct **for the
stated reason**, which is the part that matters when the next person copies it.

Two things I checked rather than assumed:

- **The escapes never reach the parser.** `AddressComposer.tsx:192` uses the string as a
  `placeholder`; `previewLine` runs on `line` state. No U+2068 can enter an address.
- **`dir="auto"` would not have fixed it.** HTML resolves `auto` on an empty control to the
  parent's directionality, so the field would still lay out RTL. The author's correction is
  right in both halves.

**Does the gate cover strings added later? Yes — structurally.**
`apps/web/src/i18n/i18n.test.ts:76` enumerates `Object.entries(ar)` and flattens plurals, so
it is a whole-catalogue scan and not an include-list of keys. A key added tomorrow is scanned
tomorrow. One real hole, non-blocking, in follow-up 2.

### 2 · The false platform claim — **PASS**, and one sibling exists.

The old note asserted the textarea is `dir="auto"` *"by virtue of being a textarea"*. It is
not, the correction says so in the file, and the correction is itself true.

I ran the class over the siblings — every comment in `i18n/`, `threads/` and `drawer/threads/`
that asserts platform behaviour. `<bdi>`, `aria-disabled` vs `disabled`, `closest('[dir]')`,
`dir="auto"` resolving per element on a `<p>`, and *"the one place in this app that sets it"*
(grep confirms: one non-test site) all check out. **One sibling of the class does not**, and
it is a name rather than a comment — follow-up 3.

### 3 · The two falsification failures — **PASS**, and the ruling holds.

**The red baseline is the more valuable of the two.** A harness that ran the runner suite
under `node --test` when it needs `tsx` gives `pass=0 fail=1` before any plant, and every
plant then "proves" itself. Reporting that against their own falsification table is the
behaviour BRIEF's *"a test that has never been red proves nothing"* is actually asking for —
its inverse, *a test that was never green proves nothing either*, is the half we had not
written down. I am folding it into `cc-fidelity-check` as: **a falsification run states its
baseline, green, before it states its plant.** For the record, no repo gate has this defect:
`apps/runner/package.json` is `tsx --test`, and root `test` is `node --test` over `.mjs` only.

**The jsdom blind spot: my ruling stands, and it is the same test.** I graded it at `0351add`
— *"Do not split the test"* — and nothing here changes the reasoning: a third test would also
see only one half, and the note in the file is worth more than the split. The `disabled` half
stays carried by the pre-existing attribute assertion. Re-declaring the blind spot in a second
handoff is not a second finding.

### 4 · PDPL and ADR-038 — **PASS as `proposed`, and the refusal is the better half.**

**I am not grading ADR-038 as accepted and this verdict does not advance its status.**

**The refusal of option D is correct and it is correctly *placed*.** It is in the options
table under its own name, with the reason stated as the house defect — *"a declared value read
as an observed one… indistinguishable from the `\"tailscale\": \"online\"` on a host with
none"* — and the Decision repeats that no agent in this repo may settle (c). That is the
difference between refusing an option and merely not choosing it: a later agent reaching for
the SDK docs to close the gap finds the refusal already argued and has to overturn it in
writing. Rule 9 has never had a higher-stakes surface than this one, and this is what
compliance with it looks like when the honest answer is *"a human must tell me."*

The ADR's checkable numbers are real, which I verified rather than took: **six** SKILL.md
files declare `deliver:`; `validate-frontmatter.mjs:425` accepts exactly `slack` and `email`
and validates shape only; `prompt.ts:59` renders `turn.body` verbatim. One citation is wrong
— follow-up 1.

**The two COMPANY.md corrections are in the right file.** Rule 7 is where a compliance
sentence an agent says out loud comes from (§3.3 injects it into every run); an ADR is not.
Both sentences are pinned in `scripts/__tests__/rtl-pdpl.test.mjs` and both were falsified.
*"An author is not a data subject"* is the sharper of the two and it is the one a client
conversation gets wrong by default.

### 5 · The four Arabic strings — **PASS**, on the standard I can actually apply.

- **`noThread`: بثّ → تدفّق. Correct, and the author's reason survives checking.** This file's
  own THREADS header (line 268) rejects بثّ **by name** for the fan-out sense — *"reads as
  one-to-many listening"* — 410 lines above the string that used it (`:678`). Two senses of one rejected
  word in one catalogue is the drift the header was written to prevent, and تدفّق is now the
  catalogue's only word for a stream (grep: one site).
- **`emptyBody`** — the old line was `الرسالة` (definite: *the* message) for an English
  sentence that is generic (*"A message needs a body"*). The change fixes a definiteness
  mismatch, not a taste.
- **`appendState.failed`: تعطّلت → فشلت** — checkable against the badge: `threads.state.failed`
  is فاشلة, same root. A sentence about a state now uses the state's own root.
- **`levelLabel`** — وصول is retained but no longer bare; «طريقة الوصول» over a
  permission-shaped control is a real misreading and naming الرسالة closes it. Nominal, per
  §1.4. The English pair shortens *"How this message lands" → "How it lands"*, and the Arabic
  pair now shortens the same way.
- **`threads.one.inMailbox`** — صندوق الوارد → صندوق البريد. Verified: **zero** remaining
  occurrences of الوارد, three prior sites already said البريد. One mechanism, one name.
- **Leaving the disposition pair untouched was the right call.** «في انتظار الدور» (queued)
  vs «سُلِّمت» (handed over and received) is the distinction the whole mailbox surface rests
  on, and it is drawn correctly. Changing four of seventeen and saying why the other thirteen
  stand is a review; changing seventeen is a rewrite wearing a review's name.

### 6 · `check-rtl`'s `JSX_ARROW` — **PASS.**

`/=$/` against the text before the match is the narrow form: it can only fire where the `>` is
the second half of `=>`. The paired test proves a real closing tag one character away still
fires, so the narrowing did not buy silence. And the ratchet **held at 308** rather than
dropping — which is the check that matters, because a false-positive fix that lowers a
baseline is indistinguishable from a fix that blinded the checker.

## The green, observed by me

**Still tree at `d808fb2`** — `git status` clean throughout, `d808fb2` is a BOARD correction
only over the gated `4337eb6`.

- `validate:tokens` — **0 violations**, provenance banner verbatim:
  `scanned at 2026-08-18 22:57 +03:00 · d808fb2 · clean`, 337 files scanned.
- `validate:rtl:gate` — **holding at 308**, `baseline 308 recorded 2026-08-17 19:45 +03:00 ·
  8e77a23`.
- `test:web` — both halves green (vitest + `node:test`, 97 node tests).
- Observed 2026-08-18 22:55–23:00 +03:00.

I did not re-run `verify`, `smoke` or `smoke:browser`. The requester ran them at `4337eb6`
and the orchestrator re-ran them on a clean tree with `apps/web/.next` removed: `verify` exit
0 (208 root, 268 runner, 709 vitest, 97 node, 0 token violations, RTL 308), `smoke` 12/12,
`smoke:browser` exit 0 with its falsification firing and **its NOTE printing 66 backend
absences**. That NOTE is the reason none of this is evidence about a running backend, and I
am citing it rather than the bare exit code.

## Follow-ups — none of these block, all of them have an owner

1. **`ADR-038` cites a migration file that does not exist.** `comms/decisions/ADR-038-data-egress.md:5`
   and `:118` say `0007_projects.sql`, and `:24` says `0007`. The constraint is in
   **`0005_project_axis.sql:75`**; `0007` is `0007_identity.sql` and no `0007_projects.sql`
   has ever existed. **24 other citations across 20 files in `comms/`** say
   `0005_project_axis.sql`, so this is newly introduced and contradicts the record. The handoff's *Contracts touched*
   repeats it. **Not blocking** — the same sentences quote the constraint's unique name
   verbatim, so a reader recovers the right line by grep from the wrong token in the same
   breath. **Fix before the ADR is put in front of the human**, because that is the moment a
   wrong file reference starts costing something. Owner: `rtl-arabic-pdpl-specialist`.
2. **The sigil gate cannot see `todo()` entries.** `i18n.test.ts:78` returns `[]` for a
   `Todo`, and a `todo()` renders **English text inside the RTL paragraph** — which is
   precisely the hazard just graded. I checked all four current todos (`drawer.action.take`,
   `drawer.provenance.unknown`, `a11y.provenance.unknown`, `threads.address.default`); none
   contains a sigil, so there is no live defect. But `threads.address.default` is
   `todo('Chief of Staff')` — an addressing-family key already held in English — so the next
   `todo()` in that family is the one that reopens this. Smallest fix: include the `todo`
   string in `values` (it is a string like any other), one line. Owner:
   `rtl-arabic-pdpl-specialist`.
3. **`.u-auto` is the same class of claim the catalogue comment just made.**
   `apps/web/src/styles/rtl.css:238` — `.u-auto { direction: inherit; unicode-bidi: isolate; }`
   is defined once and **used nowhere** (grep across `apps/web/src`). Its name asserts
   `dir="auto"` semantics; `auto` is `unicode-bidi: plaintext`, which resolves per run from
   the first strong character. `inherit` + `isolate` does the opposite — it pins the parent's
   direction and isolates. Nothing is broken today because nothing consumes it; the cost
   arrives the day someone reaches for the CSS twin of the `dir="auto"` they just added to
   `ThreadView`. Smallest fix: delete it, or make it `plaintext` and name a consumer. Owner:
   `rtl-arabic-pdpl-specialist` (rtl.css:4).
4. **Mine, not theirs:** fold *"a falsification run states its baseline, green, before it
   states its plant"* into `cc-fidelity-check`, alongside the three fold-ins already queued.

## Deliberately not done

- **I did not re-grade the `AddressComposer` keyboard work.** It was graded at `0351add` on
  the `sessions-relay-engineer` message and credited to this author there. Grading it twice
  would inflate this verdict and would let a second look quietly overturn a first without
  saying so.
- **I did not independently review the Arabic register as a native reader**, because I am not
  one and neither is the author. What I graded is internal consistency against this
  catalogue's declared rules, its own header, and its English counterparts — every claim in
  item 5 is checkable from a file. The register remains the declared blind spot.
- **I did not re-run the browser or route gates.** They were run twice on a still tree by two
  other parties and the tree has not moved except for a BOARD line. Re-running them would
  produce a third number and no new information.
- **No plant of my own.** Falsification requires editing `apps/**`, which I do not do; the
  author's seven plants are each named, each verified present on disk before its run, and two
  of them are reported as harness failures rather than successes.
- **`comms/verdicts/` still does not exist.** Four verdicts now cite the path. Creating it is
  a one-line decision somebody should make, and it is not mine to make silently.

## Next agent

`commandcenter-orchestrator` — **M16 flips on this verdict.** Read *What this PASS covers* and
carry its four negations onto BOARD verbatim; a milestone row that reads "done" without them
is the column landing that reads as the feature working.

Then `rtl-arabic-pdpl-specialist` for follow-ups 1–3. **ADR-038 still needs the human, and it
is still the only thing here that does.**
