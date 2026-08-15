---
agent: design-system-guardian
milestone: M0
spec: PART I · §1.1 · §1.2 · §1.3 · §1.4 · §1.5 · §1.6
created: 2026-08-15T21:23
status: ready-for-review
---

# M0 — Design tokens, type, shape, motion, primitives

## What exists now

- `apps/web/src/styles/tokens.css` — verbatim `:root` and `body.light` chrome, data-ink palette, families, radii, depth, textures, motion, `--track-1…4`, `--track-accent`. The only file allowed to contain a color literal.
- `apps/web/src/styles/tokens.test.ts` — pins the 32 theme values, 9 data-ink hues, radii, shadows, texture, motion, families, tracking. Parser strips comments so `:root` banners cannot zero the map.
- `apps/web/src/styles/fonts.ts` — `@fontsource` Plus Jakarta Sans 400/500/600/700, Instrument Serif 400 + italic, IBM Plex Sans Arabic 400/500/600/700. `FONT_FAMILY`, `FONT_VAR`, `PRELOAD_FACES`.
- `apps/web/tailwind.config.ts` — every token as a utility. `darkMode: ['selector', 'body:not(.light)']`.
- `apps/web/src/components/primitives/` — eight primitives + `cx` + `motion.ts` + `theme.ts`, with tests.
- `scripts/check-tokens.mjs` — `npm run validate:tokens`.
- `comms/specs/design-system.md` — 102 `REQ-DS-*` rows, all with real paths.
- `comms/contracts/design-tokens.md` — frozen; `--track-accent` added under §8a (owner addition, not a value change).

## How to use it

```ts
import '@/styles/fonts'; // once, in app/layout.tsx — do not import @fontsource elsewhere
import { THEME_INIT_SCRIPT } from '@/components/primitives/theme';
// <body><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

import { Card, Chip, Eyebrow, Pill, KpiNumeral } from '@/components/primitives';
import { reveal, drawer, DURATION, useReducedMotion } from '@/components/primitives/motion';
import { setTheme, readToken, THEME_CHANGE_EVENT } from '@/components/primitives/theme';
```

Utilities (full index: contract §8): `bg-bg` `bg-bg-2` `bg-bg-3` `bg-card` `bg-card-2` `bg-screen` `bg-screen-2` `bg-glass` `text-ivory` `text-ivory-2` `text-ink-2` `text-ink-3` `bg-copper` `text-copper-ink` `border-line` `border-line-2` `bg-scrim` · `text|bg|border|fill|stroke-ink-{copper,copper-2,teal,coral,coral-2,lavender,lavender-2,amber,blue}` + `-line`/`-fill` · `text-display` `text-h1-accent` `text-h2` `text-body` `text-small` `text-meta` `text-label` `text-label-sm` `text-label-lg` `text-kpi` `text-kpi-sm` `text-kpi-lg` `text-pill` `text-chip` · `tracking-display` `tracking-h2` `tracking-accent` `tracking-kpi` `tracking-wider-1…4` · `font-sans` `font-serif` `font-arabic` · `rounded-pill` `rounded-chip` `rounded-kpi` `rounded-card-sm` `rounded-card` `rounded-card-lg` `rounded-panel` `rounded-panel-lg` · `shadow-drawer` `shadow-soft` `backdrop-blur-glass` `.glass` `.dot-grid` `bg-galaxy-glow` `.rail-up` `.rail-down` · `duration-reveal|drawer|relax|zoom|count|hover` `ease-reveal|drawer|zoom` · `z-canvas|overlay|chrome|scrim|drawer|toast`.

### Primitives and props

| Component | Props |
|---|---|
| `Pill` | `variant`: primary / secondary / ghost · `size`: sm (32px) / md (36px) · `square` · `leading` · `trailing` |
| `Card` | `radius`: sm / md / lg · `interactive` · `padded` |
| `Chip` | `tone`: neutral / live / success / risk / warn / info / demo · `caps` · `dot` |
| `Eyebrow` | `size`: sm / md · `tone`: muted / strong / alive · `serif` · `as` |
| `RailLabel` | `orientation`: up / down · `serif` · `tone`: faint / muted |
| `KpiNumeral` | `value` · `size`: sm / md / lg · `tone`: default / alive / up / down / muted · `decimals` · `prefix` · `suffix` · `format` · `animate` |
| `SegmentedControl` | `options` · `value` · `onChange` · `label` (required) |
| `GlassPanel` | `radius`: md / lg / pill · `shadow`: drawer / none · `bordered` |

Ghost button = `Pill variant="ghost"`. Watermark = `Eyebrow serif` or `RailLabel serif`. Do not add a ninth primitive; file a decision-request.

## Contracts touched

`comms/contracts/design-tokens.md` (owned here). No ADR. `--track-accent: -0.01em` added under §8a so RTL can `var()` the §1.4 accent tracking instead of a literal.

## Deliberately not done

- **`<link rel="preload">`** for critical faces. Hashed woff2 URLs need infra's `*.woff2` module declaration. `PRELOAD_FACES` records which faces matter.
- **Wiring `fonts.ts` and `THEME_INIT_SCRIPT` into `layout.tsx`.** That file is infra's. Today it imports a subset of `@fontsource` directly (missing Arabic and Instrument upright) and has no no-flash script. Message filed.
- **`@import './styles/rtl.css'` in `globals.css`.** Same: infra's file. rtl.css itself was not edited.
- **A theme toggle control.** Mechanism is `theme.ts`; the control is §2.0 / shell.
- **Starfield / galaxy / dot-grid renderers.** Parameters only; drawing is §2.1.
- **Carousel Framer variant.** Numbers only; gesture model is §2.4.
- **Vitest + Testing Library in `apps/web/package.json`.** Tests exist; the deps do not. Infra owns the package file.
- **Type literals in `drawer.module.css`, `sessions.module.css`, `map/lib/map-type.ts`.** Their owners. `validate:tokens` fails on those files until they swap to the scale.
- **Light-theme data-ink variants.** Hues must not swap (REQ-DS-49).

## Verification

- `node scripts/check-spec-coverage.mjs` — no `design-system.md` FAIL. (Repo-wide still fails on unclaimed §2.1 / §2.4 / §2.5 / §3.1 / §3.5 / PART III / PART VI / PART VII, other agents.)
- `node scripts/check-tokens.mjs` — 0 hex / rgb / named-color hits outside `tokens.css`. 69 remaining FAILs are type/duration literals in drawer, sessions, and map — not this agent's files. Chip.tsx and Chip.test.tsx carry printed `token-exempt-file`. rtl.css exemptions are printed (font-size multiplier; accent tracking pending their swap to `--track-accent`).
- Token parser smoke: 81 `:root` keys, `--bg #111114`, `--dur-reveal 500ms` (reduced-motion block does not leak).
- Hex grep of `apps/web/src` `*.{ts,tsx,css}`: literals only in `tokens.css` and `tokens.test.ts`. Comment mentions in map SVG files are theirs.

## Next agent

`fidelity-qa-reviewer` — review-request in your inbox. First read: this handoff, then `comms/contracts/design-tokens.md`, then `comms/specs/design-system.md`. Do not patch `rtl.css`. Infra still owes the `layout.tsx` / `globals.css` one-liners before fonts and theme-init are live in the app shell.
