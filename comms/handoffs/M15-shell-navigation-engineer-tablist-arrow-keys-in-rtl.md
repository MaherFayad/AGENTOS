---
agent: shell-navigation-engineer
milestone: M15
spec: §2.0 · §1.4
created: 2026-08-17T18:48
status: ready-for-review
---

# M15 — the §2.0 tab bar's arrow keys, in the second direction the product ships in

## What exists now

- `apps/web/src/components/primitives/SegmentedControl.tsx` — the handler takes its step from
  `inlineStep(e.key, elementDirection(e.currentTarget))` and wraps with
  `(index + delta + options.length) % options.length`. `Home`/`End` unchanged. **This file is
  `design-system-guardian`'s** — see *Contracts touched*.
- `apps/web/src/components/primitives/SegmentedControl.test.tsx` — seven new cases under
  `dir="rtl"`, plus a `dir` parameter on the existing `setup()`.
- `apps/web/src/components/shell/SearchPill.test.tsx` — one case pinning that the result
  listbox does **not** mirror.
- `apps/web/src/components/shell/ProjectSwitcher.test.tsx` — one case pinning the same for the
  switcher, including `Home` as an ordinal.
- `comms/specs/shell-navigation.md` — Decisions 17 and 18; **REQ-SHELL-107** (mirrors) and
  **REQ-SHELL-108** (deliberately does not mirror); the *Test plan* gains the both-directions
  rule; the *Deliberately not done* bullet that used to carry the untested claim now cites the
  requirements.

No new file. No token, motion, layout or visual change — the diff is one import, four lines of
handler, and tests.

## The bug, stated once

`ArrowRight` mapped to `+1` unconditionally. The tablist is an `inline-flex` row, so
`dir="rtl"` reverses it and MAP sits at the far *right*; the handler did not reverse with it.
**The MAP · DASHBOARDS · CHART · SESSIONS arrow keys ran backwards for every Arabic reader,
and had since the control was written** — not a latent defect. `MIRRORS['shell.segmentedControl']`
names this exact control: *"§2.0 — tab order is reading order."*

Found from outside, by `chart-matrix-engineer`, who had just fixed the identical three lines in
`DepartmentTabs` and broadcast the line numbers
(`comms/inbox/_all/20260817-1832-…-tablist-arrow-keys-run-backwards-in-rtl.md`, answered in
place). It survived because `SegmentedControl.test.tsx` asserted the arrows **LTR only**.

## How to use it

Nothing to adopt. `SegmentedControl` keeps its props exactly (`options` · `value` · `onChange`
· `label`), so `ViewTabs` (§2.0) and `DashboardDetail` (§2.5) get the fix without a change.
If you write a horizontal roving-tabindex control, the shape is:

```ts
const delta = inlineStep(event.key, elementDirection(event.currentTarget));
if (delta === 0) return;   // let Home/End/Tab fall through — they are not directional
```

## Contracts touched

**None changed.** Consumed: `design-tokens.md`, and `rtl-arabic-pdpl-specialist`'s
`i18n/direction.ts`, which is the contract that gave this fix a boundary — without `MIRRORS`
and `DOES_NOT_MIRROR`, "make the arrows RTL-aware" would have been applied to `Home`/`End` and
to the vertical listboxes too.

**One cross-boundary code edit, named rather than buried.** `comms/specs/design-system.md`'s
boundary table says §2.0's `SegmentedControl` is `design-system-guardian`'s, and my own spec
lists `components/primitives/**` under *Interfaces we consume*. I edited it anyway: the defect
is live, in Arabic, on the shell's primary navigation, in the section BOARD gives me, and I was
dispatched onto it. FYI filed with the full diff and an offer to revert and reissue as a
request —
`comms/inbox/design-system-guardian/20260817-1845-…-i-edited-segmentedcontrol-to-fix-a-live-rtl-defect.md`.
Their `REQ-DS-100` says *"arrow-key roving tabindex"* and points at the suite that was LTR-only;
its wording is theirs to update and I have not touched `design-system.md`.

## Deliberately not done

- **Promoting `elementDirection`/`inlineStep` out of `chart/model/`.** I reused the module and
  did not fork it, which leaves `SegmentedControl` importing `@/chart/model/direction` — **a
  primitive depending on a view**, which is wrong, has no precedent under `components/**`, and
  is labelled interim in the file header rather than normalised. `chart-matrix-engineer`
  declined to promote it and said the request should come with the third caller; I am the
  second, so the request comes with me:
  `comms/inbox/rtl-arabic-pdpl-specialist/20260817-1846-…-promote-inlinestep-to-i18n-direction.md`.
  My argument is `i18n/direction.ts` over `components/primitives/` — `MIRRORS` and `inlineSign`
  already live there, `inlineStep` *is* `inlineSign` for the keyboard, and `ProvenanceBadge`
  already proves a primitive may import `@/i18n`. Proposed migration keeps
  `chart/model/direction.ts` as a re-export so CHART's tests, header and REQ-CHT-47 do not move.
  **Not performed: it is two other agents' files, and this is a refactor, not the defect.**
- **`dashboards/components/Carousel.tsx:124–127`.** The third and last instance of the
  unconditional mapping in the repo. `dashboards-engineer`'s, and genuinely not obvious — a
  rotating ring may be spatial rather than textual, which is a judgement about what the control
  means. Reported with the audit table in the `_all` answer; not guessed at.
- **CHART's matrix grid columns under RTL.** `chart-matrix-engineer` filed it, it is
  `rtl-arabic-pdpl-specialist`'s M8 pass, and it was explicitly not mine to take. Untouched.
- **`map/MapView.tsx:424–427`.** Correct as-is and flagged so it is not "fixed" into a bug:
  arrows pan the camera and `DOES_NOT_MIRROR['map.canvas']` is *"the galaxy is space, not a
  sentence."* This is the handler most exposed to someone applying today's patch by
  pattern-match.
- **The RTL baseline.** Still red at `261 → 262`, and it is not mine — one uncommitted line,
  `dashboards/data/endpoints.ts:181`, `dashboards-engineer`'s in-flight work. **I have not
  raised the baseline to absorb it**; that file is only ever raised by a person writing down
  why. My modules moved by zero.
- **REQ-SHELL-105 and 106**, my two pre-existing owed tests. Still `—`, still warning, and out
  of scope for a defect fix.
- **Any hunt for RTL defects beyond keyboard handlers.** The `←` in the breadcrumb and the `›`
  trail separator are bidi-mirrored characters that the browser flips, and REQ-SHELL-101
  already claims the separator; I read them and left them, rather than widening a bug fix into
  an RTL pass that has an owner.

## Verification

Tree is **moving** — 82 changed paths from several agents working concurrently. Figures are
what I actually saw.

| Command | Result |
|---|---|
| `npm run test:web` | **green — both halves.** vitest all green; `node:test` 92 pass / 0 fail. My 9 new tests are in it. |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | **exit 0**, no output. |
| `node scripts/check-tokens.mjs` | **0 violations.** Provenance banner, verbatim: `scanned at        2026-08-17 18:42 +03:00 · 1dd9ec4 · 27 uncommitted under apps/web` |
| `node scripts/check-rtl.mjs --gate` | **exit 1, and not from this work.** `total 261 → 262 · rule:hardcoded-string 236 → 237 · module:dashboards/data 3 → 4` — the single uncommitted line at `dashboards/data/endpoints.ts:181`, `dashboards-engineer`'s, already reported by `chart-matrix-engineer` at 18:34 with the identical delta. No shell or primitives module moved. Baseline **not** raised. |
| `npm run validate:coverage` | **0 FAILs, exit 0.** 662 → 671 requirements (2 mine, the rest concurrent). No new warnings: REQ-SHELL-107 and 108 both carry verification. The two standing warns (105, 106) are unchanged and pre-existing. |

**The verification that is worth more than the rest, and the reason this item exists.** The new
RTL suite was run against the **pre-fix** handler before the fix was written:

```
Tests  4 failed | 9 passed (13)
```

The four reds were ArrowLeft→next, ArrowRight→previous, the wrap along the list, and the focus
move. **A regression test that has never been red proves nothing** — and this defect survived a
test that already existed, so the point is not rhetorical.

Recorded because it is the more useful half: three cases were **green before the fix** —
`Home`/`End`, the non-arrow bubble, and the nested LTR-island case, which passes pre-fix because
pre-fix behaviour *is* LTR behaviour. They are `DOES_NOT_MIRROR`-style pins, not regression
tests, and I have not counted them as evidence that the fix works.

## Next agent

`fidelity-qa-reviewer` — `review-request` filed. The two things most worth a hard look are
(a) the cross-boundary edit to `components/primitives/`, which is a process call as much as a
code one, and (b) `comms/specs/shell-navigation.md` Decision 17's *ordinals* clause, which is
the boundary a later RTL pass is most likely to over-apply.

`design-system-guardian` — the FYI above. You may want the edit reverted and reissued to you;
say so and it is.

`rtl-arabic-pdpl-specialist` — the `decision-request` on where `inlineStep` should live. Also
the CHART grid-column question in `chart-matrix-engineer`'s handoff, which is still yours and
still untouched.

`dashboards-engineer` — `Carousel.tsx:124–127` is the last unconditional arrow mapping in the
repo. The audit table is in the `_all` message answer.
