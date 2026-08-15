# CONTRACT — Design tokens

**Owner:** `design-system-guardian` · **Source:** spec Part I (extracted from the live
site's stylesheet — these are their real values, not approximations) · **Status:** frozen

Changing any value here requires an ADR. Adding a *new* token requires a message to the
owner. Consuming code references `var(--name)` only — never a literal.

---

## 1. Dark theme — `:root` (product default)

```css
:root {
  --bg:        #111114;   /* app background */
  --bg-2:      #1B1B21;   /* raised surfaces */
  --bg-3:      #060608;   /* deepest wells: map canvas edge, hero frame */
  --ivory:     #ECECEE;   /* primary text + node fill */
  --ivory-2:   #B2B2B9;   /* secondary text */
  --ink-2:     #84848C;   /* tertiary text / labels */
  --ink-3:     #6B6B73;   /* faint text / disabled */
  --copper:    #ECECEE;   /* accent — dark mode maps copper→ivory for CTAs */
  --copper-ink:#131315;   /* text on copper */
  --line:      rgba(255,255,255,.10);
  --line-2:    rgba(255,255,255,.16);
  --card:      rgba(255,255,255,.025);
  --card-2:    rgba(255,255,255,.05);
  --glass:     rgba(13,13,15,.72);   /* + backdrop-filter: blur(14px) */
  --screen:    #101013;   /* embedded "screen" panels, consoles */
  --screen-2:  #16161A;
}
```

## 2. Light theme — `body.light` (marketing default)

```css
body.light {
  --bg: #F4F4F5;  --bg-2: #ECECEE;  --bg-3: #FFFFFF;
  --ivory: #161618;  --ivory-2: #4C4C54;  --ink-2: #6E6E76;  --ink-3: #8D8D95;
  --copper: #18181B;  --copper-ink: #FFFFFF;
  --line: rgba(20,20,24,.10);  --line-2: rgba(20,20,24,.17);
  --card: #FFFFFF;  --card-2: #EBEBED;
  --glass: rgba(244,244,245,.80);
  --screen: #FFFFFF;  --screen-2: #F4F4F6;
}
```

Theme switch = toggling class `light` on `<body>`. Identical variable names in both
themes; **no component may branch on theme**.

## 3. Data-ink palette (component-level, NOT in `:root`)

These are the only colors permitted outside the monochrome chrome, and only for status,
deltas, charts, and "alive" indicators (§1.3).

They are defined in `apps/web/src/styles/tokens.css` in their own `:root` block,
separate from the chrome block, and they **do not swap with the theme** — a hue that
means "on track" cannot change between light and dark without lying about the data.

| Token | Value | Tailwind | Only for |
|---|---|---|---|
| `--ink-copper` | `#C9784A` | `*-ink-copper` | live-node ring, edge pulse dots, orange satellites |
| `--ink-copper-2` | `#E08A50` | `*-ink-copper-2` | LIVE counter numeral, NAVIGATION eyebrow |
| `--ink-teal` | `#4ECDB0` | `*-ink-teal` | success, "On track", positive deltas, check chips |
| `--ink-coral` | `#E5484D` | `*-ink-coral` | "At risk", stalled, pipeline-by-stage bars |
| `--ink-coral-2` | `#F06A6D` | `*-ink-coral-2` | content area-chart stroke |
| `--ink-lavender` | `#8B8DF0` | `*-ink-lavender` | Meta Ads area fill |
| `--ink-lavender-2` | `#A5A7F5` | `*-ink-lavender-2` | demo chips |
| `--ink-amber` | `#E5A13C` | `*-ink-amber` | warnings, limited-slots chip, approval-pending pulse |
| `--ink-blue` | `#6AA1F0` | `*-ink-blue` | links, HubSpot tint — sparse |

**Derived tints** — every hue above also has a `-line` (34% alpha, via `color-mix`) and a
`-fill` (12%) so a chip or a bar never writes an alpha literal:
`--ink-teal-line`, `--ink-teal-fill`, and the same pair for copper, coral, lavender,
amber and blue. Tailwind: `border-ink-teal-line`, `bg-ink-teal-fill`.

The `--ink-*` name is the enforcement. `scripts/check-tokens.mjs` fails the build on
`bg-ink-teal` / `border-ink-coral` inside a chrome directory (`src/app/`,
`src/components/primitives|shell|chrome/`). Data ink as **text** is always fine;
data ink as a **fill or a border** in chrome is the violation.
`Chip.tsx` carries an explicit, printed `token-exempt-file:` — status chips are the
one sanctioned home for a data-ink fill, and the exemption is visible rather than silent.

**The rule that makes it look expensive:** chrome is monochrome; color is data.
If you are about to color a border, a background, a tab, or an icon that isn't
communicating a status value — stop. That's the violation.

## 4. Typography

Self-hosted: `@fontsource/plus-jakarta-sans`, `@fontsource/instrument-serif`,
`@fontsource/ibm-plex-sans-arabic`. No CDN. One import wires all three —
`import '@/styles/fonts'` in `app/layout.tsx`; do not import `@fontsource/*` anywhere
else, or the weight set drifts per file.

| Role | Font | Size / weight / tracking |
|---|---|---|
| Display H1 | Plus Jakarta Sans | 86px / 700 / −2.4px (−0.028em) |
| H1 accent words | **Instrument Serif italic** | 91px / 400 / −0.01em |
| H2 | Plus Jakarta Sans | 50px / 700 / −1.4px |
| Body | Plus Jakarta Sans | 16px / 400 / 1.6 |
| Small / meta | Plus Jakarta Sans | 12–13px / 400–600 |
| Wide-tracked label | PJS or Instrument Serif caps | 11–13px / 500 / **+0.25em…+0.45em**, uppercase |
| KPI numeral | Plus Jakarta Sans | 28–32px / 600, `font-variant-numeric: tabular-nums` |

*The italic serif word inside a bold sans headline is the brand signature.* Use it in
headers and rail/watermark labels; never in body copy, never in Arabic.

## 5. Shape & depth

- Radii — pills/buttons `999px`; cards `12–16px`; drawers/panels `16–20px`; KPI tiles `12px`.
- Every card: `1px solid var(--line)`; hover → `--line-2`.
- Dark mode has **no shadows** except drawers: `0 8px 40px rgba(0,0,0,.5)`.
  Light mode: `0 1px 3px rgba(20,20,24,.06)`.
- Dotted-grid canvas texture: radial-gradient dots, `rgba(255,255,255,.04)`, ~22px pitch.
- Starfield: ~200 random 1px points at opacity .05–.15 + central galaxy glow
  (radial-gradient copper→transparent, blur 60px).
- Glass surfaces: `background: var(--glass); backdrop-filter: blur(14px)`.
- Buttons — primary: `--copper` bg / `--copper-ink` text / pill / 13px 600.
  Secondary: transparent / `1px var(--line-2)` / pill.

## 6. Motion

| Where | Spec |
|---|---|
| Section reveal | opacity 0→1 + translateY 12px→0, 500ms `cubic-bezier(.2,.7,.2,1)` — app uses it for panels/drawers **only** |
| Map nodes | d3-force spring on drag, `alphaTarget(0.3)` restart; edges relax ~600ms |
| Department transition | d3-zoom transform, 700ms ease-in-out + label cross-fade |
| Drawer | slide-in 320ms (left for map, right for chart); scrim `rgba(0,0,0,.4)` |
| Carousel | `perspective(1400px) rotateY(±35°)`, drag-to-spin with momentum; front scale 1.0, rear 0.82 + `brightness(.5)` |
| Mount | KPI numerals count up 300ms; progress bars animate width |

Respect `prefers-reduced-motion`: kill the idle galaxy rotation, edge pulses, count-ups,
and carousel momentum; keep instantaneous end states.

## 7. Tailwind wiring (the one approved consumption pattern)

```js
// tailwind.config.js
colors: {
  bg: 'var(--bg)', 'bg-2': 'var(--bg-2)', /* …one entry per token above… */
}
```
Then `bg-bg-2`, `text-ink-2`, `border-line`. A raw hex in a component is a review
failure — `fidelity-qa-reviewer` greps for `#[0-9a-fA-F]{6}` outside `tokens.css`.

---

## 8. The utility index — what to actually type

Implemented in `apps/web/tailwind.config.ts`. If a value you need is not in this list,
it does not exist yet: send a `decision-request`, do not write an arbitrary value.

| Kind | Utilities |
|---|---|
| Chrome color | `bg-bg` `bg-bg-2` `bg-bg-3` `bg-card` `bg-card-2` `bg-screen` `bg-screen-2` `bg-glass` `text-ivory` `text-ivory-2` `text-ink-2` `text-ink-3` `bg-copper` `text-copper-ink` `border-line` `border-line-2` `bg-scrim` |
| Data ink | `text|bg|border|fill|stroke-ink-{copper,copper-2,teal,coral,coral-2,lavender,lavender-2,amber,blue}` + `-line` / `-fill` tints |
| Type | `text-display` `text-h1-accent` `text-h2` `text-body` `text-small` `text-meta` `text-label` `text-label-sm` `text-label-lg` `text-kpi` `text-kpi-sm` `text-kpi-lg` `text-pill` `text-chip` |
| Tracking | `tracking-display` `tracking-h2` `tracking-accent` `tracking-kpi` `tracking-wider-1` (.25em) `-2` (.3em) `-3` (.35em) `-4` (.45em) |
| Family | `font-sans` `font-serif` `font-arabic` |
| Radius | `rounded-pill` `rounded-chip` `rounded-kpi` `rounded-card-sm` `rounded-card` `rounded-card-lg` `rounded-panel` `rounded-panel-lg` |
| Depth | `shadow-drawer` `shadow-soft` `backdrop-blur-glass` `.glass` |
| Texture | `.dot-grid` `bg-galaxy-glow` |
| Rails | `.rail-up` `.rail-down` |
| Motion | `duration-reveal` `duration-drawer` `duration-relax` `duration-zoom` `duration-count` `duration-hover` · `ease-reveal` `ease-drawer` `ease-zoom` |
| Layering | `z-canvas` `z-overlay` `z-chrome` `z-scrim` `z-drawer` `z-toast` |

Type sizes carry their own weight, leading and tracking. `text-h2` is the whole
decision — do not add `font-bold` or `tracking-tight` next to it.

### 8a. Tokens added by the owner beyond Part I

Part I does not name these; they exist because thirteen agents would otherwise each
invent their own. Values are the owner's, not the spec's, and are marked as such in
`tokens.css`.

| Token | Value | Why |
|---|---|---|
| `--dur-hover` | `160ms` | §1.6 defines no hover timing; without a token every card picks a different one. |
| `--track-1…4` | `.25em` `.3em` `.35em` `.45em` | The §1.4 tracking band as tokens, so the RTL layer flattens all four in one place (Arabic must never be tracked). |
| `--track-accent` | `-0.01em` | §1.4 H1 accent tracking. Named so `.u-accent` / `tracking-accent` never write a literal; Arabic never uses it. |
| `--r-*`, `--border-w`, `--blur-glass`, `--dot-*`, `--star-*`, `--galaxy-glow*`, `--scrim`, `--carousel-*` | see `tokens.css` | §1.5/§1.6 prose values, named so they are greppable. |
| `--font-sans/serif/arabic` | see `tokens.css` | §1.4 families, including IBM Plex Sans Arabic. |
| `z-*` scale | canvas/overlay/chrome/scrim/drawer/toast | Not a Part I concern; a cross-agent one. |

### 8b. Enforcement

`node scripts/check-tokens.mjs` (wired to `npm run validate:tokens` and `npm run verify`).
It fails on: any hex / `rgb()` / `rgba()` / `hsl()` / named CSS color or Tailwind default
palette utility outside `tokens.css`; any `text-[…]` / `tracking-[…]` / `fontSize:` /
`letter-spacing: <literal>`; any hardcoded duration or `cubic-bezier` outside `motion.ts`;
any data-ink fill or border in a chrome directory; any `dark:` / `light:` variant or
`theme === 'light'` branch.

Escape hatch: `/* token-exempt: <reason> */` (that line or the next) and
`/* token-exempt-file: <reason> */` (first 30 lines). Every exemption is printed on every
run — an exemption you have to read out loud in CI is a decision, a silent one is rot.

### 8c. Motion and theme in JavaScript

- `apps/web/src/components/primitives/motion.ts` — `DURATION`, `SECONDS`, `EASE`,
  `EASE_ARRAY`, `reveal`, `drawer(side)`, `scrim`, `zoom`, `relax`, `countUp`, `carousel`,
  `SCRIM`, `useReducedMotion()`, `prefersReducedMotion()`, `withReducedMotion()`.
  It is the only module permitted to type a duration number.
- `apps/web/src/components/primitives/theme.ts` — `setTheme`, `toggleTheme`, `useTheme`,
  `resolveTheme`, `THEME_INIT_SCRIPT` (no-flash inline script), `THEME_CHANGE_EVENT`,
  and `readToken(name)` for `<canvas>`, which cannot read a CSS variable. Canvas
  renderers must re-resolve on `cc:themechange` and must not cache across a flip.
