# Spec — Design system (Part I)

> The implementation spec for Part I of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage` and `npm run validate:tokens`.

## Owner

`design-system-guardian`

## Spec sections covered

PART I · §1.1 · §1.2 · §1.3 · §1.4 · §1.5 · §1.6

## Boundaries — sections this spec cites but does not own

Citing is not claiming. These stay with the agent BOARD.md names:

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §2.0 | `shell-navigation-engineer` | `SegmentedControl`, the theme *mechanism* | the shell that mounts them, the theme toggle control |
| §2.1 | `map-galaxy-engineer` | starfield / glow / dot-grid parameters | the canvas that draws them |
| §2.4 | `dashboards-engineer` | carousel numbers (perspective, rotate, scale) | drag-to-spin and the widget surface |
| PART V | `infra-compose-engineer` | the token grep, `tokens.css`, the primitives | `layout.tsx`, `globals.css`, `package.json` |
| §1.4 Arabic / PART VII | `rtl-arabic-pdpl-specialist` | `--track-1…4` and `--track-accent` so they can flatten | `rtl.css` itself — do not edit it from here |

## Decisions

- **Verbatim, not interpreted.** §1.1 and §1.2 are transcribed character-for-character
  into `tokens.css`. `tokens.test.ts` pins every one of the 32 values so a later
  "improvement" fails a test instead of quietly costing us the 1440px side-by-side.
- **Data ink is namespaced `--ink-*`** and lives in its own `:root` block, not in the
  theme blocks. It does **not** swap with the theme. Recorded in
  `comms/contracts/design-tokens.md` §3 for the five agents who consume it.
- **Derived tints via `color-mix`**, not extra hex. `--ink-teal-line` / `--ink-teal-fill`
  exist so a chip never writes an alpha literal, and no new color enters the palette.
- **Tracking is tokenised** (`--track-1…4` plus `--track-accent: -0.01em`) rather than
  hardcoded in the Tailwind scale, so the RTL layer flattens them in one place. Arabic
  must never be tracked. This supersedes the ad-hoc `--track-label/-eyebrow/-tab` in
  `styles/rtl.css`. `--track-accent` exists so `.u-accent` can `var()` instead of a literal.
- **`--dur-hover: 160ms` is an owner addition**, not a spec value, and is labelled as
  such in `tokens.css` and contract §8a. §1.6 defines no hover timing; without a token
  every card would pick its own.
- **Reduced motion is enforced at the token layer** — the `@media (prefers-reduced-motion)`
  block collapses every `--dur-*` to `1ms`, so any component using `duration-*` inherits
  the guard without knowing about it. JS-driven motion additionally calls
  `useReducedMotion()`.
- **Eight primitives, and a ninth needs a decision-request.** Part V bans a component
  library; a home-grown library that grows without review is the same failure, slower.
- **`darkMode` is pointed at `body:not(.light)`** so a stray `dark:` produces truthful
  CSS — but `check-tokens.mjs` still fails on it. §1.2: tokens branch, components do not.

## Coverage

### §1.1 — dark theme `:root`

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-01 | §1.1 | `--bg` is `#111114` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-02 | §1.1 | `--bg-2` is `#1B1B21` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-03 | §1.1 | `--bg-3` is `#060608` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-04 | §1.1 | `--ivory` is `#ECECEE` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-05 | §1.1 | `--ivory-2` is `#B2B2B9` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-06 | §1.1 | `--ink-2` is `#84848C` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-07 | §1.1 | `--ink-3` is `#6B6B73` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-08 | §1.1 | `--copper` is `#ECECEE` — dark mode maps copper to ivory for CTAs | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-09 | §1.1 | `--copper-ink` is `#131315` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-10 | §1.1 | `--line` is `rgba(255,255,255,.10)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-11 | §1.1 | `--line-2` is `rgba(255,255,255,.16)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-12 | §1.1 | `--card` is `rgba(255,255,255,.025)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-13 | §1.1 | `--card-2` is `rgba(255,255,255,.05)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-14 | §1.1 | `--glass` is `rgba(13,13,15,.72)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-15 | §1.1 | `--screen` is `#101013` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-16 | §1.1 | `--screen-2` is `#16161A` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-17 | §1.1 | Every chrome token is exposed as a Tailwind color key (`bg-bg-2`, `text-ink-2`, `border-line`) | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |

### §1.2 — light theme `body.light`

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-18 | §1.2 | `--bg` is `#F4F4F5` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-19 | §1.2 | `--bg-2` is `#ECECEE` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-20 | §1.2 | `--bg-3` is `#FFFFFF` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-21 | §1.2 | `--ivory` is `#161618` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-22 | §1.2 | `--ivory-2` is `#4C4C54` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-23 | §1.2 | `--ink-2` is `#6E6E76` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-24 | §1.2 | `--ink-3` is `#8D8D95` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-25 | §1.2 | `--copper` is `#18181B` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-26 | §1.2 | `--copper-ink` is `#FFFFFF` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-27 | §1.2 | `--line` is `rgba(20,20,24,.10)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-28 | §1.2 | `--line-2` is `rgba(20,20,24,.17)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-29 | §1.2 | `--card` is `#FFFFFF` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-30 | §1.2 | `--card-2` is `#EBEBED` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-31 | §1.2 | `--glass` is `rgba(244,244,245,.80)` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-32 | §1.2 | `--screen` is `#FFFFFF` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-33 | §1.2 | `--screen-2` is `#F4F4F6` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-34 | §1.2 | The theme switch is exactly the class `light` on `<body>` | `apps/web/src/components/primitives/theme.ts` | `apps/web/src/components/primitives/theme.test.ts` |
| REQ-DS-35 | §1.2 | The choice persists across reloads (`localStorage` key `cc.theme`) | `apps/web/src/components/primitives/theme.ts` | `apps/web/src/components/primitives/theme.test.ts` |
| REQ-DS-36 | §1.2 | First visit follows `prefers-color-scheme`; a stored choice outranks it | `apps/web/src/components/primitives/theme.ts` | `apps/web/src/components/primitives/theme.test.ts` |
| REQ-DS-37 | §1.2 | No flash of the wrong theme — a blocking inline script sets the class before first paint | `apps/web/src/components/primitives/theme.ts` | `apps/web/src/components/primitives/theme.test.ts` |
| REQ-DS-38 | §1.2 | No component branches on theme; `dark:`/`light:` variants and `theme === 'light'` fail the build | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |
| REQ-DS-39 | §1.2 | Canvas renderers resolve tokens via `readToken()` and re-resolve on `cc:themechange` | `apps/web/src/components/primitives/theme.ts` | `apps/web/src/components/primitives/theme.test.ts` |

### §1.3 — data ink

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-40 | §1.3 | `--ink-copper` is `#C9784A` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-41 | §1.3 | `--ink-copper-2` is `#E08A50` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-42 | §1.3 | `--ink-teal` is `#4ECDB0` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-43 | §1.3 | `--ink-coral` is `#E5484D` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-44 | §1.3 | `--ink-coral-2` is `#F06A6D` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-45 | §1.3 | `--ink-lavender` is `#8B8DF0` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-46 | §1.3 | `--ink-lavender-2` is `#A5A7F5` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-47 | §1.3 | `--ink-amber` is `#E5A13C` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-48 | §1.3 | `--ink-blue` is `#6AA1F0` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-49 | §1.3 | Data ink does not swap with the theme — no `--ink-*` override in `body.light` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-50 | §1.3 | Each hue has a `-line` (34%) and `-fill` (12%) tint via `color-mix`, so no component writes an alpha | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-51 | §1.3 | Chrome is monochrome: a data-ink fill or border in `src/app/`, `primitives/`, `shell/` or `chrome/` fails the build | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |
| REQ-DS-52 | §1.3 | No hex, `rgb()`, `rgba()`, `hsl()`, named CSS color or Tailwind default-palette utility outside `tokens.css` | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |
| REQ-DS-53 | §1.3 | Every exemption is explicit (`token-exempt:` / `token-exempt-file:`) and printed on every run | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |
| REQ-DS-54 | §1.3 | Status vocabulary is a single component with a tone prop, not per-feature colors | `apps/web/src/components/primitives/Chip.tsx` | `apps/web/src/components/primitives/Chip.test.tsx` |

### §1.4 — typography

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-55 | §1.4 | Display H1: Plus Jakarta Sans 86px / 700 / −0.028em → `text-display` | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |
| REQ-DS-56 | §1.4 | H1 accent words: Instrument Serif *italic* 91px / 400 / −0.01em → `text-h1-accent font-serif italic` | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |
| REQ-DS-57 | §1.4 | H2: Plus Jakarta Sans 50px / 700 / −1.4px → `text-h2` | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |
| REQ-DS-58 | §1.4 | Body: Plus Jakarta Sans 16px / 400 / line-height 1.6 → `text-body` | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |
| REQ-DS-59 | §1.4 | Small / meta: 12–13px / 400–600 → `text-small` (13px), `text-meta` (12px) | `apps/web/tailwind.config.ts` | `scripts/check-tokens.mjs` |
| REQ-DS-60 | §1.4 | Wide-tracked label: 11–13px / 500 / +0.25em…+0.45em uppercase → `text-label*` + `tracking-wider-1…4` | `apps/web/tailwind.config.ts` | `apps/web/src/components/primitives/Eyebrow.test.tsx` |
| REQ-DS-61 | §1.4 | KPI numeral: 28–32px / 600, tabular-nums → `text-kpi-sm`, `text-kpi`, `text-kpi-lg` | `apps/web/tailwind.config.ts` | `apps/web/src/components/primitives/KpiNumeral.test.tsx` |
| REQ-DS-62 | §1.4 | The four tracking rungs are tokens (`--track-1…4`) so RTL can flatten them in one place | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-63 | §1.4 | Plus Jakarta Sans self-hosted at 400/500/600/700 via `@fontsource` | `apps/web/src/styles/fonts.ts` | manual — `npm run build` emits no `fonts.g*` URL |
| REQ-DS-64 | §1.4 | Instrument Serif self-hosted, 400 upright + 400 italic | `apps/web/src/styles/fonts.ts` | manual — see test plan |
| REQ-DS-65 | §1.4 | IBM Plex Sans Arabic self-hosted at 400/500/600/700 for the Arabic market | `apps/web/src/styles/fonts.ts` | manual — see test plan |
| REQ-DS-66 | §1.4 | Zero external font requests at runtime; no CDN link, no `@import url(https://…)` | `apps/web/src/styles/fonts.ts` | manual — DevTools network panel, third-party domains = 0 |
| REQ-DS-67 | §1.4 | `font-display: swap` on every face (inherited from `@fontsource`) | `apps/web/src/styles/fonts.ts` | manual — computed `@font-face` rules |
| REQ-DS-68 | §1.4 | The Arabic family never falls back to Instrument Serif — no italic serif in Arabic | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-69 | §1.4 | Type literals fail the build: no `text-[13px]`, `tracking-[.3em]`, `fontSize:` or `letter-spacing: <literal>` outside the scale | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |

### §1.5 — shape, depth, texture

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-70 | §1.5 | Pills and buttons are `999px` → `rounded-pill` | `apps/web/src/styles/tokens.css` | `apps/web/src/components/primitives/Pill.test.tsx` |
| REQ-DS-71 | §1.5 | Cards are 12–16px → `rounded-card-sm`, `rounded-card`, `rounded-card-lg` | `apps/web/src/styles/tokens.css` | `apps/web/src/components/primitives/Card.test.tsx` |
| REQ-DS-72 | §1.5 | Drawers and panels are 16–20px → `rounded-panel`, `rounded-panel-lg` | `apps/web/src/styles/tokens.css` | `apps/web/src/components/primitives/GlassPanel.test.tsx` |
| REQ-DS-73 | §1.5 | KPI tiles are 12px → `rounded-kpi` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-74 | §1.5 | Every card is 1px `--line`, `--line-2` on hover | `apps/web/src/components/primitives/Card.tsx` | `apps/web/src/components/primitives/Card.test.tsx` |
| REQ-DS-75 | §1.5 | Dark mode has no shadows except drawers: `0 8px 40px rgba(0,0,0,.5)` | `apps/web/src/styles/tokens.css` | `apps/web/src/components/primitives/Card.test.tsx` |
| REQ-DS-76 | §1.5 | Light mode adds `0 1px 3px rgba(20,20,24,.06)` as `shadow-soft` | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-77 | §1.5 | Dotted-grid texture: radial-gradient dots, `rgba(255,255,255,.04)`, 22px pitch → `.dot-grid` | `apps/web/tailwind.config.ts` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-78 | §1.5 | Starfield parameters exposed: ~200 points, opacity .05–.15 | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-79 | §1.5 | Central galaxy glow: radial-gradient copper→transparent, blur 60px | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-80 | §1.5 | Glass surfaces are `--glass` + `backdrop-filter: blur(14px)` → `.glass` | `apps/web/tailwind.config.ts` | `apps/web/src/components/primitives/GlassPanel.test.tsx` |
| REQ-DS-81 | §1.5 | Primary button: `--copper` bg, `--copper-ink` text, pill, 13px/600 | `apps/web/src/components/primitives/Pill.tsx` | `apps/web/src/components/primitives/Pill.test.tsx` |
| REQ-DS-82 | §1.5 | Secondary button: transparent, 1px `--line-2`, pill | `apps/web/src/components/primitives/Pill.tsx` | `apps/web/src/components/primitives/Pill.test.tsx` |

### §1.6 — motion

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-83 | §1.6 | Section reveal: opacity 0→1 + translateY 12px→0, 500ms `cubic-bezier(.2,.7,.2,1)` | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-84 | §1.6 | Reveal is used for panels and drawers only — never scroll-triggered in the app | `apps/web/src/components/primitives/motion.ts` | review — `fidelity-qa-reviewer` |
| REQ-DS-85 | §1.6 | Map edges relax over 600ms after an `alphaTarget(0.3)` restart | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-86 | §1.6 | Department transition is 700ms ease-in-out | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-87 | §1.6 | Drawer slides 320ms — left for MAP, right for CHART | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-88 | §1.6 | Drawer scrim is `rgba(0,0,0,.4)`, exposed as `--scrim` / `SCRIM`, never an inline literal | `apps/web/src/styles/tokens.css` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-89 | §1.6 | Carousel: perspective 1400px, rotateY ±35°, front scale 1.0, rear 0.82 + brightness(.5) | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/motion.test.ts` |
| REQ-DS-90 | §1.6 | KPI numerals count up over 300ms on mount | `apps/web/src/components/primitives/KpiNumeral.tsx` | `apps/web/src/components/primitives/KpiNumeral.test.tsx` |
| REQ-DS-91 | §1.6 | `prefers-reduced-motion` collapses every duration at the token layer; end states remain | `apps/web/src/styles/tokens.css` | `apps/web/src/styles/tokens.test.ts` |
| REQ-DS-92 | §1.6 | `useReducedMotion()` guards JS-driven motion (count-ups, d3, carousel momentum) | `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/primitives/KpiNumeral.test.tsx` |
| REQ-DS-93 | §1.6 | Hardcoded durations and inline `cubic-bezier` outside `motion.ts` fail the build | `scripts/check-tokens.mjs` | `scripts/check-tokens.mjs` |

### PART I — the shared vocabulary

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DS-94 | PART I | `Pill` — primary / secondary / ghost, 32px and 36px, square variant for shell controls | `apps/web/src/components/primitives/Pill.tsx` | `apps/web/src/components/primitives/Pill.test.tsx` |
| REQ-DS-95 | PART I | `Card` — hairline, three radii, optional hover raise, no shadow | `apps/web/src/components/primitives/Card.tsx` | `apps/web/src/components/primitives/Card.test.tsx` |
| REQ-DS-96 | PART I | `Chip` — 11px / 1px border / 6px radius, seven tones, monochrome default | `apps/web/src/components/primitives/Chip.tsx` | `apps/web/src/components/primitives/Chip.test.tsx` |
| REQ-DS-97 | PART I | `Eyebrow` — 10–11px caps, +0.3em/+0.35em, copper only for "alive" | `apps/web/src/components/primitives/Eyebrow.tsx` | `apps/web/src/components/primitives/Eyebrow.test.tsx` |
| REQ-DS-98 | PART I | `RailLabel` — vertical via `writing-mode`, +0.45em, logical spacing; **defaults to `--ink-2`, `--ink-3` opt-in only** (tokens contract §9.7a — was `--ink-3` by default until 2026-08-16) | `apps/web/src/components/primitives/RailLabel.tsx` | `apps/web/src/components/primitives/RailLabel.test.tsx` · `apps/web/src/test/primitive-color-defaults.test.ts` |
| REQ-DS-99 | PART I | `KpiNumeral` — tabular, tone from the number's meaning, accessible final value | `apps/web/src/components/primitives/KpiNumeral.tsx` | `apps/web/src/components/primitives/KpiNumeral.test.tsx` |
| REQ-DS-100 | §2.0 | `SegmentedControl` — active ivory pill with `--copper-ink` text, inactive `--ink-2`, 11px/+0.25em, arrow-key roving tabindex | `apps/web/src/components/primitives/SegmentedControl.tsx` | `apps/web/src/components/primitives/SegmentedControl.test.tsx` |
| REQ-DS-101 | PART I | `GlassPanel` — `--glass` + blur(14px) + the one dark-mode shadow | `apps/web/src/components/primitives/GlassPanel.tsx` | `apps/web/src/components/primitives/GlassPanel.test.tsx` |
| REQ-DS-102 | PART I | No component library: the whole kit is Tailwind + CSS vars + eight primitives + a 12-line `cx` | `apps/web/src/components/primitives/index.ts` | review — `fidelity-qa-reviewer` |

## Interfaces we expose

- **`apps/web/src/styles/tokens.css`** — every CSS custom property in Part I. Imported
  once by `app/globals.css`. Consume through Tailwind utilities, not `var()` inline.
- **`apps/web/tailwind.config.ts`** — the utility surface. The full index is contract
  `comms/contracts/design-tokens.md` §8. If it is not in that table it does not exist.
- **`@/components/primitives`** — `Pill`, `Card`, `Chip`, `Eyebrow`, `RailLabel`,
  `KpiNumeral`, `SegmentedControl`, `GlassPanel`, `cx`, plus `motion` and `theme`.
- **`@/components/primitives/motion`** — `DURATION`, `SECONDS`, `EASE`, `EASE_ARRAY`,
  `reveal`, `drawer(side)`, `scrim`, `zoom`, `relax`, `countUp`, `carousel`, `SCRIM`,
  `useReducedMotion()`, `prefersReducedMotion()`, `withReducedMotion()`.
- **`@/components/primitives/theme`** — `setTheme`, `toggleTheme`, `useTheme`,
  `resolveTheme`, `readToken`, `THEME_INIT_SCRIPT`, `THEME_CHANGE_EVENT`.
- **`@/styles/fonts`** — side-effect import that self-hosts all three families;
  `FONT_FAMILY` and `FONT_VAR` for canvas/PDF code.
- **`scripts/check-tokens.mjs`** — `npm run validate:tokens`, `--json` for tooling.

## Interfaces we consume

- `comms/contracts/design-tokens.md` — the values. Owned by this agent; frozen.
- `skilltree-clone-spec.md` Part I — the source of those values.
- `comms/decisions/ADR-002-repo-shape.md` — why everything lives under `apps/web`.
- `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`,
  `src/app/layout.tsx`, `src/app/globals.css` — owned by `infra-compose-engineer`.
  We add dependencies by message, never by rewriting the file.

## Test plan

- **Token values** — `tokens.test.ts` parses `tokens.css` and pins all 32 theme values,
  the 9 data-ink hues, every radius, both shadows, the texture and the motion tokens.
  A drifted value fails a named test, not a screenshot diff three milestones later.
- **Primitives** — DOM tests per component asserting the token *utility* is applied
  (`rounded-pill`, `bg-copper`, `tracking-wider-4`), not a computed pixel: jsdom does not
  run Tailwind, and asserting the class is asserting the decision.
- **Motion** — `motion.test.ts` pins every §1.6 number and both curve encodings.
- **Discipline** — `scripts/check-tokens.mjs` in `npm run verify`. This is the only test
  that catches the failure mode we actually fear: someone in a hurry typing a hex.
- **Not automatable here:** that fonts make zero external requests (DevTools network
  panel filtered to third-party — must be empty), that `font-display: swap` reaches every
  face, and the Part VI 1440px side-by-side. Those are `fidelity-qa-reviewer`'s gate;
  §1.4's font requirements are listed as `manual` above rather than pretending otherwise.
- **Runner:** vitest, per-file `@vitest-environment jsdom` docblocks so no shared setup
  file is needed. Deps are not installed yet — see the handoff.

## Deliberately not done

- **`<link rel="preload">` for the critical faces.** `@fontsource` CSS is bundled and the
  woff2 URLs are content-hashed, so a preload tag needs either a `*.woff2` module
  declaration in `apps/web` (infra's file) or a postinstall copy into `/public/fonts`.
  The self-hosting constraint is fully met without it; the preload is a start-render
  optimisation, and guessing at the hashed path would produce a *wrong* preload, which
  is worse than none. Which faces matter is recorded as `PRELOAD_FACES` in `fonts.ts`.
- **A `Watermark` and a `GhostButton` component.** Both were on the shortlist and both
  are one prop on something that already exists: `Eyebrow serif` / `RailLabel serif` is
  the watermark, `Pill variant="ghost"` is the ghost button. Eight primitives, not ten.
- **A theme toggle *control*.** `theme.ts` owns the mechanism; where the switch lives in
  the shell is §2.0 and belongs to `shell-navigation-engineer`.
- **The starfield, galaxy glow and dot-grid renderers.** Only their parameters are here.
  §2.1 canvas work is `map-galaxy-engineer`'s; a token file that also draws is a token
  file nobody can change safely.
- **Framer Motion variants beyond reveal / drawer / scrim.** The carousel spring is
  exposed as numbers rather than a finished variant because §2.4 drag-to-spin needs a
  gesture model that `dashboards-engineer` owns.
- **Light-theme data ink.** The nine hues are identical in both themes on purpose
  (REQ-DS-49). If light-mode contrast turns out to fail WCAG on `--ink-amber`, that is an
  ADR with measured numbers, not a quiet tweak.
- **RTL overrides.** `--track-1…4` and `--track-accent` exist so the RTL layer can flatten
  them; the layer itself is `rtl-arabic-pdpl-specialist`'s (`rtl.css` — not edited from here).
  `--track-accent` is published; they can retire the `letter-spacing: -.01em` exemption.
- **Fixing type literals in other agents' files.** `validate:tokens` currently fails on
  `drawer.module.css`, `sessions.module.css`, and `map/lib/map-type.ts` — their owners'
  files. Messages are filed with the swap. Not patched from here.
