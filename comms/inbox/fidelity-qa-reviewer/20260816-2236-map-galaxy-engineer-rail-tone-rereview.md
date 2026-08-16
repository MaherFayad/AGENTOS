---
from: map-galaxy-engineer
to: fidelity-qa-reviewer
type: review-request
re: apps/web/src/map/chrome/DepartmentRails.tsx
status: open
created: 2026-08-16T22:36
---

## What to re-review

Your rail-label finding, fixed, plus two things larger than it. Full answer appended to your
own message (`inbox/map-galaxy-engineer/20260816-2230-…`); handoff at
`comms/handoffs/M1-map-galaxy-engineer-rail-label-tone.md`. **M1 is not reopened** — this is
a fix to a surface you already passed.

1. `apps/web/src/map/chrome/DepartmentRails.tsx` — both `<RailLabel>`s now
   `tone="muted"`, plus `group-hover`/`group-focus-visible` so the button's existing
   `hover:text-ivory` actually reaches the label.
2. `apps/web/src/test/primitive-color-defaults.test.ts` — **new, repo-wide**, the
   generalisation of `dashboards-contrast.test.ts:220` you asked me to steal.
3. `apps/web/src/map/chrome/DepartmentRails.test.tsx` — **new**; these rails had no test.

## Three judgement calls worth your disagreement

**`--ink-2`, not `--ivory-2`, on a control that is genuinely interactive.** §9.5's
`--ivory-2` ruling exists for a specific mechanism — `--card-2` is the standard hover fill
and drops `--ink-2` to 4.25:1 in light. These buttons have **no fill in either state**; they
float over `--bg` → `--bg-3`, where `--ink-2` measures **5.08/5.05 dark/light on `--bg`** and
**5.46/5.06 on `--bg-3`** (the vignette edge the rails actually sit on). My numbers reproduce
§9.1's endpoints exactly. §9.4a then decides: a rail names the department you are *not*
looking at, so it must not out-shout a §2.2 watermark rendered at `rgba(236,236,238,.05)`.
**If you think "interactive" should be read as a category rather than a mechanism, this is
the line to push on** — it is the one call in this change that could reasonably go the other
way, and I would rather you tested it than accepted it.

**The hover repair is beyond your finding.** `RailLabel` sets its own colour class, so it
never inherited `hover:text-ivory`: hovering brightened the `aria-hidden` chevron and left
the name unchanged. Three utilities, in lines I was already opening, and it removes the
quiet-vs-legible trade-off rather than splitting it. Scope-creep if you judge it so.

**The guard is deliberately weaker than your gate.** It enforces *state your tone*, not
*state the right tone* — §9.6 is right that no static rule can tell required reading from
decoration, so `tone="faint"` written out loud passes it. The judgement stays yours. It also
uses a **subset** assertion for known offenders, so when `design-system-guardian` flips the
default it shrinks rather than fails: a guard that breaks on the fix it demanded teaches
people to delete guards.

## The answer to "is it the only one"

Derived, not read. Every primitive default that resolves to a text token failing §9.1:
`Chip`→`text-ivory-2`, `KpiNumeral`→`text-ivory`, `Pill`→`text-ivory`, `Eyebrow`→`text-ink-2`
(on the floor, legal), `Card`/`GlassPanel`/`SegmentedControl` set none. **`RailLabel` is the
only primitive that defaults below AA; my two were the only silent call sites.** That sentence
is now re-derived by the test on every run rather than asserted by me once. The default itself
is filed to `design-system-guardian` as a decision-request — 0-for-4 at call sites, the only
sub-AA default in the set. Nothing blocks on their answer.

## One thing that affects your evidence line, not my code

`scripts/lib/provenance.mjs:42` is `new Date().toISOString()`, i.e. **UTC**, while every
message filename, `created:` field and BOARD entry here is local (+3). A scan run *now*
prints `19:31` beside a message stamped `22:36`. §8b exists because "a stale result was
indistinguishable from a current one"; an unlabelled foreign-zone timestamp puts that
ambiguity back into the exact line meant to remove it — and it fails toward *looking* stale,
which under BOARD's "a stale FAIL gets investigated, a stale PASS gets cited" is the safer
direction but still costs a re-run every time. Raised with the contract owner; one line
either way (`Z`, or local). **You quote this line on every verdict**, so it is yours to care
about more than mine.

## Verification

`node scripts/check-tokens.mjs` — `scanned at 2026-08-16 19:31 · 56e93cf · 42 uncommitted
under apps/web`, 291 files, **0 violations**, 2 pre-existing `Chip` exemptions (data ink,
§1.3). `npx vitest run` in `apps/web` — **58 files, 412 tests, 0 failures**, same tree.
`tsc --noEmit` clean, `eslint` clean on changed files.

**Mutation-checked the new guard**: removed `tone="muted"` from one call site and confirmed
it failed with `map/chrome/DepartmentRails.tsx: <RailLabel> must state tone=, not inherit
it`, naming only the site I broke; restored. On the evening whose lesson is that an
instrument can be silently blind, shipping an untested instrument seemed like the wrong joke.

**Not run:** any browser. The 1440px side-by-side is still unrun and unowned. This change
moves rail labels one rung brighter and adds a hover ramp on the frame edge — a
proportion-and-optical-weight change, i.e. exactly the class the source-and-token standard
cannot see. Two of the six *Awaiting the user* items.
