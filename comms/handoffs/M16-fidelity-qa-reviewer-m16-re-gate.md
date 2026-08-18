---
agent: fidelity-qa-reviewer
milestone: M16
spec: Part VI (the acceptance bar) · §1.3 · §9.2–§9.3 (design-tokens) · Part VII.4 · `Plan §12`
created: 2026-08-18T22:55
status: verdict
---

# M16 re-gate — **all three FAIL items cleared.** M16 still does not flip, and the reason is mine.

Filed as a handoff because **`comms/verdicts/` still does not exist and I still have not
created it.** Three verdicts now cite that path.

## The re-gate

| Item | Author | Was | Now |
|---|---|---|---|
| 1 · `ThreadView` unread fact in `--ink-3` | `sessions-relay-engineer` | FAIL | **PASS** |
| 2 · `role="radiogroup"` with no arrow keys | `rtl-arabic-pdpl-specialist` (`306039e`) | FAIL | **PASS** |
| 3 · erasure spec's present-tense verbs | `observability-engineer` | FAIL | **PASS** |
| A · the `steer` derivation, proved empirically | `sessions-relay-engineer` | follow-up | **holds** |
| B · `withhold.ts`'s bound was a fail-open | `observability-engineer` | new | **PASS** |
| C · a known-gap test deleted with a tombstone | `observability-engineer` | new | **right call** |

Each verdict is the `## Answer` on the author's own message. **I did not re-litigate the
five PASSes** and nothing below revisits them.

## The standard, per item

**Source and tokens: all six.** **A real page load: items 1, 2 and A** — the three that
touch a rendered surface. **Items 3, B and C were graded on source only and say so**; a
screenshot of a migration that has never been applied grades nothing.

**The 1440px side-by-side has still never been run, on this or any milestone.** It needs
reference frames, which are with the user. **No PASS above implies it.** Nothing in this
re-gate is a judgement of proportion, tracking or density against a reference frame.

### The green, observed by me

**Still tree at `4337eb6`** — `git status` clean, `git rev-parse HEAD` = `4337eb629c…` —
**2026-08-18 22:41–22:52 +03:00**, `apps/web/.next` removed first.
`npm run verify` **exit 0** · `typecheck:tests` **exit 0** · `validate:rtl:gate`
**holding**, baseline 308 recorded `8e77a23` · `smoke:browser` **exit 0**, 12 routes.

```
Token discipline
  scanned at        2026-08-18 22:42 +03:00 · 4337eb6 · clean
  files scanned     337
  violations        0
  exemptions        15
```

**5 exemptions became 15 because two directories are now scanned rather than skipped.**
`apps/web/src/drawer/` and `apps/web/src/sessions/` were the expired PROVISIONAL entries I
had to read by hand last night; `design-system-guardian` deleted them at `90167f4`
(*"a provisional exemption needs a gate, not a date"*). **That follow-up is closed** and I
was not the instrument this round.

**And the NOTE, printed by the gate and unchanged:** *66 backend absence(s) across 12
routes.* The runner was down for the whole run. It proves the client renders and throws
nothing **without** a backend, and nothing more. Do not let anything rest on more than that.

## What each item cost, in one line

1. **Fixed by deletion.** `ThreadView.tsx:139` is a classless `<span>` inheriting `--ink-2`
   from `.messageHead`; `:123`'s `aria-hidden` `·` keeps `.sep`, which is §9.3's own home.
2. **Fixed by the person who found it independently**, not by its owner. `inlineStep` +
   `elementDirection` + roving `tabIndex`; arrows land on the refused rung without
   selecting it; the ring is `--ivory`, monochrome.
3. **Four verbs, not the three I counted.** The fourth was in the same sentence — which is
   why a defect in the *mood* of a verb is harder to see than a misnamed mechanism.

## The three claims I was asked to grade, and what grading them was worth

**A. The `steer` proof holds, and I checked the leg it rests on rather than the report.**
`STEER_DELIVERY` is `as const` (`InterruptBadge.tsx:144-149`), so `supported` carries the
**literal** type `false`. That is the whole proof: typed `boolean`, the conditional would
resolve identically in both worlds, flipping the value would change no type, and the "after"
run could never have gone red. `AddressComposer.tsx:391` is exactly
`<InterruptBadge level={candidate} size="sm" />` and the reported column 16 is `level`.
`InterruptBadge.tsx` is byte-identical across `db19006..4337eb6`.

**The finding worth carrying: my follow-up was worse than I filed it, and only the empirical
method found the rest of it.** I named one `=== 'steer'` literal by reading. Deriving from
the constant surfaced a **second** in `onKeyDown` — the keyboard path, which had *just*
become load-bearing for reaching the refusal's stated reason, and which neither of us named.
Re-reading the file would not have found it. **When a finding is "this claims a derivation
it does not have", the fix is to make the derivation and see what stops compiling** — the
compiler enumerates the sites; a reviewer enumerates the ones they thought of.

**B. The fail-open is closed and the residual is stated at its real width.** I verified both
of its legs instead of reading them: `0008_threads.sql:288` is `body text NOT NULL` with no
length `CHECK`, and `thread-reads.ts:159-165` has no `LIMIT`. So *"unreachable by
construction"* is correctly **not** claimed. The replacement gate asserts the **property**
(register `MAX_LITERALS + 50` literals after the first body, then prove the first body is
still scrubbed) where the old one asserted the **resource** (`size() <= 32`) and called it a
bound — which is how the leak passed a gate for a day.

*On "is `withheld_refused` a producer without a consumer?"* — **no, and the true answer is
one layer further out.** `withhold` appears nowhere in `apps/runner/src` outside
`observability/` except two test doubles. `refused()` cannot be nonzero today because
`add()` is never called on a real body: the register is a **consumer without a producer**.
The question becomes live when `runner-engineer`'s drain line lands, and the consumer to
argue about then is the `false` at that call site.

**C. Deleting the test was right and the tombstone says enough.** I recovered the deleted
test from `395a828`: its closing instruction was *"If this starts failing because eviction
was replaced with a refusal to register… delete this test and say so — do not weaken it to
keep it green."* Eviction was replaced with a refusal to register. Weakening it was the
cheap wrong answer and would have kept a green suite while telling nobody. The tombstone
names what, when, whose instruction, who acted, the sender's independent agreement, the
replacement's location **and property** — and, unprompted, **why it was not rewritten in
place**: an inverted assertion would have put one agent's claim inside another's file.

## Why M16 still does not flip — and it is my queue, not anyone's code

**Every item I failed is cleared. M16 is not therefore done.** An **open, ungraded
`review-request` sits in my inbox**:

`comms/inbox/fidelity-qa-reviewer/20260818-2225-rtl-arabic-pdpl-specialist-review-request-the-rule-6-pass-over-the-m16-threads-surfaces.md`

It is `type: review-request`, `status: open`, and its `re:` is an **`M16-`** handoff. BRIEF
line 14 counts that work inside M16 by name — *"the Arabic/RTL + PDPL sweep of the new
surfaces is still owed"*. CLAUDE.md's definition of done is a handoff **plus** my PASS, "not
before". The handoff exists. The PASS does not. So the slice is not done, and a milestone
containing a slice that is not done does not flip.

**This is not a re-plan and it is not a re-file.** Nothing is blocked on any author; the
request is filed, gated, and complete. It is **one dispatch, and the dispatch is mine.** It
covers the Arabic register across forty-seven keys, the `<bdi>` / LRI-PDI bidi work, ADR-038
(`proposed`, and explicitly not to be graded as accepted), and two PDPL items. I did not
grade any of it here because this dispatch scoped me to the three FAILs, and a shallow pass
over a slice to let a milestone flip tonight is the one thing a gate must never do.

**If the orchestrator rules that the rule-6 pass is out of M16's scope, M16 flips on this
verdict and I will not argue it** — that is a scoping call and it is theirs. But it must be
made out loud, on the board, and not by my silence.

## When M16 does flip, the row must say which half the PASS covers

Exactly as M15's did. The flip means **six slices passed on source, tokens, and a client that
renders without a backend.** It does not mean:

- **Zero agent runs have ever executed.** `runnerConfigured` is false and the ledger is empty.
- **`0005`–`0008` have never met a live Postgres.** Every constraint in them is graded from a
  schema dump, and a `NOT NULL` nobody can satisfy looks identical to one that holds.
- **`ops.message` has never held a row.** The mailbox, the drain, the register and the
  composer are all structural.
- **`ops.agent_runs.thread_id` has a writer and a producer, and neither has ever run.**
  *(I was handed this as "written by nothing" and that is not what the source says:
  `db/ledger.ts:79` names the column in its `INSERT` and `lib/runService.ts:233` supplies
  `threadId: thread.row.id` into the run init. The honest statement is that the path exists
  end to end in code and has never executed once. Correcting it matters, because "no writer"
  and "an unexercised writer" fail differently and only one of them is fixed by a run.)*
- **The 1440px side-by-side.** Third milestone running. It is the only half of the Part VI
  bar that has never been executed and it needs reference frames from the user.

**Completed is not validated.** None of the above is a defect in anyone's work; all of it is
Phase 0, and Phase 0 is still open.

## Deliberately not done

- **No grading of `rtl-arabic-pdpl-specialist`'s rule-6 pass.** Out of this dispatch's scope,
  named above as the one thing between M16 and a flip, and mine to clear next.
- **No re-run of anyone's falsification plants.** I graded the *method* — baseline stated
  first, plant verified present on disk, red observed, plant removed, green observed — and I
  say that is what I checked rather than implying a re-falsification I did not do.
- **No fix, anywhere.** `Write`/`Edit` stay scoped to `comms/`. Every follow-up below is a
  file, a line and a smallest fix, handed to its owner.
- **No verdict on the Arabic wording** — still not graded by me, and now formally pending in
  the request above.
- **I did not touch `comms/inbox/_all/`.** The clock-emoji broadcast is not mine to archive.

## Follow-ups — a ticket each, none blocking

1. **`apps/web/src/threads/threads-contrast.test.ts:229` — `.toContain('aria-hidden')` is a
   substring.** `aria-hidden={false}` renders **no attribute** — the element is announced —
   and the tag text still contains the string. Fix:
   `.toMatch(/aria-hidden(?:=(?:"true"|\{true\}))?[\s/>]/)`. *(`sessions-relay-engineer`.)*
2. **Same file — the *"what this file cannot see"* list omits grouped selectors.**
   `restingInk3Classes()`'s `/^\.[A-Za-z][\w-]*$/` cannot see `.a, .b { color: var(--ink-3) }`.
   The allowlist equality catches it once; adding it there then exempts it permanently.
3. **`InterruptLevels` owes ArrowUp/ArrowDown, not Home/End.** My FAIL said
   *"Arrow/Home/End"* and that was over-broad — Home/End belong to the **tabs** pattern
   (`SegmentedControl.tsx:77-78`), not to `radiogroup`. Up/Down is the pair the role owes,
   and `inlineStep` returns `0` for them. `rtl-arabic-pdpl-specialist`'s call, not the call
   site's defect.
4. **`withhold.ts`'s header implies a pathological body always fits.** A single body over
   `MAX_WITHHELD_CHARS` is refused on an **empty** register, so the largest bodies get no
   backstop at all. One clause.
5. **The tombstone has no recovery handle.** Adding `git log -S'FAILS OPEN' -- <file>` makes
   recovering the deleted text one command instead of a search.
6. **`sessions/[id]/page.tsx:9`** still reads *"§9.1 open"*; ADR-037 answered it `no`. And
   `role="alertdialog"` on the fan-out confirm still implies a modality the panel correctly
   refuses. Both carried from last round by their owner, deliberately.

## Findings this re-gate produced

1. **When a finding is "this claims a derivation it does not have", make the derivation and
   read what stops compiling.** The compiler enumerates the sites; a reviewer enumerates the
   ones they thought of. One reading found one literal; the flip found two, and the second
   was in the path that had just become load-bearing.
2. **A bound that drops protection is not a bound.** `size() <= 32` was true, and it graded
   the resource while the protection failed open underneath it. Ask of every ceiling: *when
   this is reached, what is lost, and who is told?*
3. **A test whose own instruction says "delete me when this is fixed" is worth more than one
   that does not.** It made the right action cheap and the wrong action — inverting the
   assertion to keep the suite green — visibly wrong. Every known-gap assertion should carry
   its own closing instruction.
4. **The absence of a constraint deserves the same evidence as its presence.** *"No length
   `CHECK`, no `LIMIT`"* was checked in the schema and the query before a residual was
   written down. That is *"grade a constraint from both sides"* used in the direction nobody
   uses it.

## Next agent

- **`fidelity-qa-reviewer` (me).** The rule-6 pass. It is the only thing between M16 and a
  flip and it is mine.
- **`commandcenter-orchestrator`.** Either rule the rule-6 pass out of M16's scope out loud,
  or hold M16 open for one more dispatch. And when the row flips, it says which half the
  PASS covers — as M15's did.
- **`sessions-relay-engineer`.** Follow-ups 1, 2, 6.
- **`observability-engineer`.** Follow-ups 4, 5, and ADR-036 §3's unenforced freeze.
- **`rtl-arabic-pdpl-specialist`.** Follow-up 3, and my verdict on your request is next.
- **The user.** The Part VI reference frames are still the only remaining half of the
  acceptance bar, on every milestone we have shipped.
