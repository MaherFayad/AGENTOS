---
agent: fidelity-qa-reviewer
milestone: M16
spec: Part VI (the acceptance bar) · §1.3 · `Plan §12` · `Plan §23.5` · `Plan §23.8` · Part VII.3
created: 2026-08-18T21:50
status: verdict
---

# M16 — the acceptance pass. Five PASS, two FAIL, and **M16 does not flip.**

Filed as a handoff because **`comms/verdicts/` does not exist and I have not created it.**
Two older messages still cite that path.

## The verdict

| Slice | Author | Verdict |
|---|---|---|
| THREADS view + addressing composer + ADR-037 | `sessions-relay-engineer` | **FAIL — 2 items** |
| Erasure tiers, ADR-036, withheld-literal register | `observability-engineer` | **FAIL — 1 item** |
| Mailbox composer (drawer) | `drawer-engineer` | **PASS** |
| THREADS in the tab slot | `shell-navigation-engineer` | **PASS** |
| ADR-028 + `thread-feed` | `dashboards-engineer` | **PASS** |
| Two monochrome registers, items 1 & 2 re-gated | `design-system-guardian` | **PASS** |
| `in_reply_to` project-pinning | `thread-model-engineer` | **my FAIL item closed** |

Each verdict is the `## Answer` on the author's own message, archived under
`comms/inbox/_archive/fidelity-qa-reviewer/`. **Three real failures, and I did not pad to
twelve** — everything else I found is a follow-up and is labelled as one.

## Which standard each verdict used, because it moved twice tonight

Every verdict names its own. Across the seven:

1. **Source and tokens** — all seven.
2. **A real page load** — the five user-visible slices. `npm run smoke:browser` PASS, 12
   routes in Chrome, no uncaught exceptions, no `console.error`. The two document/schema
   slices (`observability-engineer`, `thread-model-engineer`) were graded on source only
   and say so: a screenshot of a migration that has never been applied grades nothing.
3. **The 1440px side-by-side — still never run, on this or any milestone.** It needs the
   reference frames, which are with the user. **No PASS above implies it.** Nothing in this
   pass is a judgement of proportion, tracking or density against a reference frame,
   because I have none.

### The green, and exactly what it is worth

Observed on a **still tree at `db19006`**, **2026-08-18 21:35–21:44 +03:00**, after
`rm -rf apps/web/.next` — the stale-cache `PageNotFoundError` has now faked a red for two
different agents on `/p/[project]/sessions/[id]`, a route neither of them touched.

```
Token discipline
  scanned at        2026-08-18 21:36 +03:00 · db19006 · clean
  files scanned     336
  violations        0
  exemptions        5
```

`npm run verify` exit 0 · `typecheck:tests` exit 0 · `validate:rtl:gate` **holding** at 308
· `validate:comms` clean · `smoke:browser` **PASS**.

**And the NOTE the gate now prints, which is the most important line in this file:**

> *the backend was absent for essentially this whole run (66 absences across 12 routes).
> This pass means the client renders and throws nothing WITHOUT a backend. It is not
> evidence that anything works WITH one.*

That NOTE is doing real work and it should not be softened. For M16 specifically the gap is
near-total: `drawer-engineer`'s composer is inert because `threadId` is `null` on every
render, the agent-thread group makes no request at all, and `ThreadFeed` has never rendered
a row. **I passed three surfaces that have never been exercised in their working state.**
Every one of those PASSes is structural, per BRIEF's distinction, and none of them is
evidence the feature works.

**The tree stopped being still at 21:44**, mid-verdict: `rtl-arabic-pdpl-specialist` began
editing `AddressComposer.tsx`, `ThreadView.tsx`, `strings.ar.ts` and `direction.ts`. All
findings below are against `db19006`. Where an in-flight fix exists I say so and I have not
graded it.

## The two FAILs, in one line each

1. **`ThreadView.tsx:125`** — *"still in the mailbox"* is rendered in `.sep`, which is
   `--ink-3`. design-tokens §9.3's NEVER column: *"any sentence; any caveat… anything with
   no second copy on screen"*, and *"fails AA on every surface, in both themes"*. The only
   thing on the row that says a turn has not been read, one step dimmer than the author
   name beside it. Fix: delete `className={s.sep}`; the parent is already `--ink-2`. **Live
   in the working tree at 21:45.**
2. **`AddressComposer.tsx:262-310`** — a `role="radiogroup"` of three buttons with no
   arrow-key handling and no roving `tabIndex`, while three comments and a test justify the
   `aria-disabled` choice by what arrow keys do. The conclusion is right; the mechanism
   protecting it does not exist. *A comment is not a mechanism.* The sibling composer names
   this exact trap (`MailboxComposer.tsx:143-147`) and avoids it with native radios.
   **An uncommitted, ungated fix appeared at 21:44** — two reviewers reaching one defect
   from two directions in one hour.
3. **`comms/specs/observability.md:409` and `:451-453`** — *"v1 ships tier 1"* and *"the
   only erasure unit this architecture **can actually execute**… **That terminates**"*,
   twelve lines below the same page's own table reading **"Executable today? no"**.
   ADR-036 keeps the distinction; the spec lost it in the mood of a verb. Three words each.

## What I got wrong, or could not do

- **A verdict I granted earlier cited `@ts-expect-error` directives that were inert.**
  `typecheck:tests` is wired into `verify` as of tonight and I re-ran it myself (exit 0,
  21:37). `sessions-relay-engineer` falsified one by deleting the directive and got
  `TS2322`. **That category is live now.** This is the first round where those assertions
  actually hold, and I have said so in the verdict that depends on one.
- **I did not re-run anyone's falsification plants.** I graded the *method* — did the
  author verify the plant was on disk before believing the red — and named that as what I
  checked, rather than implying a re-falsification I did not do.
- **`apps/web/src/drawer/` and `apps/web/src/sessions/` were not scanned by `check-tokens`
  rule 1.** The two PROVISIONAL deny-list entries have expired — both owners wrote their
  `token-exempt:` comments — and nobody deleted the entries. I read the drawer composer's
  CSS by hand instead. Being the instrument myself is the thing the deny-list inversion
  existed to stop.

## Deliberately not done

- **No 1440px comparison.** Third milestone running. It is the only half of the Part VI bar
  that has never been executed, it needs reference frames from the user, and I would rather
  say so on every verdict than let a PASS carry it silently.
- **No verdict on the Arabic wording.** Forty-seven new keys across two slices, written by
  two non-specialists to stay under `i18n.test.ts`'s untranslated ceiling of five. I graded
  the **mechanism** — both catalogues complete, ratchet holding at 308, plural sets using
  all six CLDR classes where Arabic needs them — and flagged the wording as
  `rtl-arabic-pdpl-specialist`'s. They were overwriting `strings.ar.ts` as I filed this.
  Two terms of art are theirs to confirm: `الإرسال الجماعي` (fan-out), `عملية تشغيل` (a run).
- **No re-gate of the in-flight `InterruptLevels` fix.** Uncommitted and ungated at 21:44.
  Grading a working tree that is being written to is how the last three reports were
  invalidated.
- **No fix, anywhere.** `Write`/`Edit` are scoped to `comms/`. Every finding above is a
  file, a line and a smallest fix, handed back to its owner.
- **I did not touch `comms/inbox/_all/`.** The clock-emoji broadcast is not mine to archive.

## What blocks the flip, and what does not

**M16 does not flip.** Three items, all small, all pointable. Two are one-line edits and
one is three words.

**Not blocking, and worth a ticket each:**

- `scripts/check-tokens.mjs:120-121` — the expired PROVISIONAL entries. Ruling filed to
  `design-system-guardian`: a provisional entry needs a **gate, not a date**. An entry whose
  directory has zero flaggable unexempted lines should fail the run and say *"this entry has
  expired"*. Right now nothing observes the difference between a load-bearing entry and a
  stale one.
- `message-body-never-traced.test.ts:275-278` and `:302-306` — both known-gap assertions now
  state a reason that stopped being true (a type change that `withhold.ts` argues cannot
  exist, and a decision-request that is answered). `rtl-arabic-pdpl-specialist`'s file. This
  is my carried finding *"the a11y catalogue is where stale reasons go to be read aloud"* in
  its third costume this week, and the third one is not in the a11y catalogue at all — the
  pattern is **stale reasons in any string a human reads**, not in one directory.
- `AddressComposer.tsx:277-280` — claims a derivation the file does not have; fail-closed,
  so not a block, but the handoff's *"the refusal comes from the type"* is true of
  `drawer/threads/mailbox.ts` and not of this file.
- `sessions/[id]/page.tsx:9` — *"§9.1 open"*. ADR-037 answered it `no`.
- `role="alertdialog"` on the fan-out confirm implies a modality the panel correctly does
  not have.

## Three findings this pass produced, for BRIEF

1. **A falsification needs its own falsification.** Third instance in seven days, three
   different agents: substitutions that never applied (`\n` vs CRLF), an `npx tsc` stub in a
   worktree with no `node_modules`, and one avoided only by using exact-string replacement.
   A plant that silently fails to apply is **indistinguishable from a gate catching it**.
   Verify the plant is on disk before believing the red.
2. **A provisional blind spot with no expiry becomes a permanent one.** The deny-list
   inversion was the right fix for the include-list; two dated entries then survived the
   condition that justified them, and the directory M16's composer landed in went unscanned
   on the night it landed. A date is not an enforcer.
3. **Stale reasons outlive the conditions they describe, in every kind of string.** Three
   this week: two a11y catalogue entries and two test assertion messages. The rule is not
   "sweep `a11y.*`" — it is that **any sentence explaining *why* is a claim with an expiry
   date**, and the ones read aloud or printed on a red build are the ones that mislead
   hardest.

## Next agent

- **`sessions-relay-engineer`** — 2 items. Re-file on a still tree; I re-gate item 2 only,
  since item 1 is a one-line deletion.
- **`observability-engineer`** — 3 words in 2 sentences. Everything else holds, including
  the one you were most worried about: your register does **not** quietly green
  `rtl-arabic-pdpl-specialist`'s known-gap assertions. Confirmed independently.
- **`design-system-guardian`** — delete `check-tokens.mjs:120-121`, and consider the
  expiry gate.
- **`rtl-arabic-pdpl-specialist`** — the two stale assertion messages, and the forty-seven
  Arabic keys two other agents wrote for you.
- **`commandcenter-orchestrator`** — M16 stays open on three items. Not a re-plan; a
  re-file. And the user still owes the Part VI reference frames, which is now the only
  remaining half of the acceptance bar.
