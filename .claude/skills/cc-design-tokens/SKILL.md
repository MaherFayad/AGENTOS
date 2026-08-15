---
name: cc-design-tokens
description: Command Center design token discipline — use whenever writing or reviewing any UI in this repo (components, CSS, Tailwind classes, charts, canvas colors, motion). Enforces the extracted SkillTree token set, the monochrome-chrome rule, typography scale, and motion timings from spec Part I.
---

# cc-design-tokens — the fidelity rules

Authoritative values: `comms/contracts/design-tokens.md` (owner: `design-system-guardian`).
Read it. This skill is the *judgment* layer on top of those values.

## The one rule that carries the look

> **Chrome is monochrome. Color is data.**

Ivory/ink/line on near-black for every surface, border, tab, icon and label. Color appears
only where it carries a value — status, delta, chart series — plus the copper accent for
"alive" things (live-node rings, edge pulses, the LIVE counter numeral, the NAVIGATION
eyebrow). Spec §1.3 calls this "90% of why it looks expensive." It is.

Before you color anything, answer: *what value is this communicating?* No answer → it's
`--ivory`, `--ivory-2`, `--ink-2`, `--ink-3`, or `--line`.

## Checklist for any component

- [ ] Zero raw hex outside `tokens.css`. Colors are `var(--token)` / Tailwind token classes.
- [ ] Card = `1px solid var(--line)`, radius 12–16px, hover → `--line-2`. No shadow in dark
      mode (drawers excepted: `0 8px 40px rgba(0,0,0,.5)`).
- [ ] Pills are `999px`. Primary = `--copper` bg + `--copper-ink` text, 13px/600.
      Secondary = transparent + `1px var(--line-2)`.
- [ ] Wide-tracked labels: uppercase, 11–13px, weight 500, `letter-spacing: .25em–.45em`.
      This is everywhere — department names, eyebrows, rail labels, dashboard captions.
- [ ] Numerals: `tabular-nums`, 28–32px/600 for KPIs.
- [ ] Instrument Serif **italic** only for headline accent words, watermarks and rail
      caps — never body copy, never Arabic.
- [ ] Both themes work by swapping `body.light`. No component branches on theme.
- [ ] `prefers-reduced-motion`: galaxy rotation, edge pulses, count-ups and carousel
      momentum all stop; end states remain.

## Type scale (memorize)

86/700/−2.4px display · 91/400 serif-italic accent · 50/700/−1.4px H2 · 16/400/1.6 body ·
12–13px meta · 11–13px wide-tracked caps · 28–32/600 tabular KPI.

## Motion timings (memorize)

panels/drawers 500ms `cubic-bezier(.2,.7,.2,1)` reveal · drawer slide 320ms ·
department zoom 700ms ease-in-out · edges relax 600ms · count-up 300ms ·
carousel `perspective(1400px) rotateY(±35°)`, rear `scale(.82) brightness(.5)`.

## Self-check before handoff

```powershell
# any raw hex outside the token file is a fidelity failure
Select-String -Path apps/web/src -Include *.tsx,*.css -Pattern '#[0-9a-fA-F]{6}' -Recurse |
  Where-Object { $_.Path -notmatch 'tokens\.css' }
```

Expect zero hits. Non-zero → fix before requesting review; `fidelity-qa-reviewer` runs the
same grep and will bounce it.

## When the spec and taste disagree

The spec wins, because the acceptance test is a side-by-side screenshot against their
video frame at 1440px (Part VI). Improvements go in an ADR first, not straight into a
component.
