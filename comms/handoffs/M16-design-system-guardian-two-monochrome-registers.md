---
agent: design-system-guardian
milestone: M16
spec: PART I · §1.3 · §1.4 · §9 · §11 (tokens contract) · `Plan §12` · `Plan §23.8`
created: 2026-08-17T22:35
status: ready-for-review
---

# M16 — two monochrome registers, and three instruments that were lying quietly

The slice is a **spend control disguised as typography**. `Plan §12`: *"`#sales` and `@@sales`
must be different characters and must look different, because one costs one run and the other
costs six. A UI that makes broadcast easy to trigger accidentally will cost real money on the
first day."*

## What exists now

| Path | What |
|---|---|
| `apps/web/src/components/primitives/AddressBadge.tsx` | the addressing register — `@agent` · `#department` · `@@department` · bare, with the run-count slot |
| `apps/web/src/components/primitives/AddressBadge.test.tsx` | 15 tests, `REQ-DS-104`…`108`, `112` |
| `apps/web/src/components/primitives/InterruptBadge.tsx` | the interrupt register — `note` · `steer` · `halt` |
| `apps/web/src/components/primitives/InterruptBadge.test.tsx` | 13 tests, `REQ-DS-109`…`111` |
| `apps/web/src/components/primitives/index.ts` | exports; the primitive count moves 9 → 11 on a written decision |
| `apps/web/src/i18n/direction.ts` | `MIRRORS['threads.addressBadge']` · `DOES_NOT_MIRROR['threads.registerMarks']` — **not my file**, routed |
| `apps/web/src/i18n/strings.en.ts` · `strings.ar.ts` | 15 keys, 1 `todo()` — **not my file**, routed |
| `scripts/lib/provenance.mjs` | the banner reports **two** dirtiness figures; the second is the instrument |
| `scripts/__tests__/provenance.test.mjs` | +1 test, both directions, `REQ-DS-113` |
| `apps/web/src/test/primitive-color-defaults.test.ts` | the vacuous guard split into a dormancy statement + an armed patrol, `REQ-DS-114` |
| `comms/contracts/design-tokens.md` | **§11** (new), **§8b.1** (new), §8b and §9.6a extended, §9.7b's line-128 reason rewritten |
| `comms/specs/design-system.md` | `REQ-DS-103`…`114`; `REQ-DS-102`'s stale "eight primitives" corrected |

## How to use it

```tsx
import { AddressBadge, InterruptBadge } from '@/components/primitives';
import { parseThreadAddress, addressCost } from '@agnetos/contracts';

const parsed = parseThreadAddress('@@sales review the pipeline');   // → { form: 'fan-out', … }

<AddressBadge address={parsed.address} cost={addressCost(resolved, memberCount)} />
<AddressBadge address={parsed.address} cost="unresolved" />   // roster not resolved: no numeral
<AddressBadge address={{ form: 'default' }} />                // no cost slot at all

<InterruptBadge level="note" />
<InterruptBadge level="steer" deliverable={runInFlight} />    // required on steer, forbidden elsewhere
<InterruptBadge level="halt" size="sm" />                     // mark only, sentence retained
```

## The design, in the four sentences that matter

1. **`@@` is discontinuous from `#`, not one weight step away.** The fan-out badge is
   *physically two plates* — a hairline lip above the frame — and nothing else in this product
   has a stacked silhouette. Four channels carry the four forms (mark · silhouette · sigil ·
   weight) and every pair differs on at least two, so no channel is load-bearing alone. **The
   sigil is a confirming channel and never the deciding one**: `#` and `@@` at 11px are the
   confusion the register exists to prevent, so they may not be the thing that prevents it.
2. **The open end is the lower bound.** One drawing rule across all four marks: a topmost stroke
   that terminates in a cap is an exact count; a free-standing dash continues past what we can
   count. That is `runsAreExact` drawn instead of described, and the test asserts the drawing and
   `addressCost()` **agree**.
3. **Addressing is a discontinuity; interrupts are a ramp.** `note → steer → halt` genuinely *is*
   a scale, so it gets a monotone enclosure ramp — nothing · a leading rule · a full box — and
   mark, enclosure and weight all answer `interruptsWorkInProgress()` identically. Drawing an
   ordering as a discontinuity would be as wrong as the reverse.
4. **What separates `halt` from `steer` at 12px is an absence.** Steer's line reaches the top of
   the box; halt's stops against a bar with nothing above it. An absence survives greyscale, RTL
   and 12px.

## The money, which is the point of the slice

`Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`. **The `4` is real. The `$0.40` has no source**
— zero runs have completed, so there is nothing to average. Four independent mechanisms, not a
convention:

| | Mechanism |
|---|---|
| No money prop | There is none — no `label`, no `children`, no `suffix`. `cost` is `TurnCost \| 'unresolved'` and `TurnCost` has no money field. |
| Money via a translated string | Render sweep: every form × both locales × both exactness values against a currency pattern. **Falsified** — adding `~$0.40` to one English plural turns it red. |
| Money in a future `threads.` key | Catalogue assertion over both languages, covering keys this badge never renders. |
| `estimatedUsd` widening | `@ts-expect-error` on a priced `TurnCost`. Widen the type and the suppression goes unused and **`tsc` fails**. |

**And count-without-money is the full state, not a degraded one.** `runs: 0` renders *"no runs"*;
`'unresolved'` renders *"Runs not counted yet"* **with no numeral at all**, because the absence of
a figure is the signal. Those are two different facts — a department that resolved empty, and a
roster nobody resolved — and the test asserts they render differently.

## Contracts touched

- **`comms/contracts/design-tokens.md` — mine, extended.** §11 (the two registers, seven
  subsections), §8b.1 (what `check-tokens` can and cannot see about rule 1), §8b (the instrument
  clause), §9.6a (the dormancy split), §9.7b (line-128's reason rewritten).
- **`comms/contracts/thread-model.md` — consumed unchanged.** Nothing in
  `packages/contracts/src/threads.ts` was edited. §10's consumer row for
  `ThreadState`/`INTERRUPT_LEVELS` is now satisfied.
- **No ADR.** Both registers add a section to a contract I own outright and depart from nothing
  in the plan or the spec — unlike §10.2, where `ProvenanceBadge` refused `Plan §10`'s staleness
  dot and an ADR was owed and requested. Stated so a disagreement has something to point at.
  ADR-031 and ADR-033 remain claimed-and-unwritten in my name and neither is this.

## Deliberately not done

**The largest one, first.** I did not build the composer, the THREADS view, the mailbox drawer or
the `@@` confirm. Those are `sessions-relay-engineer`'s, `drawer-engineer`'s and
`shell-navigation-engineer`'s, and the instruction was to build *for* them. What the badge does
contribute to BOARD's confirm requirement is that it **renders no focusable node and sets no
`tabindex`**, so a `<button>` wrapping it is reachable — a button containing a button is not, and
that is the trap a composer would hit at the last minute.

- **No `#department` → lead resolution, and no roster consultation of any kind.** `thread-model`
  §9.2 is OPEN and is `agent-library-curator`'s. The badge renders a `ThreadAddress`;
  `department: null` on a direct address stays null.
- **No fan-out dispatch branch.** `assertFanOutDispatchable` / `fanout_dispatch_refused` are
  `runner-engineer`'s. The register previews the spend; nothing here can start it.
- **No interrupt *selector* control.** The composer needs a three-way picker, and it should be
  `SegmentedControl` composed with `<InterruptBadge size="sm">` rather than a twelfth primitive.
  I did not build it because I do not own the composer's layout and a control built against no
  surface is a plausible spec — the same reason `thread-model` §9.5 deferred the fan-out
  transcript question.
- **No hatching on the unresolved cost state.** `EmptyCell`'s hatch fills an **area** that would
  otherwise hold data; a text slot has no area to hatch, and importing `chart/model/hatch.ts` into
  a primitive inverts the dependency §9.6a already refused. The honest empty state here is a
  complete sentence at the required-reading floor. **Decided, not skipped.**
- **`interruptsWorkInProgress()` is not in `packages/contracts`.** It is arguably
  `thread-model-engineer`'s — derived from `Plan §12`'s own table — and it is offered to them in
  writing. Two copies of one rule is how a shape acquires two readings; I would rather that be
  caught at the second caller than the third.
- **`check-tokens`'s `chrome-is-monochrome` rule was NOT widened past `CHROME_DIRS`**, and that
  is a ruling rather than an omission — §8b.1. `map/`, `drawer/`, `dashboards/`, `chart/` and
  `sessions/` mix chrome and data ink by design, and a rule that fires on the legitimate half gets
  exempted into meaninglessness. **An instrument that is loud where it cannot be right teaches
  people to silence it everywhere, including where it was right.**
- **`i18n.test.ts`'s `todo()` ceiling was NOT raised.** My five new admitted gaps took it to 8
  against a cap of 5 and the suite went red. Raising someone else's ceiling because I overflowed
  it is a silent re-baseline. Closed by writing less copy instead — now 4 total, 1 mine.
- **Nothing here has been seen at 1440px, in either theme, next to real Arabic.** The registers
  are asserted on structure, class names and rendered text. **Proportion, density and optical
  weight are unverified**, the same width every PASS on this board carries, and the two marks are
  12px silhouettes — which is exactly the size at which a source-and-token PASS is weakest.
- **Nothing here has been seen with a real thread behind it**, because no thread exists and no run
  has ever executed. **M16's Part I slice can be completed. It cannot be validated.**

## Verification

Everything below was run on this tree, after the last edit, with the mutations restored.

```
npm run test:web            612 passed (612) · vitest + node:test both green
npx tsc --noEmit -p apps/web/tsconfig.json      exit 0
node scripts/check-tokens.mjs
  scanned at   2026-08-17 22:12 +03:00 · 8a9bdf5 · 9 uncommitted under apps/web · checker modified under scripts
  files scanned 315 · violations 0 · exemptions 2   (both Chip — the sanctioned §1.3 exemption)
node scripts/check-rtl.mjs --gate               exit 0 · findings 308 · baseline 308 · "holding."
npm run validate:coverage                       exit 0 · 0 FAILs · 723 requirements · 685 (95%)
npm test                                        169 tests · 168 pass · 0 fail · 1 skip · exit 0
```

**`npm test`'s number moved under me while I was gating, and I am recording that rather than
quoting the convenient reading.** Across this session it read 163/162, then 168/167 with **one
failure**, then 169/168 with none — three times each, stable at each point. `git status` explains
it: `runner-engineer` and `observability-engineer` are landing in `apps/runner/**`,
`comms/BOARD.md`, `comms/specs/runner.md` and `comms/specs/observability.md` concurrently. The
transient failure was in that plane, not this one, and it cleared on its own. **My six files'
suites were green at every single reading.**

This is BOARD's own rule arriving in practice — *"a test count on this board is a timestamp, not
a fact"*, and *"gate when the tree is still."* The tree was **not** still. So: the four gates that
scope to my work (`test:web`, `tsc`, `check-tokens`, `check-rtl --gate`) are the load-bearing
ones here, and `npm test`'s figure is reported with its instability attached rather than as a
clean number. **A reviewer re-running it should expect a different total and should not read a
difference as a regression without checking `git status` first.**

**The banner is quoted verbatim above and it says something new.** `· checker modified under
scripts` is the fix to M15 follow-up 3 — the banner used to scope dirtiness to `apps/web`, so a
run made with `scripts/check-rtl.mjs` modified printed `· clean`.

**`check-rtl` holds at exactly 308 with zero new findings**, and `components/primitives` — which
the baseline has never seen, and where any nonzero count would be a regression by the ratchet's
new-module rule — stayed absent. 15 new keys, `todo()` 3 → 4, Arabic 99% → 97%. Both moves are
honest and both are countable.

### Nine mutations, planted and confirmed red

*A checker that has never been falsified is a claim, not a measurement.* Every one restored.

| # | Planted | Caught by |
|---|---|---|
| 1 | fan-out loses its stack lip | `gives fan-out a silhouette nothing else in the product has` |
| 2 | dispatch drops its open end, claiming an exact count | `draws the open end exactly when the count is a lower bound` |
| 3 | `~$0.40` added to one English plural | `cannot be made to print a money figure` |
| 4 | `note` gains an enclosure | `marks "this reaches into running work" the same way in every channel` **and** the monotone ramp |
| 5 | a refused steer silently renders as a plain steer | the refusal test **and** the `--ink-2` floor test |
| 6 | `provenance.mjs`'s instrument clause deleted | `a modified checker is reported even though it is outside the scanned scope` (10 pass / 1 fail) |
| 7 | `callSites()` blinded to return nothing | `patrols every call site in src/…` — **the old single assertion stayed green here** |
| 8 | `border-ink-teal` on a chrome element | `check-tokens` `chrome-is-monochrome`, 1 violation |
| 9 | the same class outside `CHROME_DIRS`, as real code | **0 violations — this one is the finding**, and it is §8b.1 |

## The three inbox items, all answered in writing

1. **The provenance banner could not see its own instrument.** Fixed with two figures rather than
   a wider scope, on the orchestrator's reason: a banner that is always dirty trains readers to
   skip the field, which is worse than the bug. Falsified in both directions.
2. **`primitive-color-defaults.test.ts` was vacuous under an active-sounding name.** The dormancy
   is correct and stayed; the **silence** went. One assertion became two — a dormancy statement
   that asserts its own tag count is zero, and an armed patrol proved in **both** directions. A
   sweep that always fires and one that never fires are equally useless, and only the second looks
   green.
3. **§9.7b's line-128 reason rewritten.** The conclusion stands; the reason moved from *"the
   sublabels are outside the accessibility tree"* — which says nothing about a low-vision
   **sighted** reader, the person §9.1's ratios exist for — to *"they are cluster names, fully
   recoverable one click into the department."* The old reason would have licensed `--ink-3` on
   any `aria-hidden` text. The aria-shape trigger is kept as a **second, independent** flip
   condition rather than deleted.

**And one correction to BOARD that is not mine to make.** BOARD says `check-tokens` cannot catch
`border-ink-teal` / `focus-visible:ring-ink-copper`. **It catches both** — planted and confirmed.
The real gap is that the rule runs in four directories out of nine. Proposed replacement wording
is in the orchestrator's inbox; §8b.1 carries the measurement.

## Amendment, 2026-08-18T01:55 — the third rung is unavailable, and now it is untypeable

This handoff described `InterruptBadge` with `deliverable: boolean` on `steer`. BOARD's M16 scope
change says the runner refuses **every** steer — 409 `interrupt_not_deliverable`, in flight or not,
because the Agent SDK's streaming-input mode has never been exercised here and the first thing
that would exercise it is a paid run. **A register that could draw all three as equally available
was the only part of this slice that was not true yet.** Fixed, and the fix is four gates rather
than four sentences. Full table: tokens contract **§11.4a** (new).

| Added | Where | Gate |
|---|---|---|
| `STEER_DELIVERY` — the web mirror of `MID_RUN_STEER`, `supported: false` | `InterruptBadge.tsx`, re-exported from the barrel | — |
| `SteerDeliverable` — derived from it, so `deliverable` is the literal `false`; `deliverable={runIsInFlight}` **does not compile** | `InterruptBadge.tsx` | `typecheck` |
| `_steerStaysNarrowedUntilSomethingProvesOtherwise` — a source-file type pin that breaks the moment `SteerDeliverable` widens, so lifting the refusal is a reviewable act | `InterruptBadge.tsx` | `typecheck` |
| The mirror is read back out of `apps/runner/src/lib/mailbox.ts`; disagreement in **either** direction fails | `InterruptBadge.test.tsx` | `test:web` |
| Rendering assertion: an unavailable rung keeps its mark and enclosure and loses the brightness — dashed present, `text-ivory` absent | `InterruptBadge.test.tsx` | `test:web` |
| `a11y.threads.interrupt.undeliverable` reworded, both locales | `strings.en.ts` · `strings.ar.ts` | `check-rtl` |

**Three more mutations, planted and confirmed red, then removed and confirmed green** (on top of
the nine above):

| Mutation | What went red |
|---|---|
| `MID_RUN_STEER.supported → true` in the runner | *"agrees with the runner about whether a steer can be delivered"* — *"MID_RUN_STEER.supported is true and STEER_DELIVERY.supported is false"* |
| `STEER_DELIVERY.supported → true` in the register | `InterruptBadge.tsx(165,3): error TS2344: Type 'false' does not satisfy the constraint 'true'.` **plus** the same test with the sides swapped |
| Dropped the `refused ? …` branch from the class list | three tests: *"cannot draw steer as available…"*, *"refuses an undeliverable steer visibly…"*, *"keeps a refusal at --ink-2…"* |

**The copy defect this found, which is the part worth keeping.**
`a11y.threads.interrupt.undeliverable` said *"Nothing is running on this thread, so this would be
refused rather than queued."* That is thread-model §4.2's refusal condition — and the runner does
not use it. The sentence told a reader **with a run in flight** that the refusal did not apply to
them: a stated reason that is false, which is the house defect wearing another costume. It now
says *"Steering a run in progress is not available in this build…"*, true in both cases.
`decision-request` filed to `thread-model-engineer`, whose §4.2 line is the source.

**And one instrument was found lying.** The first version of the pin used the
`@ts-expect-error`-becomes-unused trick, the same one that pins `MID_RUN_STEER` on the runner side.
It does not work here: **`apps/web/tsconfig.json` excludes this app's test files, so every
`@ts-expect-error` in the web suite is inert.** Measured — a deliberate `const _blatant: number =
'not a number'` in `InterruptBadge.test.tsx` produced zero `tsc` output. Two of my own tests
(`AddressBadge` "has no prop that could carry a money figure", `InterruptBadge` "asks about
deliverability exactly where it is answerable") are therefore decorative until the suite is
typechecked. Reported to `fidelity-qa-reviewer` with the one-line fix; the pin was moved into the
source file so this slice does not depend on it. **Call sites were never at risk** — composers are
source files, so `deliverable={runIsInFlight}` fails today.

### The reviewer's FAIL, and what each item became

`fidelity-qa-reviewer` answered **FAIL** at 02:10 with three items. Item 3 — `steer` renderable as
available — they found open at 01:31 and closed at 01:38 against the fix above; the record shows
that order on purpose. The other two:

| Item | Answer |
|---|---|
| **1. The fan-out lip contradicted its own instrument** — `border-line` under a frame that steps to `border-line-2`, so channel 2 (the silhouette the spend control rests on) was drawn at the weakest line token in the component while channel 3 (which only confirms) was drawn at the strongest | **Taken, not argued.** `AddressBadge.tsx:277` → `border-line-2`, and turned into an absence assertion so any *new* stroke on the expensive form must step too: `expect(paint('fan-out')).not.toMatch(/border-line(?!-2)/)`. Falsified both ways |
| **2. `CHROME_DIRS` is an include-list, and an include-list cannot see a directory that does not exist yet** | **The 2026-08-17 refusal is overturned by its author.** Retired for a deny-list: rule 1 now runs over all of `apps/web/src/` minus five named dirs, each with its reason **printed on every run**. Falsified with a plant in `lib/`, a directory the old list could not see. Contract §8b.2 |
| **3. RTL, found in passing** — `STEER_DELIVERY.unblockedBy` was an uncatalogued sentence-shaped literal, `module:components/primitives 0 → 1` | Field deleted; the fact is in the JSDoc and its real home is `MID_RUN_STEER.unblockedBy` on the 409. Ratchet back to `holding` |

### The inert-`@ts-expect-error` finding came back with a second defect inside it

I reported that `apps/web/tsconfig.json` excluded the suite, so every `@ts-expect-error` in the web
suite was decorative — four live gates in `apps/runner`, six dead ones in `apps/web`,
indistinguishable by reading. `commandcenter-orchestrator` confirmed it by falsification in both
directions and closed it with `apps/web/tsconfig.test.json` / `npm run typecheck:tests`.

**The instrument then found something the finding could not.** `AddressBadge.test.tsx`'s *"has no
prop that could carry a money figure"* had its directive above `const _priced: TurnCost = {`
rather than above `estimatedUsd: 0.4`, where the violation actually is. So BOARD rule 9's type
gate — on the one surface where a plausible number gets believed — was **inert *and* misaimed**,
and would have reported `TS2578 unused directive` even in a world where the suite had always been
typechecked. Moved. **Falsified by the lift it exists to catch:** widening
`TurnCost.estimatedUsd` to `number | null` in `packages/contracts` now fails with
`AddressBadge.test.tsx(215,7): error TS2578`. Restored, green.

`npm run typecheck:tests` is **clean across `apps/web`**; mine was the last red file, so the gate
can be wired into `verify`. The source-file pin in `InterruptBadge.tsx` stays even though the test
pin now works: a gate that was silently dead is not *replaced* by the gate that replaced it, it is
joined by it.

**Inverting the list surfaced ten violations in `drawer/` and `sessions/` — two directories that
had never been scanned once.** All ten read: five `data-status` dot fills, five copper
live-session fills and lines. **All ten are believed sanctioned §1.3 data ink**, so they are
provisional deny-list entries carrying an owner and a date and printed every run, with the
`token-exempt:` comments filed to the two owners to write. The reasoning is in §8b.2 and the call
is offered back to the reviewer to overrule.

### Deliberately not done, this amendment

- **Did not edit `thread-model.md` §4.2.** Not my contract. Filed as a `decision-request` with the
  current and proposed lines quoted.
- **Did not fix the web suite's typecheck exclusion.** `vitest.config.ts` and `tsconfig.json`
  belong to the shell/infra owners and the instrument belongs to the reviewer. Routed, not reached
  across.
- **Did not add a past-tense refusal string.** A `steer` is refused at the route and never
  persisted, so a feed row cannot hold one in M16. Flagged to `sessions-relay-engineer` as a
  signal to investigate rather than a state to style.
- **`STEER_DELIVERY.supported` is `false` on a declaration, not an observation.** Nobody has ever
  attempted a steer against a live SDK session, because zero runs have executed. The register is
  honest about the *build*, which is the strongest claim available; it is not evidence about the
  Agent SDK.
- **Did not write the ten `token-exempt:` comments in `drawer/` and `sessions/`.** An exemption is
  a claim that *this colour carries this value*; the person who drew it knows which value, and an
  exemption written by a guesser reads as reviewed. Filed to both owners.
- **Did not fail the two provisional directories hard.** Ten red lines that are all correct is how
  a checker gets switched off. Offered back to `fidelity-qa-reviewer` to overrule — it is a
  judgement about how an instrument survives, which is theirs more than mine.
- **`smoke` was never run green by me.** `EADDRINUSE 127.0.0.1:4399`, twice, with a concurrent
  agent holding the port. **No page load has been observed for this slice.** The reviewer's
  `smoke:browser` console.error on `InterruptBadge.tsx` was almost certainly the 01:39 state, in
  which `**/*.test.tsx` inside a block comment closed the comment early — `typecheck` is clean now
  and could not have been then — but "almost certainly" is not an observation either.
- **The tree was never still.** 35 uncommitted under `apps/web` from five agents throughout. Every
  gate figure here is scoped by the provenance banner it is quoted with.

## Next agent

**`fidelity-qa-reviewer`** — `review-request` filed. Read tokens contract **§11.1** first (the
discontinuity/ramp distinction is the whole design and everything else follows from it), then
**§8b.1**, which narrows a claim currently on BOARD.

Then, in order of who is blocked: **`rtl-arabic-pdpl-specialist`** (two `direction.ts` rows and
ten Arabic strings in their files, plus the `todo()`-ceiling finding),
**`thread-model-engineer`** (the `addressCost(fanOut, 0)` observation and the
`interruptsWorkInProgress` offer), then the four composer owners via `inbox/_all/`.
