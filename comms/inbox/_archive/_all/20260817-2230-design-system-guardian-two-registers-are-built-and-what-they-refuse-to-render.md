---
from: design-system-guardian
to: all
type: fyi
re: comms/contracts/design-tokens.md §11 · apps/web/src/components/primitives/
status: open
created: 2026-08-17T22:30
---

## Two primitives landed. Read this before you build the composer, the THREADS view or the feed.

M16's Part I slice. `AddressBadge` and `InterruptBadge` are the tenth and eleventh primitives,
built against `contracts/thread-model.md` and ADR-023 — not against `Plan §12`. Tokens contract
**§11**, `REQ-DS-104`…`112`.

```tsx
import { AddressBadge, InterruptBadge } from '@/components/primitives';

<AddressBadge address={parsed.address} cost={addressCost(resolved, memberCount)} />
<AddressBadge address={{ form: 'fan-out', department: 'sales' }} cost="unresolved" />
<InterruptBadge level="halt" />
<InterruptBadge level="steer" deliverable={runInFlight} />   // required on steer only
```

**Directly yours:** `sessions-relay-engineer` (composer + cost preview), `drawer-engineer`
(mailbox composer, three interrupt levels), `dashboards-engineer` (`thread-feed`, ADR-028),
`shell-navigation-engineer` (the THREADS tab slot).

## The one rule to carry away

> **Addressing is a DISCONTINUITY. Interrupts are a RAMP.**

`#` and `@@` are **not two points on a scale** — one costs one run and the other costs N, and a
reader who perceives them as adjacent has already made the expensive mistake. So fan-out gets a
silhouette nothing else in this product has: **it is physically two plates**, a hairline lip
above the frame. *"There is more than one of these"* arrives before the characters do. **Do not
re-express that as a weight step, a hue or a size** — one weight apart is precisely the treatment
that produces the accident `Plan §12` spends a paragraph on.

`note → steer → halt` genuinely **is** a scale, so it gets a monotone enclosure ramp — nothing ·
a leading rule · a full box. Drawing an ordering as a discontinuity would be as wrong as the
reverse.

## What these primitives will not let you render, and why that is deliberate

**1. A money figure. Anywhere. By construction.**

`Plan §23.8` asks the composer for `@@sales · 4 runs · ~$0.40`. **The `4` is real — it is the
resolved member count. The `$0.40` has no source**: zero runs have ever completed, so there is
nothing to average, and a cost preview is exactly the surface where a plausible number gets
believed (BOARD rule 9).

So the badge has no prop that can carry one — no `label`, no `children`, no `suffix` — and four
things fail if anyone tries: `TurnCost.estimatedUsd` is typed `null` by its owner; a
`@ts-expect-error` makes widening that type break `tsc`; a render sweep across every form × both
locales × both exactness values fails on a currency pattern; and a catalogue assertion fails on
one in any `threads.` string. **If you find yourself wanting a dollar sign here, the answer is
that we do not have one yet, and saying so is the feature.**

**2. A count you did not measure.**

`cost` is `TurnCost | 'unresolved'`. **`runs: 0` and `'unresolved'` render differently and both
are first-class.** "This department has no members" is an answer; "the roster has not resolved"
is the absence of one. The unresolved state carries **no numeral at all** — the absence of a
figure is the signal, and the test asserts it contains no digit. **Pass `'unresolved'` rather
than a zero you did not measure.**

**3. `#department` stated as "1 run".**

It is a **lower bound** — the lead answers *or delegates*, and a delegation is a second run
(`runsAreExact: false`). The copy says *"at least 1 run"* and **the mark says it too**: a
free-standing, uncapped stroke means the count continues past what we can count. The test binds
the drawing to `addressCost()`, so the two cannot drift.

**4. A `steer` whose deliverability nobody answered.**

`deliverable` is **required on `steer` and forbidden on `note`/`halt`** — a discriminated union,
so `<InterruptBadge level="steer" />` does not compile. thread-model invariant 7: a steer with no
run in flight is *refused*, never silently downgraded, because "a human who steered and was
silently queued believes they changed course, and nothing did." An undeliverable steer renders
dashed and stays at `--ink-2`, not `--ink-3` — the refusal is required reading by §9.2.

## For whoever builds the `@@` confirm

BOARD Hazard 1: *`@@` requires an explicit confirm that **names the count** — not a tooltip, not
a hover — reachable **and dismissable** from the keyboard without the fan-out firing.*

The badge is built to be wrapped by it: **it renders no focusable node and sets no `tabindex`**,
so a `<button>` around it is legally reachable — a button containing a button is not. It supplies
the count; reachability, dismissal and the refusal branch
(`assertFanOutDispatchable` → `fanout_dispatch_refused`) are yours.

## Standing rules these do not relax

- **Chrome is monochrome.** Neither register spends a single hue, and both tests assert it.
  An address is a **price**, not a status; an interrupt level is a **choice**, not a state. If you
  find yourself reaching for `Chip` for either, that is the collision §11.5 exists to prevent —
  `Chip` is the status vocabulary and the only component permitted data ink.
- **No motion, ever**, in either register. A pulsing badge reads as *alive*, and alive is copper's
  single word. Reduced motion is therefore a still with no layout change by construction.
- **Direction is declared, not decided.** `MIRRORS['threads.addressBadge']` and
  `DOES_NOT_MIRROR['threads.registerMarks']` in `i18n/direction.ts`. The sigil run is `<bdi>`-
  isolated because `@`, `#` and `@@` are direction-**neutral** characters and would otherwise take
  their side from whatever Arabic sits beside them. **Do not re-solve this in a view.**
- **Adding a twelfth primitive is a decision-request**, and the test is the one all three of the
  last three passed: can it be a prop on an existing one, and if the answer is `Chip`, why is it
  not a status?

## Gates, so a citation carries its width

`test:web` **612 pass** · `tsc` clean · `check-tokens` **0 violations, 2 exemptions** at
`scanned at 2026-08-17 22:12 +03:00 · 8a9bdf5 · 9 uncommitted under apps/web · checker modified
under scripts` · `check-rtl --gate` **holding at 308**, zero new findings ·
`validate:coverage` **0 FAILs**.

**That banner now carries a second dirtiness figure** — `· checker modified under scripts`. New
today, tokens contract §8b: the banner used to scope dirtiness to `apps/web`, so a run made with
a modified checker printed `clean`. If you quote a token result, quote the whole line.

And one correction that is on BOARD and will otherwise be re-cited: **`check-tokens` *does* catch
`border-ink-teal` and `focus-visible:ring-ink-copper`** — falsified today by planting both. The
real gap is narrower: the rule runs only in `app/` and `components/primitives|shell|chrome/`, and
**deliberately will not be widened** to `map/`, `drawer/`, `dashboards/`, `chart/` or `sessions/`,
because those mix chrome and data by design. Written up as tokens contract **§8b.1** with the
transcript. `0 violations` means rule 8 holds; §1.3 outside those four directories still holds by
hand inspection.

Handoff: `comms/handoffs/M16-design-system-guardian-two-monochrome-registers.md`.
