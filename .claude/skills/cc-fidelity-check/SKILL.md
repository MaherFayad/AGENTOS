---
name: cc-fidelity-check
description: The Command Center acceptance gate — run before marking any user-visible milestone done, and when reviewing another agent's UI work. Covers the 1440px side-by-side fidelity test, token/motion audit, accessibility, performance, RTL, and empty states.
---

# cc-fidelity-check — the gate

Acceptance bar (spec Part VI): *a side-by-side screenshot of our MAP vs their video frame
at 1440px should differ only in content.* Everything below serves that sentence.

## 1. Token audit (automated, run first)

```powershell
Select-String -Path apps/web/src -Include *.tsx,*.ts,*.css -Pattern '#[0-9a-fA-F]{3,8}' -Recurse |
  Where-Object { $_.Path -notmatch 'tokens\.css' }
```
Zero hits required. Then eyeball for the real failure mode: **color on chrome**. A tinted
border, a colored tab, a blue icon — each is a fidelity regression even though it passes
the grep. Color only where it carries a value (§1.3).

## 2. Type & spacing pass

- Wide-tracked caps actually tracked (.25em–.45em) — under-tracking is the most common miss.
- Instrument Serif italic present in headlines/watermarks/rails; absent from body and Arabic.
- KPI numerals `tabular-nums` and not jittering during count-up.
- Card radii 12–16px, drawers 16–20px, pills 999px, hairlines 1px `--line`.

## 3. Motion pass

Time them, don't guess: drawer 320ms · department zoom 700ms · panel reveal 500ms
`cubic-bezier(.2,.7,.2,1)` · edge relax 600ms · count-up 300ms. Then set
`prefers-reduced-motion: reduce` and confirm the galaxy stops rotating, pulses stop,
count-ups snap, and carousel momentum is off — with no layout change.

## 4. The screenshot test

Render at exactly 1440px, dark theme, and compare against the referenced video frame for
that section (§2.1 galaxy, §2.2 department, §2.3 drawer, §2.5 dashboard, §2.6 matrix).
Differences allowed: content. Differences not allowed: proportion, tracking, weight,
radius, color, density.

## 5. Accessibility (not optional, even tailnet-only)

- Keyboard: every node, chip, tab, card and drawer control reachable; visible focus ring
  that respects the monochrome rule (`--line-2` / ivory outline, not a browser blue).
- The map needs a non-visual path: search (§2.0) must reach any agent and open its drawer.
- Contrast: `--ink-3` on `--bg` is decorative-only; never put required information in it.
- Drawers trap focus and close on `Esc`; scrim click closes.
- Canvas is `aria-hidden` — it's texture; SVG carries the semantics.

## 6. Performance

~150 nodes (§2.1) — perf is not the constraint, jank is. Check: canvas particle loop
stays off the main thread's critical path during drag; no layout thrash on zoom; SSE
console virtualizes past ~2k lines; carousel drag holds 60fps.

## 7. Empty & failure states

Every view needs one, written like a human wrote it: no agents yet, no runs yet, runner
offline, Langfuse unreachable, session relay down, run failed. Spinner-only is a fail.

## 8. RTL & Arabic (§1.4)

`dir="rtl"` flips drawer side and rail labels. Latin serif italic does **not** apply to
Arabic — weight contrast instead. IBM Plex Sans Arabic for body. MSA labels stay
noun-form. Numerals and charts keep LTR direction inside RTL layout.

## Verdict

Write the result as the `## Answer` on the requesting `review-request` message:
**PASS**, or a numbered list of specific failures with file paths. "Looks good" is not a
verdict. Only after PASS may the milestone lead flip state in BOARD.md.
