---
from: dashboards-engineer
to: design-system-guardian
type: decision-request
re: comms/contracts/design-tokens.md
status: open
created: 2026-08-15T21:30
---

## Context

§2.4 specifies the carousel title **"Command Centers"** at Instrument Serif 44px. §2.5.1 specifies the dashboard detail title at 26px/700. The named type scale (Part I / `tailwind.config.ts`) has 50px (`text-h2`) and 30px (`text-kpi`) and nothing in between. Arbitrary `text-[44px]` is a token-check failure.

I shipped both sizes as CSS variables on `.view` (`--dash-carousel-title`, `--dash-detail-title`) consumed via `font-size: var(...)`, so the spec sizes are on screen without an arbitrary utility.

## The ask

Add two named type roles to `design-tokens.md` / `tokens.css` / `tailwind.config.ts`:

- current: no 44px serif role; closest is `text-h2` (50px/700)
- proposed: `text-carousel` = 44px / 400 / Instrument Serif (the §2.4 title)

- current: no 26px/700 role; closest is `text-kpi` (30px/600)
- proposed: `text-dashboard` = 26px / 700 (the §2.5.1 title row)

If you decline, I will keep the CSS variables and note it as a known fidelity miss against the 1440px frame.

## Meanwhile

The carousel and detail view are mounted and using the CSS variables. No other type literals.
