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

Picking between `text-ivory-2` / `text-ink-2` / `text-ink-3` is **not** a matter of taste —
see **§9**, which gives each one a role and a measured contrast floor. Short version:
`text-ink-3` is never required reading.

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

**There is exactly one token instrument.** `npm run validate:tokens` *is*
`node scripts/check-tokens.mjs` — the same process, not a second opinion. No other file in
this repo implements a token rule. If two token results ever disagree, they are two runs of
this one script at different times, and the difference is the tree, not the tooling.

Every run therefore prints what it was a result **about**:

```
Token discipline
  scanned at        2026-08-16 22:44 +03:00 · 56e93cf · 44 uncommitted under apps/web
  files scanned     291
  violations        0
```

Added 2026-08-16 after a reported "`validate:tokens` says 31, `check-tokens` says 0" turned
out to be one instrument run hours apart while `drawer.module.css` was mid-cleanup from
literal `font-size:` values to `--drw-fs-*` tokens — the `no-type-literal` count decayed
38 → 37 → … → 0 as the fix landed. Neither output could be dated, so a stale result was
indistinguishable from a current one. **Quote the `scanned at` line whenever you cite a
token result in a review, a handoff or a message.** A count without it is not evidence.
`scripts/lib/provenance.mjs`, pinned by `scripts/__tests__/provenance.test.mjs`.

**The timestamp is local wall clock with an explicit offset, and both halves are required.**
The first version printed `toISOString()` — UTC with the `Z` sliced off. On this UTC+3 host a
scan run *at that instant* printed `19:31` beside a message stamped `22:31`. Reported by
`map-galaxy-engineer` 2026-08-16 after holding the number against a clock, which is the only
instrument that could have found it.

That was this section's own disease, in the line written to cure it: §8b exists because a
stale result was indistinguishable from a current one, and an unlabelled foreign-zone
timestamp puts that ambiguity straight back — a fresh result reads three hours old, so the
honest reader re-runs work that was already done, and `fidelity-qa-reviewer` now quotes this
line on every verdict while BOARD's Evidence column depends on it. The fix is therefore two
requirements, not one:

- **Local**, because every other timestamp in this repo is local — message filenames,
  `created:` frontmatter, BOARD entries. A reader compares this against the clock on their
  wall or the `created:` two lines above it. A number needing arithmetic will not be compared.
- **With its offset**, because "local" is a property of the machine that scanned, not of the
  person reading the quote a day later on another host. CI runs UTC; this host runs `+03:00`.
  Without the offset the fix would only relocate the ambiguity.

**Relative age ("3m ago") was considered and rejected.** A banner printed by the run itself
would always say `0m ago`, and that zero freezes into every quotation of it — true for one
second, misleading for as long as the file exists. Consumers that want an instant read
`provenance().iso` (full ISO-8601 with offset); nothing should ever parse the display string.

**The test pins the property, not the format.** `provenance.test.mjs` re-runs the helper in
three fixed-offset zones (`UTC`, `Asia/Riyadh` +03, `Pacific/Honolulu` −10) as child processes
with `TZ` forced, because a timezone bug is invisible from inside the timezone that has it,
and asserts three things: **(a)** the printed clock is the clock of the machine that ran the
scan; **(b)** the string resolves to one instant for readers in all three zones; **(c)** a
scan run now reads as minutes old, not hours, *from every reader zone* — not from a
conveniently chosen one, since UTC digits read by a UTC reader are correct and the incident
was a +03 reader. Any format satisfying (a)–(c) may be adopted without touching the tests.
Verified by mutation: restoring the `toISOString()` line turns six of the ten tests red.

The helper is also hardened against the thing that happened to it — a dependency of four
scripts, shipped the day it was written, wrong in a way only a human clock caught. `git` is
called with `GIT_OPTIONAL_LOCKS=0` (a read-only observer must not take the index lock),
`GIT_TERMINAL_PROMPT=0` and a 5s timeout (a banner may not deadlock a build), and the two
git-less failures are now told apart: **no `.git` at all** prints `no git`, **a repo with no
commit yet** prints `no commit`, because they send a reader to different places and the file
whose job is telling results apart may not blur its own.

### 8c. Motion and theme in JavaScript

- `apps/web/src/components/primitives/motion.ts` — `DURATION`, `SECONDS`, `EASE`,
  `EASE_ARRAY`, `reveal`, `drawer(side)`, `scrim`, `zoom`, `relax`, `countUp`, `carousel`,
  `SCRIM`, `useReducedMotion()`, `prefersReducedMotion()`, `withReducedMotion()`.
  It is the only module permitted to type a duration number.
- `apps/web/src/components/primitives/theme.ts` — `setTheme`, `toggleTheme`, `useTheme`,
  `resolveTheme`, `THEME_INIT_SCRIPT` (no-flash inline script), `THEME_CHANGE_EVENT`,
  and `readToken(name)` for `<canvas>`, which cannot read a CSS variable. Canvas
  renderers must re-resolve on `cc:themechange` and must not cache across a flip.

---

## 9. Text legibility — which grey, and the floor under it

Ruled 2026-08-16 by the owner, after `fidelity-qa-reviewer` found the same defect
independently in `drawer.module.css`, `dashboards.module.css` and `KpiTile.tsx`. Three
agents reaching for the same wrong token is not three mistakes; it is a missing rule.
This section is that rule. **Answer questions about text colour by reading this table, not
by re-measuring.**

### 9.1 Measured contrast — every text token on every surface token

WCAG 2.1 contrast, computed against all eight surface tokens in both themes
(`--bg` `--bg-2` `--bg-3` `--card` `--card-2` `--screen` `--screen-2` `--glass`;
the alpha surfaces composited over `--bg`). The worst case is `--card-2` in every row.

| Token | Dark | Light | Verdict at 11–16px (AA needs **4.5:1**) |
|---|---|---|---|
| `--ivory` | 14.25 – 17.16 | 15.18 – 18.07 | passes AAA everywhere |
| `--ivory-2` | 7.98 – 9.60 | 7.14 – 8.51 | passes AAA everywhere |
| `--ink-2` | 4.53 – 5.46 | 4.25 – 5.05 | passes AA — **except** light `--bg-2` (4.28) and light `--card-2` (4.25) |
| `--ink-3` | 3.18 – 3.83 | 2.77 – 3.29 | **fails AA on every surface, in both themes** |

This product ships no text at or above 18.66px/24px, so the large-text 3:1 exemption never
applies. There is no size at which `--ink-3` is legible enough to carry meaning.

### 9.2 The rule

> **Any text the reader must read in order to understand the screen is `--ink-2` or
> brighter. `--ink-3` is never required reading.**

"Must read in order to understand the screen" is deliberately broad, and it includes the
cases people talk themselves out of:

- **Honest empty states** — "No runs yet", "No figure yet", "No rows." BOARD rule 9 puts
  these on screen *instead of* a plausible fake number. They are the product's honesty made
  visible; rendering them in the disabled colour is the design quietly retracting the rule
  the copy exists to satisfy.
- **Provenance caveats** — "10 of 121 runs unpriced". The sentence whose whole job is to say
  the figure above it is a **floor, not a total**. If the caveat is less legible than the
  number it qualifies, the tile is more confident than the data.
- **Error and degraded-state sentences** — "Couldn't reach the runner, so this list is empty
  rather than wrong."
- **Any hint that appears nowhere else on the screen.**

### 9.3 What each token is actually for

| Token | Role | Use it for | Never |
|---|---|---|---|
| `--ivory` | primary | values, headings, node fill, the thing you came to read | — |
| `--ivory-2` | secondary | body copy, prose paragraphs, sustained reading | — |
| `--ink-2` | tertiary / quiet-but-required | wide-tracked caps, eyebrows, section titles, column heads, meta, **and every sentence in §9.2** | — |
| `--ink-3` | faint / disabled | disabled controls, `::placeholder`, decorative separator glyphs (`·` `/`), a rail cap that repeats the heading beside it (**opt in with `tone="faint"`** — §9.7a), a label that is redundant with its own position | any sentence; any caveat; any empty state; anything with no second copy on screen |

**The test, when it is genuinely unclear:** delete the text. If the reader now
misunderstands the screen, or believes a number that is not true, it is required reading and
it is `--ink-2` at minimum. If they merely lose a decoration, `--ink-3` is fine.

### 9.4 The floor is a floor, not a target

`--ink-2` is the **minimum**, not the answer. §9.2 says required prose may not go below it;
it does not say prose belongs there. Two further rules decide where above the floor a given
sentence sits.

**9.4a — A caveat sits one rung below the value it qualifies.** A provenance caveat
("unpriced", "10 of 121 runs unpriced") must be quieter than the figure it modifies, or it
competes with the number instead of qualifying it. One rung, not two.

**A ruling under 9.4a must name the file and line of the value being qualified.** "One rung
below" is meaningless until the rung the value sits on has been read, and this rule has now
been mis-applied twice — both times the rule was right and the measurement of the specific
site was wrong (`.runMetaAbsent`, and `KpiTile`'s caveat, below). Both would have been caught
by one grep. So the citation is part of the ruling, not evidence for it: a 9.4a instruction
that does not say *which line* it measured has not been made yet. `fidelity-qa-reviewer`'s
suggestion, adopted verbatim, and it is the same discipline as §9.4's own drafting note —
where a rule cites a measurement of a call site, the call site must be identified, because
call sites drift and tokens do not.

**Ratified 2026-08-16 — `KpiTile`'s unpriced caveat is `--ivory-2`, and my `--ink-2`
instruction was wrong twice.** `dashboards-engineer` landed `--ivory-2`
(`apps/web/src/dashboards/components/KpiTile.tsx:60`) against a standing instruction and filed
a `decision-request` rather than smuggling it, which is the behaviour this protocol wants.
Their measurement is correct and mine was asserted without opening the file: the value being
qualified is `KpiNumeral` at `tone="default"`
(`apps/web/src/components/primitives/KpiNumeral.tsx:54`) → `text-ivory`, so one rung below is
`--ivory-2` and `--ink-2` is two. It is also the shape I landed in the drawer *after* issuing
the `--ink-2` instruction — `.runMeta` `--ivory` / `.runMetaAbsent` `--ivory-2` — so the
departure is what is consistent with where I ended up, and the instruction was the outlier.

The boundary that makes both answers right in their own place: **§9.4's "an empty state at
secondary weight out-shouts its peers" argument is about absence in a grid of tiles.** That
case in the same module is `.emptyLine` ("No figure yet.") and it stays `--ink-2`. A caveat
rides a figure that is *present* and cannot out-shout a numeral a rung brighter and three
times the size. Both clear AA on `--card` in both themes, and `KpiTile`'s card is not
interactive, so §9.5 does not reach it either. `dashboards-contrast.test.ts` pins it.

**9.4b — When 9.4a collides with the floor in §9.2, raise the value. Never lower the
caveat.** This is the rule that decides the collision, and it only points one way: the caveat
is required reading and cannot go below AA, so the gap has to be opened from above. If the
figure is already at `--ink-2`, the fix is to promote the figure to `--ivory-2` or `--ivory`
— not to push the caveat down to `--ink-3`, which §9.2 forbids outright.

**Why `--ivory-2` is not the default for empty states.** It was considered and rejected for
the KPI-row case specifically: an empty state at secondary-text weight becomes the *loudest*
element in a row of tiles, so an absent value out-shouts the tiles that have real ones. Rule 9
asks the empty state to be honest, not loud. That argument is about **empty states in a grid
of peers**; it is not a general claim that `--ink-2` is correct everywhere, and 9.4a/9.4b
govern when it is not.

> **Correction, 2026-08-16T21:40.** This section previously read *"`--ink-2` puts the sentence
> … one rung below any real value, which is the true hierarchy."* **That was false, and it was
> false in the file the rule was being applied to.** `drawer.module.css` renders `.runMeta` —
> the dollar figures — in `--ink-2`, so moving the "unpriced" caveat to `--ink-2` put the
> caveat at the *same* weight as the figures rather than one rung below, producing exactly the
> flattening the sentence claimed to prevent. Found by `fidelity-qa-reviewer` and
> `drawer-engineer` independently. Re-ruled in §9.4b above.
>
> The drafting error is worth more than the fix. The sentence stated a **description** — "this
> is the hierarchy" — where it should have stated a **requirement** — "this must be the
> hierarchy". A description is a measurement, and a measurement in a contract is a claim
> someone will cite instead of re-checking. §9 exists to stop people picking colours by eye;
> it cannot do that while justifying itself with a number nobody verified. **Contract rules
> state what must be true. Where a rule cites a measurement, the measurement is of a token,
> never of a call site** — token values are stable and checkable, call sites drift.

### 9.5 The known gap — light `--ink-2` on `--bg-2` / `--card-2`

`--ink-2` in light (`#6E6E76`) measures **4.28:1 on `--bg-2`** and **4.25:1 on `--card-2`** —
short of AA by about 5%. Printed here rather than left to be rediscovered.

Two consequences, both binding:

1. **Required prose at `--ink-2` must not sit on `--bg-2` or `--card-2`.** Read the next
   paragraph before assuming this is rare.

   **`--card-2` is the standard hover fill for every interactive row and card in this
   product** — `Card interactive`, `.runRow:hover`, `.control:hover`, the drawer's ladder and
   console rows. So any required sentence rendered at `--ink-2` inside a hoverable row is
   sub-AA *while hovered*, in light, which is the moment the reader is most likely to be
   reading it. **This is the common case, not the exotic one.** When prose lives in a
   hoverable row, `--ink-2` is not sufficient: use `--ivory-2` (7.14:1 worst case light).

   > This paragraph replaces an earlier version that said "the only way to hit this today is
   > to put an empty state inside a `Card interactive`" and told `drawer-engineer` their
   > drawer did not do that. `drawer.module.css:524-526` does exactly that. Second false
   > measurement of a call site in this section; see the drafting note in §9.4.

2. The real fix is to darken light `--ink-2` from `#6E6E76` to **`#6A6A72`**, which clears
   4.5:1 on every light surface (worst case `--card-2`, 4.503:1) and is a four-unit shift
   nobody will see. That value is **transcribed verbatim from the spec of record (§1.2)** so
   it needs an ADR rather than an edit. **[ADR-011](../decisions/ADR-011-light-ink-2-aa-floor.md)
   — proposed**, filed once this gap had forced a contorted ruling twice.

### 9.6 Enforcement

`scripts/check-tokens.mjs` **cannot** check this, and pretending otherwise would be worse
than admitting it: no static rule distinguishes "a sentence the reader needs" from "a
decorative glyph". `text-ink-3` is legal and will stay legal, because §9.3 has genuine homes
for it. This section is enforced in review by `fidelity-qa-reviewer` and by the owner, using
the delete-the-text test in §9.2. The grep that *starts* the conversation:

```powershell
Select-String -Path apps/web/src -Include *.tsx,*.css -Pattern 'ink-3' -Recurse
```

Every hit must be answerable with one of the four "use it for" cases in §9.3.

### 9.6a The one thing about §9 that *is* mechanical — default props

**A default prop is a token spent at a call site that never mentions it.** That sentence is
`fidelity-qa-reviewer`'s, and it names the one hole in §9.6's honest admission: the grep
above, `check-tokens.mjs`, my own fourteen-site enumeration and the review are all **text
searches over call sites**, so none of them can see a colour chosen inside a primitive and
inherited in silence. `<RailLabel>{title}</RailLabel>` rendered required reading at 2.77:1
while containing no string any search for `ink-3` could match. It shipped twice, in two
directories, past three readers.

That specific class *is* checkable without judging whether a string is required reading, so
it is now checked: **`apps/web/src/test/primitive-color-defaults.test.ts`**, adopted into this
contract 2026-08-16, written and offered by `map-galaxy-engineer`. It is the second instrument
in this contract and the boundary against §8b's "there is exactly one token instrument" is
exact: `check-tokens.mjs` remains the **only** judge of token literals — hex, durations,
arbitrary values, data ink in chrome — and this file rules on nothing it rules on. It answers
one different question no text search can: *does a primitive's default resolve to a text token
that fails AA, and if so does every call site say out loud which tone it wanted?*

Three properties are binding on any future version of it, because each was a decision:

1. **It derives which primitives to guard by parsing their source**, not from a list. The
   frozen `const MAP = {…} as const` + destructured-default shape every primitive here already
   uses is what makes that possible. A new sub-AA default is caught the day it lands even if
   nobody remembers this file exists. Keep the shape, or fix the deriver — a refactor that
   silently returns nothing is a green suite that checks nothing.
2. **It never judges whether a string is required reading.** §9.6 is right that no static rule
   can. `tone="faint"` written out loud satisfies it; the judgement stays with §9.2's
   delete-the-text test in review. It forbids only *spending the token by silence*.
3. **The known-offender list is a subset assertion, and it is now empty.** A fix must never
   break the guard that asked for it. The one entry — `RailLabel.tone` — was removed by §9.7
   rather than by an exemption, and an empty list is the strongest state the file can be in.

One correction was made on adoption, and it is the same disease the file exists to catch: its
self-check proved the deriver worked *by requiring the known defect to still be present*
(`expect(railLabel.props).toContain('tone')`), so it would have gone red on the fix it asked
for. It now mutates the real primitive back to its old default and requires the flag to
appear — same coverage of the parsing shape, no dependency on anything being broken.

### 9.7 Where §9 supersedes a token the spec names, and where it does not

Two things forced this section on the same evening: a primitive whose default was the defect,
and `fidelity-qa-reviewer` pointing out that §9 has been quietly overriding a value printed in
the spec of record with no written trace. Both are the same question — *when does the floor
beat a named token* — so they are answered in one place.

**9.7a — `RailLabel`'s default is `muted` (`--ink-2`). Ruled 2026-08-16; it was `faint`.**
`apps/web/src/components/primitives/RailLabel.tsx:28`. Requested by `map-galaxy-engineer`,
seconded by `dashboards-engineer`, and granted on their argument rather than on mine.

The evidence is quantitative and it is what decided it. Every other primitive default in the
repo resolves at or above the floor — `Chip` → `text-ivory-2`, `KpiNumeral` and `Pill` →
`text-ivory`, `Eyebrow` → `text-ink-2` (on the floor, legal per §9.2), `Card`/`GlassPanel`/
`SegmentedControl` spend no text colour at all. `RailLabel` was **the only primitive in the
repo defaulting below AA**, and it was **0-for-4 at shipped call sites**: all four wanted a
non-default tone, none wanted `faint`. One component out of step with four siblings, and the
one out of step is the one that produced the bug.

The decisive argument is asymmetry, not aesthetics: **a wrong `muted` gets caught in review; a
wrong `faint` ships at 2.77:1 past three readers** — which is exactly what happened, twice,
in one evening. Where a default can be wrong in both directions, silence must resolve to the
recoverable one.

`faint` is **not** deprecated and nothing in the repo needs an explicit tone as a result: zero
shipped sites use it. §9.3's home for it stands — *a rail cap that repeats the heading beside
it* — and that home is now entered by writing `tone="faint"`, which is one word and a decision
a reviewer can see. The two sites that state `tone="muted"` keep saying so, because the
paragraphs above them are rulings about those specific rails.

**9.7b — Where the spec of record names `--ink-3` for an element §9 calls required reading,
§9 wins; everywhere else the spec's value stands.** Raised by `fidelity-qa-reviewer` against
spec line 184 (§2.5.6), verbatim: *"Vertical rail labels on both edges (rotated 90°,
wide-tracked caps, `--ink-3`)"*. `dashboards-engineer` ships those at `--ink-2` and I agree —
those rails name the *neighbouring dashboard* and are the only visible signal that the screen
edges are navigation, so §9.2's delete-the-text test makes them required reading and §9.3's
"repeats the heading beside it" carve-out does not reach them.

The rule, stated once so nobody re-derives it per element:

> Where the spec names a text token and §9's floor contradicts it, **§9 wins for required
> reading only.** The spec's value stands wherever one of §9.3's four homes genuinely
> applies. §9 does not overwrite the spec everywhere, and the boundary is the
> delete-the-text test, not the element type.

The interesting half is that this boundary has already cut both ways: §2.3.9's ladder label is
also spec-named `--ink-3` and I ruled it **stays** `--ink-3` under §9.3, because it is
redundant with its own position. Same token, same spec, opposite answers, one test.

Known superseded values, and this list is the trace — extend it, do not re-argue it:

| Spec | Element | Spec says | Ships as | Why |
|---|---|---|---|---|
| line 184 (§2.5.6) | DASHBOARDS edge rails | `--ink-3` | `--ink-2` | names the neighbouring dashboard; only signal the edges are navigation |
| §2.2 | MAP department rails | *(unnamed)* | `--ink-2` | names the adjacent departments; appears nowhere else |
| §2.3.9 | drawer ladder label | `--ink-3` | `--ink-3` | **not superseded** — redundant with its own position (§9.3) |

**This is a contract note, not yet an ADR, and that is stated rather than hidden.** CLAUDE.md
says the spec wins until an ADR says otherwise, and `fidelity-qa-reviewer` is right that a
spec value overridden with no written record is how a spec quietly stops being the spec of
record — the precedent is mine, from §9.5, where I refused to darken light `--ink-2` for
exactly this reason. The ADR is owed. It is not filed here because ADR numbers are allocated
by `commandcenter-orchestrator` before the file is written (BOARD, "claim the row before you
write the file" — 012 is deliberately vacant because two agents once computed the same next
free number), and taking one unilaterally at 22:5x with several agents live is the failure
that rule exists to prevent. Number requested; this section is the content, and the ADR will
transcribe it. Annotating spec line 184 itself is part of that request — a reader who opens
it today gets a value the product does not implement with nothing pointing at why.

**9.7c — Check contracts against the spec, not only code against contracts.** Three agents
independently reached for `--ink-3` for empty states, and §9's opening line calls that a
missing rule. It was worse and better than that: `dashboards-engineer` found that
`comms/contracts/panel-schema.md` rule 2 *prescribed* it — *"empty state (`--ink-3`, one
line)"* — and corrected it. One of the three was not guessing; they were obeying. A wrong
contract is more expensive than a wrong component by exactly the number of agents who read it,
and it is invisible to every checker in this repo, all of which read code. So: **when a rule
here is ruled, grep the other contracts for the value it just outlawed.** That grep is one
command and it is the only instrument that finds this class at all.
