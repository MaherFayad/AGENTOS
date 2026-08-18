---
agent: rtl-arabic-pdpl-specialist
milestone: M16
spec: §1.4 · §2.0 · Part VII.4 · `Plan §12` · `Plan §23.8` · `Plan §23.11` rule 6
created: 2026-08-18T22:20
status: ready-for-review
---

# M16 — the §23.11 rule-6 pass over the threads surfaces, and ADR-038

The pass was deferred on purpose while four agents were in these files. They finished; this
is the pass. Two Arabic authors had routed copy to me for review, one defect was measured in
a real browser rather than argued about, and the interrupt radio group turned out to be the
fourth site of a bug class that shipped twice in M15.

## What exists now

**Arabic — `apps/web/src/i18n/strings.ar.ts`**

- `threads.compose.placeholder` is bidi-isolated (`⁨ … ⁩`, the escape form, the
  same pair `format.ts`'s `isolate()` uses). **This was a measured defect, not a review
  opinion** — see *Verification*.
- Four of `drawer-engineer`'s seventeen mailbox strings rewritten: `levelLabel`
  (وصول reads as *access*), `emptyBody` (register), `noThread` (بثّ is the broadcast this
  file already rejects by name for fan-out), `appendState.failed` (تعطّل is a cause, the
  badge says فاشلة). The two `disposition` lines are untouched — the distinction they draw
  is the load-bearing one and it is drawn correctly.
- `threads.one.inMailbox` صندوق الوارد → صندوق البريد. One mailbox, one name; it was the
  only string of the four calling it an inbox.
- `threads.compose.levelLabel` is nominal now, matching its mailbox sibling.

**Keyboard / RTL — `apps/web/src/threads/AddressComposer.tsx`**

- `InterruptLevels` is a `role="radiogroup"` of buttons that **had no key handling at all**,
  while its own comment argued from what arrow keys do to a `disabled` radio. Now
  `inlineStep` + `elementDirection` + a roving `tabIndex`. Arrows land **on** the refused
  `steer` and do not select it, which is what `aria-disabled` was there for.
- The parser's refused token is `<bdi>`, same reason `AddressBadge` uses one — and a stronger
  case, because it is whatever the person typed.

**`apps/web/src/threads/ThreadView.tsx`** — `dir="auto"` on the message body (the one element
in this app whose direction belongs to its content), `<bdi>` on the author slug.
`i18n/direction.ts`'s *"no surface in this app sets it"* is corrected rather than left stale.

**`scripts/check-rtl.mjs`** — `JSX_ARROW`: `=> Promise<T>` is no longer read as a JSX text
node. `drawer-engineer` found it and did not work around it.

**PDPL**

- `company/COMPANY.md` rule 7 gains the two readings ADR-036's tier table invites and does
  not refuse: **an author is not a data subject**, and **a backup is a fourth store no
  `DELETE` reaches**. Rule 10 now cites ADR-038.
- `comms/decisions/ADR-038-data-egress.md` — **`proposed`**. Three targets: `deliver:` and
  `library_remote` are ruled on; the model endpoint is filed as the human's question.
- `apps/runner/src/observability/__tests__/message-body-never-traced.test.ts` — the known-gap
  assertion's stated remedy was **wrong** (it said "a type change") and is corrected; two new
  known-gap tests for `withhold.ts`'s eviction and floor.

## How to use it

Nothing to wire. The one thing a caller must know: **`InterruptLevels` is now a roving
tabindex group.** A second radiogroup of buttons anywhere in this product owes the same
handler, and it must come from `inlineStep`, never from `+1` on `ArrowRight`.

## Contracts touched

None edited. ADR-038 proposes one edit to `contracts/agent-frontmatter.md` (`deliver:` gains
a content rule) and it is filed to `agent-library-curator` as a decision-request rather than
performed. `0007`'s `library_remote_needs_egress_adr` constraint is untouched — ADR-038 is
the document its name was waiting for.

## Deliberately not done

- **ADR-038 is `proposed`, not accepted, and I am not going to accept it.** Its open half is
  whether a data-processing agreement exists for the runner's key and what region it names.
  Both are facts to be told. Option D in that ADR — deriving a region from SDK documentation
  — is refused by name, because it would be the house defect on the highest-stakes line in
  the product.
- **The two ADR-036 corrections were written into `COMPANY.md`, not into the ADR or into
  `specs/observability.md`.** Those are `observability-engineer`'s; the diagnosis is filed to
  them. COMPANY.md is where a compliance sentence an agent says out loud actually comes from,
  so the gate lives there — but their table still reads slightly wider than its evidence and
  that is theirs to narrow.
- **`withhold.ts`'s eviction hole is recorded, not fixed.** It is their file. My tests assert
  the gap, so closing it turns my tests red, which is what a known-gap assertion is for.
- **`packages/contracts/src/threads.ts`'s English parser hints are not translated.** Filed to
  `thread-model-engineer` with three shapes ranked. `check-rtl` declares `packages/**` as an
  unscanned root with `count: null`, so nothing will ever go red on this and it needed a
  message rather than a gate.
- **`dashboards/components/Carousel.tsx` still has the M15 arrow-key defect.** Named in
  `chart/model/direction.ts` as the third caller; it is `dashboards-engineer`'s and it is not
  an M16 surface.
- **M8 proper is untouched by this dispatch** — light-theme parity, edge pulses, count-up
  numbers, mobile QA. Empty states in both languages are done *for the threads surfaces*
  (`threads.agent.unreadable` names both reasons, `threads.one.empty` is a sentence) and
  nowhere else.
- **`panels/*.json` copy is still English only** — 151 strings, the largest untranslated
  surface in the product, outside `apps/web/src` by §2.5's own design.

## Verification

Observed **2026-08-18 between 21:40 and 22:05 +03:00**, on a tree that was clean at the start
of the dispatch and had no other agent landing in it.

**The placeholder defect was measured, not derived.** Headless Chrome, `dir="rtl"`, one
`Range.getBoundingClientRect()` per character, sorted by x descending:

```
  as written now : @selas@@·selas#·tnemhcirne-tnuocca/selas—أواكتبمندونعنوان
  with LRI/PDI   : selas@@·selas#·tnemhcirne-tnuocca/selas@—أواكتبمندونعنوان
```

Read right-to-left, the first line puts a lone `@` at the far right and the Latin block to
its left — i.e. the visual line ends `… · @@sales@`. **`@sales` loses its sigil and `@@sales`
appears to gain one**, in the single field where `@` vs `#` vs `@@` is the difference between
one run and N. The second line is the same string isolated, intact. The catalogue comment
that previously said no isolation was needed also said the textarea is `dir="auto"` "by
virtue of being a textarea"; it is not, and with the root at `dir="rtl"` an empty field takes
the parent's direction.

**Gates, on a still tree:**

- `npm run verify` — green, including `typecheck:tests`, which **caught one of my own edits**
  (a `Plural → Record<string,string>` cast in `i18n.test.ts`). That gate is live and earning.
- `npm run smoke` — `12 routes 2xx and rendered · 37 client chunks · 120 barrel modules`,
  after `rm -rf apps/web/.next`.
- `npm run smoke:browser` — 12 routes, no uncaught exceptions / `console.error` / browser
  errors, **66 backend absences and the NOTE**. That proves the client renders without a
  backend and nothing more; it is not evidence about anything with one.
- `validate:rtl:gate` — **holding at 308**, unchanged. `JSX_ARROW` did not lower it, because
  the file that triggered it had already been moved.

**Falsification — every gate planted, watched red, removed, watched pass, and each plant
verified present on disk before the run:**

| Plant | Result |
|---|---|
| Strip `⁨`/`⁩` from the placeholder | `i18n.test.ts` → 1 failed / 15 passed, 3 bare sigils reported |
| `inlineStep(...)` → a fixed `+1` on ArrowRight | `AddressComposer.test.tsx` → **3 failed**, all three RTL |
| `tabIndex={level === candidate ? 0 : -1}` → `tabIndex={0}` | 1 failed |
| add `disabled={refused}` to the refused rung | 1 failed — the *pre-existing* test, correctly |
| remove the `JSX_ARROW` guard | `rtl-pdpl.test.mjs` → 1 failed |
| `literals.shift()` → `literals.pop()` in `withhold.ts` | `message-body-never-traced` → 8 pass / 1 fail, the eviction assertion |
| delete either new COMPANY.md sentence | `rtl-pdpl.test.mjs` → 32 pass / 1 fail, each time |

**Two things the falsification pass itself found, recorded because the standing finding says
a vacuous plant is the failure mode:**

1. My first falsification harness ran the runner test with `node --test` and got
   `pass=0 fail=1` at **baseline** — the runner needs `tsx`. A red baseline is a vacuous
   falsification wearing a red coat, and I would have "proved" every plant.
2. The `disabled={refused}` plant left my *"lands focus ON the refused rung"* test **green**,
   because jsdom honours `.focus()` on a disabled element where a browser does not. So that
   test proves the direction half only; the `disabled` half is proved by the pre-existing
   attribute assertion. Written into the test rather than left implied — neither test covers
   both and saying so is cheaper than a third that also cannot.

## Next agent

`fidelity-qa-reviewer` — the acceptance pass. Read the *Verification* table first; the
placeholder measurement is the one claim in this handoff that is an observation rather than a
reading, and everything else is a gate you can run.

Then `observability-engineer`
(`comms/inbox/observability-engineer/20260818-2210-…`) — two cells in the erasure table, and
`withhold.ts`'s eviction is a fail-open your blind-spot list does not name.

**ADR-038 needs the human, and it is the only thing here that does.**
