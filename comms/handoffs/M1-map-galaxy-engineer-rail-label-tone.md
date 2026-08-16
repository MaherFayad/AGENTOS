---
agent: map-galaxy-engineer
milestone: M1
spec: §2.2 (rails) · tokens contract §9.1–9.6
created: 2026-08-16T22:34
status: ready-for-review
---

# M1 — the §2.2 rails state their tone, and a guard so the next one has to

## What exists now

- `apps/web/src/map/chrome/DepartmentRails.tsx` — both `<RailLabel>`s carry
  `tone="muted"` (`--ink-2`) instead of inheriting the primitive's `faint` (`--ink-3`).
  The buttons gained `group`; the labels gained
  `transition-colors duration-hover ease-reveal group-hover:text-ivory group-focus-visible:text-ivory`.
- `apps/web/src/test/primitive-color-defaults.test.ts` — **new, repo-wide.** Derives which
  primitives have a sub-AA default by parsing their source, then checks every `.tsx` under
  `src/` for a call site that omits the prop. The generalisation of
  `dashboards-contrast.test.ts:220`, which `fidelity-qa-reviewer` asked me to steal.
- `apps/web/src/map/chrome/DepartmentRails.test.tsx` — **new.** Three tests. The rails had
  no test at all before tonight.
- `comms/inbox/design-system-guardian/20260816-2232-map-galaxy-engineer-raillabel-default-is-the-defect.md`
  — the primitive's default is theirs; I asked, I did not edit.

## The tone I chose, and why it is not the one the pattern suggests

**`--ink-2` (`tone="muted"`), not `--ivory-2`.**

`fidelity-qa-reviewer` asked me not to pattern-match the drawer and DASHBOARDS, which put
`--ivory-2` where prose sat on an interactive or hover surface. These rails *are* buttons, so
the label fits. **The reason does not.** §9.5's `--ivory-2` ruling exists for one specific
mechanism: `--card-2` is the standard hover fill for interactive rows, and it drops `--ink-2`
to 4.25:1 in light. These buttons have **no fill in either state** — they float over the map's
`--bg` → `--bg-3` vignette (`MapView.tsx:439` is `bg-bg`; the §2.1 vignette darkens the edges,
which is exactly where the rails sit). I measured both endpoints rather than assuming:

| Surface under the rail | `--ink-2` dark | `--ink-2` light |
|---|---|---|
| `--bg` `#111114` / `#F4F4F5` | 5.08:1 | 5.05:1 |
| `--bg-3` `#060608` / `#FFFFFF` (the vignette edge) | 5.46:1 | 5.06:1 |

Both clear AA in both themes with margin, and the arithmetic reproduces §9.1's published
range endpoints exactly (3.83 / 3.29 for `--ink-3`, 5.46 / 5.05 for `--ink-2`), which is how I
know the method is right and not just the answer.

The second half is §9.4a: **a rail names the department you are *not* looking at.** Two
`--ivory-2` names flanking the frame would sit at body-copy weight beside a department
watermark that §2.2 renders at `rgba(236,236,238,.05)`. The neighbours would out-shout the
place you are standing. `--ink-2` keeps them one rung below, which is what §9.4a asks for and
what the map's whole visual argument depends on.

It also lands where `dashboards-engineer` landed on the same primitive an hour ago, which is
a check on the reasoning rather than the reason for it.

## The bug in those two lines that nobody filed

`RailLabel` sets its own colour class, so it never inherited the button's `hover:text-ivory`.
**Hovering a rail brightened the `aria-hidden` chevron and left the department name it points
at unchanged.** A dead affordance on the one control in §2.2 that is hardest to notice exists.
`group-hover` / `group-focus-visible` reconnect it, so the rest state stays quiet (§9.4a) and
the reader's own act of reaching for the control takes the name to `--ivory`. That is a
better answer than choosing between quiet and legible at rest.

This is beyond the filed finding and I am flagging it as such rather than burying it in a
diff. It is three utilities and it was in the lines I was already opening.

## Were there only two? — answered with an instrument, not a read

Two `<RailLabel>` sites, yes. But that was the wrong question to answer by grepping for
`RailLabel`, because the next instance will not be a `RailLabel`. So I derived the class of
defect instead: **every primitive default that resolves to a text token failing §9.1.**

| Primitive | Default | Resolves to | Verdict |
|---|---|---|---|
| `Chip` | `tone='neutral'` | `text-ivory-2` | AAA |
| `KpiNumeral` | `tone='default'` | `text-ivory` | AAA |
| `Pill` | `variant='secondary'` | `text-ivory` | AAA |
| `Eyebrow` | `tone='muted'` | `text-ink-2` | on the floor, legal |
| **`RailLabel`** | **`tone='faint'`** | **`text-ink-3`** | **fails AA everywhere** |

`Card`, `GlassPanel` and `SegmentedControl` set no defaulted text colour. **So `RailLabel` is
the only one, and my two were the only silent call sites** — but that sentence is now produced
by a test that re-derives it on every run, not by me reading eight files once.

## How to use it

Nothing to call. The guard runs in `npm run test` / `verify`. To add a rail anywhere:

```tsx
<RailLabel serif tone="muted">{label}</RailLabel>   // or tone="faint", said out loud
```

Omitting `tone` now fails `src/test/primitive-color-defaults.test.ts` with the file name.

## Contracts touched

None edited. Consumes `comms/contracts/design-tokens.md` §9.1 (measurements), §9.2 (the
rule), §9.3 (the carve-out that does not reach these rails), §9.4a (hierarchy), §9.5 (the
rule whose *reason* is absent here), §9.6 (why static checking stops where it does).
`graph-layout.md` is mine and is untouched. No ADR: §2.1 line 140 names no token for these
labels, so there is nothing to override — confirmed by `fidelity-qa-reviewer` before routing.

## Deliberately not done

- **`RailLabel`'s default is not changed.** It is `design-system-guardian`'s file. I think it
  is the real defect and said so with the evidence; changing it myself would be the exact
  thing the protocol forbids, and my call sites are correct either way.
- **`provenance.mjs` prints UTC** (`toISOString()`, line 42) while every timestamp else in
  this repo is local (+3), so a fresh scan reads three hours stale with no `Z`. Raised with
  the contract owner. Not fixed by me: it is §8b's line and one line in someone's script.
- **No `--ivory-2` tone added to `RailLabel`.** I considered asking for one and decided the
  ask was unearned — my reasoning concluded `--ink-2`, so requesting a token I would not use
  would be widening a primitive to justify a preference.
- **The other two `<RailLabel>` sites** (`DashboardDetail.tsx`) are already correct and are
  `dashboards-engineer`'s. I touched nothing in `src/dashboards`.
- **`dashboards-contrast.test.ts:220` is not deleted.** It is redundant with the repo-wide
  guard now, but it belongs to `dashboards-engineer` and a duplicated assertion is cheaper
  than deleting someone's test on the same night they wrote it. Worth them removing when they
  next open the file.
- **Still not compared at 1440px.** Rail labels moved one rung brighter and now respond to
  hover; that is a proportion-and-weight change on the frame edge and it is unverified against
  a reference frame, like everything else. Two of the six *Awaiting the user* items.
- **M1 is not reopened.** It was PASS before this and is PASS after it.

## Verification

- `node scripts/check-tokens.mjs` —
  `scanned at 2026-08-16 19:31 · 56e93cf · 42 uncommitted under apps/web` (19:31 UTC =
  **22:31 local**; see the UTC note above). 291 files scanned, **0 violations**, 2 exemptions,
  both pre-existing `Chip` (data ink by §1.3).
- `npx vitest run` in `apps/web` — **58 files, 412 tests, 0 failures**, same tree.
- `npx tsc --noEmit` — clean. `npx eslint` on the changed files — clean.
- **Mutation-checked the new guard rather than trusting a green tick.** Removed `tone="muted"`
  from one call site: the suite failed with
  `map/chrome/DepartmentRails.tsx: <RailLabel> must state tone=, not inherit it`, and named
  only the site I broke. Restored. A guard nobody has seen fail is a guard nobody has tested —
  and given the evening's theme, shipping an unverified instrument would have been funny.
- Not run: any browser. There is none in this repo.

## Next agent

`design-system-guardian` — the default-flip decision-request, then decide whether
`src/test/primitive-color-defaults.test.ts` moves under your ownership. Read
`comms/contracts/design-tokens.md` §9.3's `--ink-3` row first; the question is only whether
its one genuine home should be opted into rather than fallen into.
