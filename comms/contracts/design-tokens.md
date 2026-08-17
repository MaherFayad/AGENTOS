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

**Verified by mutation, by the owner, 2026-08-16 23:5x at `4e0bbe6`.** Restoring the
`toISOString()` stamp turns the suite red, and (c) — *a scan run now does not look old* — is
the assertion that carries the incident:

```
✖ a scan run now does not look old to a reader in any zone
  scanned under TZ=UTC, read from Asia/Riyadh: "2026-08-16 20:49" reads as
  181 minutes old the moment it was produced.
```

Seven of the ten go red, not six as this line said until it was measured. The count is
printed with its date and its commit because it is a measurement of a suite, and a suite
drifts — §9.4's drafting note applies to this section too. **The property is the requirement;
the count is an observation.** If a future run reports a different number and (a)–(c) are
still red under the mutation, the property holds and this number is stale — re-measure it,
do not weaken the test to match it.

The helper is also hardened against the thing that happened to it — a dependency of four
scripts, shipped the day it was written, wrong in a way only a human clock caught. `git` is
called with `GIT_OPTIONAL_LOCKS=0` (a read-only observer must not take the index lock),
`GIT_TERMINAL_PROMPT=0` and a 5s timeout (a banner may not deadlock a build), and the two
git-less failures are now told apart: **no `.git` at all** prints `no git`, **a repo with no
commit yet** prints `no commit`, because they send a reader to different places and the file
whose job is telling results apart may not blur its own.

**The banner reports two dirtiness figures, and the second one is the instrument. Added
2026-08-17 by the owner** on `commandcenter-orchestrator`'s decision-request, from M15's
re-gate. `check-tokens.mjs` scopes to `apps/web`, so a run made with `scripts/check-rtl.mjs`
modified printed:

```
scanned at        2026-08-17 20:34 +03:00 · eaca677 · clean
```

The scoping decision is right and stays — dirtiness is reported for the scanned scope, since
that is what can invalidate the result. **The exception is the one file the scope cannot
contain.** §8b exists so a number can be *re-derived*, and re-derivation has two inputs: the
scanned tree, and the checker that scanned it. A modified checker changes the number without
changing a single scanned file, so `clean` was precisely wrong in the one case this section was
written for — a declared value read as an observed one, on the instrument that exists to stop
exactly that. It now reads:

```
scanned at        2026-08-17 22:00 +03:00 · 8a9bdf5 · clean · checker modified under scripts
```

**Two figures, not one wider figure, and the reason is about readers rather than correctness.**
Widening `scope` to the whole repo was the obvious fix and was rejected: every banner would then
read dirty on an unrelated `comms/` edit, which trains people to skip the field — worse than the
bug, because a field nobody reads fails silently. The instrument clause keeps the existing
sentence meaning exactly what it already meant and adds the one thing it could not say. An
**unscoped** run (`check-metrics`) already counts `scripts/` in its own figure and prints no
clause; saying it twice would be noise dressed as rigour.

**Falsified, not reasoned.** `provenance.test.mjs` builds a repo with `src/` and `scripts/`,
commits it, and asserts both directions: a clean checker says nothing, and a checker modified
while *the scanned scope is untouched* produces `clean · checker modified under scripts` — the
exact shape of the incident. Deleting the clause turns that test red. A clause that is always
on is a clause nobody reads, so the silent direction is asserted as hard as the loud one.

### 8b.1 What `check-tokens` can and cannot see about **rule 1** — measured, not assumed

**Ruled 2026-08-17 by the owner**, on `commandcenter-orchestrator`'s question, which came out of
M15's verdict. The question was *"should §1.3 become mechanical, and is it your gate or a new
one?"* — and answering it required correcting the premise, because **the premise was wrong in the
safe direction, which is the direction that goes uncorrected.**

BOARD says `check-tokens` *"does not catch a data-ink token applied to chrome
(`border-ink-teal`, `focus-visible:ring-ink-copper`)."* **It does.** The `chrome-is-monochrome`
rule has existed since the checker was written. Falsified today rather than read:

```
FAIL  apps/web/src/components/primitives/AddressBadge.tsx:142
      [chrome-is-monochrome] data ink on chrome: "border-ink-teal"
FAIL  apps/web/src/components/primitives/AddressBadge.tsx:142
      [chrome-is-monochrome] data ink on chrome: "ring-ink-copper"
```

Both of BOARD's own examples, planted and caught. **The real gap is narrower, and it is a
different shape:**

> **The rule runs only inside `CHROME_DIRS`** — `app/`, `components/primitives|shell|chrome/`.
> Planted in `drawer/sections/Header.tsx` as real code rather than a comment,
> `border-ink-teal bg-ink-coral-fill` produced **0 violations**.

**Widening it was refused on 2026-08-17, and that refusal was overturned on 2026-08-18.** The
refusal argued that `map/`, `drawer/`, `dashboards/`, `chart/` and `sessions/` each contain both
chrome and data ink legitimately, so a rule firing on the legitimate half would be exempted into
meaninglessness — `Chip.tsx`'s exemption generalised to five directories, which is a repeal rather
than an exemption.

**`fidelity-qa-reviewer` overturned it with an argument the refusal had no answer to, and it is
worth keeping in full because the shape recurs:** *"an include-list cannot see a directory that
does not exist yet."* Demonstrated on the tree that carried the finding —
`apps/web/src/app/(views)/p/[project]/threads/` and `dashboards/components/ThreadFeed.tsx` were
created **during** the review, and `drawer/` had never been covered at all. The failure mode was
never that someone widens the list badly; it is that **nobody remembers the list exists**. The
refusal was answering the wrong risk.

#### 8b.2 The rule is now a deny-list — chrome by default, exceptions named and printed

`CHROME_DIRS` is retired. `chrome-is-monochrome` runs over **all of `apps/web/src/`** except the
directories named in `DATA_INK_DIRS`, each with its reason, **all printed on every run** under
`rule 1 scope` / `not-chrome`. A directory created tomorrow is chrome by default, which is what
§1.3 states.

| Dir | Why it is not chrome |
|---|---|
| `map/` | node fills, department hues and the copper live-ring **are** the datum (§2.1) |
| `chart/` | series colour is the series (§2.6) |
| `dashboards/` | widget internals paint values — bars, deltas, sparkline fills (§2.5) |
| `drawer/` | **PROVISIONAL.** Owner `drawer-engineer` |
| `sessions/` | **PROVISIONAL.** Owner `sessions-relay-engineer` |

**The two provisional entries are the honest part and they are debt, not policy.** Inverting the
list surfaced **ten** violations in the two directories that had never been scanned. Every one was
read, not assumed: five are `data-status` dot fills (`.dot[data-status='ok'|'error'|'running'|
'awaiting-approval']`) and five are copper live-session fills and lines. **All ten are sanctioned
data ink under §1.3** — a status and an *alive* thing — so none is a breach; each wants a
`token-exempt:` line comment naming the value it carries, and that comment belongs to the owner of
the file, not to me. Failing two concurrent agents' trees over ten lines that are all correct is
how a checker gets switched off. Filed to both owners; **delete the two entries when the line
exemptions land.**

So the honest statement, written here rather than inferred from a green exit code —
`check-rtl`'s `assembled-template` blind spot was **declared**, and the declaration is what let
three sentences ship untranslated, so a declared blind spot is only worth anything if it is
declared *loudly*:

| | Status |
|---|---|
| Data ink on a fill/border/ring **anywhere under `apps/web/src/`** | **mechanical**, except in the five named dirs. Falsified in both directions: BOARD's own two examples caught, and a `background: var(--ink-teal)` planted in `lib/` — a directory the old include-list could not see — now fails. |
| Data ink on a fill/border in `map/` · `chart/` · `dashboards/` | **not checked, correctly.** These paint values. |
| Data ink on a fill/border in `drawer/` · `sessions/` | **not checked, and that is debt with an owner and a date**, not a design decision. Ten known lines, all believed sanctioned, none carrying its exemption comment yet. |
| *"Is this particular element chrome or is it data?"* | **not statically answerable at all.** This is `fidelity-qa-reviewer`'s hand inspection and mine, and there is no version of `check-tokens` that replaces it. |

**Therefore: `0 violations` means BOARD rule 8 holds, and now means rule 1 holds across every
directory but five — two of which are debt.** It still does not mean the *judgement* is right,
because no static rule can tell chrome from data on a given element. **A reviewer citing a token
result must cite this row with it**, the same way they cite the `scanned at` line: a count with no
stated width is a sentence, not evidence. The width is now printed by the checker itself, so
quoting the banner carries it.

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

**A glyph that is a cell's entire content is not a separator.** Ruled 2026-08-16 with
`dashboards-engineer`, whose reading is adopted verbatim: *"a separator sits between two
things; here the `—` is the cell's entire content."* A lone `—` in a data cell carries the
difference between *we measured zero* and *we have no measurement* — BOARD rule 9's distinction,
in one character — so §9.3's separator home does not reach it. It ships `--ivory-2` at
`apps/web/src/dashboards/components/widget-chrome.tsx` for two independent reasons, either
sufficient: it stands in place of a value that would have been `--ivory` (§9.4a, one rung), and
it renders inside `DataTable`'s `hover:bg-card-2` peek rows, where light `--ink-2` is 4.25:1
(§9.5). **And colour was the smaller half.** `—` is announced as "dash", "em dash" or silence
depending on the reader's punctuation setting, so the one cell whose job is to say *no reading*
was the cell that said nothing: it is now an `aria-hidden` glyph plus an `sr-only` sentence, in
one place, with `DataTable`'s null branch delegating rather than keeping a quieter second copy.
Pinned by `dashboards-contrast.test.ts` ("gives the absent reading a colour AND an accessible
name, in exactly one place").

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
a `decision-request` rather than smuggling it, which is the behaviour this protocol wants —
`comms/inbox/design-system-guardian/20260816-2208-dashboards-engineer-s9-applied-two-calls-and-a-primitive-default.md`,
answered and closed 2026-08-17. **The two earlier `--ink-2` instructions are withdrawn**, in
writing and here rather than only in a reply, so that a reader who finds the old message later
finds this line before acting on it.
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

**Its call-site sweep is dormant today, and that is the correct state rather than a hole — but
it used to be dormant *silently*, which was not. Corrected 2026-08-17 by the owner** on
`commandcenter-orchestrator`'s finding. The assertion was named *"lets no call site anywhere in
`src/` inherit one of them in silence"* — a promise of an active, repo-wide guarantee — while
its body opened with `if (props.length === 0) continue`. With the known-offender list empty and
no primitive defaulting sub-AA, it iterated an empty armed set and passed **without examining a
single tag**: green, fast, checking nothing, under a name a reader would cite.

The dormancy itself is right and is kept: this is a **trap, not a patrol**, and it arms itself
the moment a sub-AA default appears in `components/primitives/`. "Fixing" it by re-adding an
entry to keep it busy would re-introduce the defect corrected one paragraph above — a guard that
needs something to still be broken. **So the dormancy stayed and the silence went**, as two
assertions instead of one:

1. *"is dormant today, examines nothing, and does not pretend otherwise"* — asserts the armed
   set is empty **and that the tag count is zero**. The vacuity is now stated out loud, so a
   reader who cites this file gets the width of what it checked.
2. *"patrols every call site in `src/` the moment a sub-AA default appears"* — arms the sweep
   synthetically and proves **both directions**, because one is not a proof: armed on a prop no
   call site can possibly state, it must name every `<Chip>` in the tree; armed on
   `RailLabel.tone`, which every shipped call site does state, it must name none. A sweep that
   always fires and a sweep that never fires are equally useless, and only the second looks
   green. Falsified by blinding `callSites()` to return nothing — the patrol goes red, where the
   old single assertion would have stayed green.

Same shape as the deriver's own self-check: prove the mechanism by mutation, never by leaving a
real defect in place to lean on.

**Why this is adopted while a per-module allowlist mandate is still declined.** I have twice
been asked to promote `drawer-contrast.test.ts`'s allowlist-with-a-written-reason into a
required pattern for every module, and twice declined on the grounds that it wants an ADR with
those owners in the room. That reasoning is unchanged, and this adoption does not quietly
smuggle it in. The two differ on one axis that decides it: **this file imposes no obligation on
anyone.** It derives its own targets, lives in one place, and a module owner who never opens it
still gets the guard. A mandated per-module pattern imposes a new file, a maintained list and a
review argument on eleven owners, which is a decision about their work and therefore theirs to
weigh. *Adopt instruments that cost their beneficiaries nothing; negotiate the ones that bill
them.*

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
| line 128 (§2.1) | MAP department sub-labels | `--ink-3` | `--ink-3` | **not superseded** — see below; the closest call of the four |

**The ledger is closed against the spec, and that is checkable.** `grep -n 'ink-3'
skilltree-clone-spec.md` returns exactly four hits: lines 23 and 41 are the token definitions
themselves, and lines 128, 156 and 184 are the three elements. All three now have a row. That
completeness is the point — a supersession ledger with an unlisted site is a ledger that says
"we thought about this" while the unlisted site is exactly where nobody did. **Re-run that
grep whenever §9 rules again; a new hit with no row is a gap, not a judgement call.**

**Line 128 — the MAP department sub-labels stay `--ink-3`. Ruled 2026-08-16 by the owner,
against the shipped code, not from memory.** Spec line 128: *"3 tiny sub-labels beneath (11px
`--ink-3`, e.g. под MARKETING: 'content · brand · distribution')"*. Shipped at
`apps/web/src/map/svg/BranchLabels.tsx:61` (`fill="var(--ink-3)"`), sized at
`apps/web/src/map/lib/map-type.ts:25`.

It is the closest call of the four. **The reason below was rewritten on 2026-08-17 after
`fidelity-qa-reviewer` pressed it and landed on the same conclusion by a different route. The
conclusion did not move; the reason did, and the reason is the half that matters** — it is what
the next reader reuses, and the original would have licensed `--ink-3` on any `aria-hidden`
text in the product.

**What the row used to say, and why it was the weaker half.** It rested on the fact that
`BranchLabels.tsx:30-32` puts `role="button"` and `aria-label="<DEPT> department"` on the group,
so name-from-author wins and the three words are outside the accessibility tree — from which it
argued that a string withheld from one class of reader cannot be required reading. That fact is
true and it is verified. It is also **not an argument about contrast**, in the reviewer's words:

> *"The a11y tree says nothing about a low-vision **sighted** reader, who is exactly the person
> §9.1's ratios exist for."*

Which is decisive. §9 is a legibility floor for people who are *looking at the screen*. Whether
a screen reader is given a string is a different question with a different owner, and answering
a contrast question with an accessibility-tree fact is a category error — one that generalises
badly, because "it is `aria-hidden`, so it may be faint" would wave through the next ten cases
without any of them being examined.

**The reason that actually decides it: the sub-labels are cluster names, and a cluster is fully
recoverable one click in.** `'lead sourcing'`, `'enrichment'`, `'content · brand · distribution'`
— each names a cluster the reader reaches by opening the department, where it appears at full
weight with its nodes around it. So §9.2's *"any hint that appears nowhere else on the screen"*
is answered rather than dodged: these words appear nowhere else **on this screen**, and they are
one click from appearing at `--ivory` on the next. Delete them and the reader loses a preview,
not a fact — nothing on screen becomes false, and nothing becomes unreachable. That is §9.3's
*"redundant with its own position"* home entered honestly, and it is the same test that kept
§2.3.9's ladder label at `--ink-3`.

**The trigger that flips this row, stated so it does not have to be re-derived — and now stated
in terms of the new reason.** If the sub-labels ever become **the only place a cluster name
appears** — a cluster that no longer has its own view, a MAP that stops drilling into
departments, or a sub-label naming something the department view does not — they become required
reading and move to `--ink-2` under §9.7b. The old aria-shape trigger is kept as a **second,
independent** trigger rather than deleted: if they gain their own accessible name or become
individually focusable, they have been promoted to operable content, and operable content is
required reading whatever else is true of it.

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

**Adopted as standing, in `fidelity-qa-reviewer`'s words, because the sentence is better than
the rule:** *"I checked the code against the contract and never checked the contract against
the spec."* Every gate in this repo runs in that one direction. `check-tokens.mjs` reads code.
`primitive-color-defaults.test.ts` reads code. The review reads code. `check-spec-coverage.mjs`
comes closest and still does not reach it — it fails when a requirement cites a missing file or
no section at all, which means it verifies that a row *points somewhere*, never that what the
row *says* is true. A prose document is checked by exactly one instrument, a reader, and only
if the reader is looking.

The command, and it is deliberately three lines rather than one, because `comms/contracts/`
is not the whole blast radius:

```powershell
Select-String -Path skilltree-clone-spec.md -Pattern 'ink-3'   # what the spec of record says
Select-String -Path comms/contracts/*.md    -Pattern 'ink-3'   # contracts that prescribe it
Select-String -Path comms/specs/*.md        -Pattern 'ink-3'   # coverage rows that repeat it
```

**Run 2026-08-16 23:5x at `4e0bbe6`, and it found a second instance immediately.**
`comms/contracts/panel-schema.md` rule 2 was already corrected by its owner, but the value had
been copied onward: `comms/specs/dashboards.md` REQ-DSH-33 still reads *"a one-line `--ink-3`
empty state"*, while the code it points at ships `--ink-2`
(`apps/web/src/dashboards/dashboards.module.css:384`, `.emptyLine`). So the requirement row now
mis-describes its own implementation, and it is the row a future reader would trust to decide
what the implementation *should* be. Filed to `dashboards-engineer`, whose file it is; not
edited here, because a contract owner fixing another owner's document is the same
boundary-crossing this protocol forbids in the other direction.

**The generalisation worth keeping:** a wrong value in prose does not stay in one document. It
propagates along the path people actually read — spec → contract → coverage row → component —
and each hop makes it look more settled. Fixing the hop where it was noticed is not fixing it;
`grep` the whole path.

---

## 10. Provenance — the badge, and why it is grey

**Added 2026-08-17 by the owner.** Source: `Plan §10`, `Plan §23.6`, and
[ADR-014](../decisions/ADR-014-agent-cascade-resolution.md) §4.3, whose decisions the badge
renders and does not re-open. Implemented at
`apps/web/src/components/primitives/ProvenanceBadge.tsx`, pinned by its own test.

The question it answers is `Plan §10`'s: *"you must never have to wonder which one you just
ran."* The reason it is hard is BOARD rule 1: **provenance is chrome, so it gets no colour**, and
it has to stay legible beside status chips that have plenty.

### 10.1 The grammar — three channels, five states, no hue

| State | Mark | Modifier | Text token | Label |
|---|---|---|---|---|
| `global` | house | — | `--ivory-2` | GLOBAL |
| `project` | square with a solid core | — | `--ivory-2` | PROJECT |
| `fork` | fork, both arms intact | — | `--ivory-2` | FORK *a1b2c3* |
| `drifted` | fork | parent arm ends in a **hollow ring** | `--ivory` | DRIFTED FORK *a1b2c3* |
| `orphaned` | fork | parent arm **severed**, nothing terminates it | `--ivory` | ORPHANED FORK *a1b2c3* |

Every state differs from every other on **at least two** channels, so no channel is load-bearing
alone:

1. **Mark — silhouette, not hue.** Survives greyscale, survives 12px, survives the label being
   removed entirely at `size="sm"`, where the mark is the whole signal.
2. **Modifier — hollow, never filled.** `Chip`'s dot is filled and `Chip`'s dot is data ink, so
   **fill is itself a signal**: filled means status, hollow means provenance. That reading is
   worth more than any one badge — extend it, do not re-decide it, if another chrome component
   ever needs a mark.
3. **Text weight — settled at `--ivory-2`, warning at `--ivory`.** The monochrome substitute for
   severity colour, and it is §9.4b pointed at chrome: **open the gap from above.** Never by
   pushing the settled state down into `--ink-3`, which §9.2 forbids outright.

**A stroke rule, binding on any redraw:** no state's mark may be a *superset* of another's. Five
distinct strings is too weak an assertion — a mark that is another mark plus one stroke is the
same silhouette with a detail nobody sees at 12px. Measured rather than assumed: a mutation
making `orphaned` draw the intact parent arm *as well as* the severed one passed a distinctness
check and failed the containment one.

### 10.2 The one departure from the plan, taken openly

> `Plan §10`: *"A forked agent whose parent has moved on shows a staleness dot — the same honesty
> rule as connector health."*

**The honesty rule is adopted in full. The visual register is not.** Connector health is the
status of a running thing and is data ink by §1.3. Drift is a property of provenance: a drifted
fork is not unhealthy — it runs, it is a complete file, and ADR-014 §4.4 is explicit that even an
*orphaned* fork keeps working. Rendering drift in amber would file *"your parent library moved
on"* in the same drawer as *"approval pending"*, and the reader would then have to learn which
greys and which colours belong to which question. Chrome-monochrome is 90% of why this product
looks expensive (§1.3), and lineage is the cheapest possible thing to spend it on.

**This is a departure from a plan, not from the spec of record**, so §9.7b does not govern it —
but it is written here rather than lived in a component, and an ADR number has been requested.
§9.7c applies to plans as well as contracts: *a value read out of a document and implemented
differently, with no written trace, is how the document stops being authoritative.*

### 10.3 Exclusions are not this primitive — ruled

ADR-014 §1.2 excludes a whole `(department, slug)` when the winning file fails validation, with a
named reason, and §7.4 is right that it must reach a human: *"a project maintainer never reads
the coordinator's console."* Whether the badge carries it: **it does not, and there is no sixth
state.**

1. **An excluded key has no resolved agent**, so there is nothing for a badge to decorate. A
   badge is an adjective; an exclusion is the absence of the noun.
2. **An agent-shaped row carrying an "excluded" badge is a plausible presence where the truth is
   absence** — a node on screen that cannot run. That is BOARD rule 9 in the one direction it
   never permits, and it is worse than the console warning it replaces, because it looks like a
   working feature.

**The register is the other half of the ruling.** An exclusion *is* a status — something is wrong
and a human must act — so it is **data ink, in a sibling surface owned by the view that lost the
node** (`map-galaxy-engineer` for MAP, `shell-navigation-engineer` for the switcher). `Chip
tone="warn"` plus an honest empty state is the existing vocabulary; it needs no new primitive.
The split generalises:

> **Provenance is chrome and is grey. Exclusion is a status and is coloured.** If you see colour,
> something is wrong. If you see grey, something is merely *from* somewhere.

### 10.4 Why it is the ninth primitive rather than a `Chip` variant

`index.ts` says the set is closed and a new primitive is a decision-request. This is that
decision, recorded rather than assumed. The obvious host was `Chip`, and that is exactly why it
could not go there: `Chip` is the product's **status** vocabulary and carries the sanctioned
data-ink exemption. Putting provenance inside it would teach every reader — and every future
implementer copying the nearest example — that a coloured token and a grey one answer the same
kind of question. **The reason it is a separate component is the reason it exists.**

`size="sm"` (mark only, full accessible sentence retained) is the answer to "too big for a MAP
node", and it is a prop rather than a second component.

### 10.5 The marks are drawn, not typed — and that is measured

`Plan §10` writes them as characters: `⌂` U+2302 · `▣` U+25A3 · `⑂` U+2442. Checked at `4e0bbe6`
against the 79 CSS files `@fontsource/plus-jakarta-sans` actually ships: **all three fall outside
every one of its 825 `unicode-range` declarations.** Typing them would not request our webfont at
all — the browser falls back to whatever the host OS has, at a different weight and baseline, and
U+2442 is absent on many systems, which renders the fork as tofu.

BOARD constraint 7 forbids external font requests at runtime; a glyph that silently leaves our
type system is the same defect one layer down, and it is invisible on the developer's machine. So
the marks are inline SVG on `currentColor`: they inherit every rule in §10.1 and depend on no
font. **Any redraw keeps that property** — the characters are the plan's notation, not the
implementation.

### 10.6 Why it is brighter than the chrome around it

`--ivory-2` / `--ivory`, never `--ink-2`. Two independent reasons, either sufficient:

1. **It carries the whole difference between two rows.** A project override and its global parent
   share a slug and a name *by design* (ADR-014 §2). §9.2's delete-the-text test passes here in
   its strongest form: delete the badge and the reader does not lose a decoration, they **believe
   something untrue** — that they are looking at the global agent when they are looking at a fork
   of it.
2. **§9.5.** These rows are hoverable — MAP nodes, `JobCard`, drawer headers, switcher rows — and
   light `--ink-2` on `--card-2` is 4.25:1. `--ivory-2` (7.14:1 worst case light) removes the trap
   by construction rather than documenting it, and needs no "am I inside an interactive row?" prop
   that call sites would get wrong.

**`state` has no default, deliberately.** §9.6a's lesson generalised from colour to meaning: a
default here would be a *provenance claim* spent by a call site that never made it. If you do not
know where the agent came from, you may not render this.

### 10.7 One question, one visual language

Four surfaces render it — drawer header (`Plan §23.6`), `JobCard`, MAP node, project switcher.
**The state→word mapping lives in the primitive and is not a prop**, for the same reason
`Eyebrow` bakes in its tracking: a consumer who *can* choose the word will eventually choose a
different one, and four surfaces answering one question in four vocabularies is worse than any
single wrong answer. Strings are catalogue keys (`provenance.badge.*`, `a11y.provenance.*`) so
`check-rtl` can see them; Arabic ships as admitted `todo()` gaps rather than a guess at five terms
of art, per that catalogue's own rule.

**The project switcher is the near-collision to watch.** It answers *"which project am I in"*;
the badge answers *"which library did this agent come from"*. Different questions, adjacent
answers — and if the switcher grows its own layer marks, the two become two dialects.
Coordination with `shell-navigation-engineer` is in writing, not assumed.

**No motion, ever.** A pulsing badge reads as *alive*, and alive is copper's single word (§1.3).

---

## 11. Threads — the addressing register and the interrupt register

**Added 2026-08-17 by the owner.** Source: `Plan §12`, `Plan §23.8`,
[ADR-023](../decisions/ADR-023-thread-unification.md) and
[`thread-model.md`](thread-model.md) §3, §4.2 and §6, whose decisions these two primitives
render and do not re-open. Implemented at
`apps/web/src/components/primitives/AddressBadge.tsx` and `InterruptBadge.tsx`, each pinned by
its own test.

**This section is a spend control written as typography.** `Plan §12`, quoted rather than
paraphrased because paraphrase loses the reason:

> *"`#sales` and `@@sales` must be different characters and must **look** different, because
> one costs one run and the other costs six. A UI that makes broadcast easy to trigger
> accidentally will cost real money on the first day."*

The composer cannot invent these locally, for the same reason `ProvenanceBadge` came here: four
surfaces will render an address (the composer, the THREADS view, a thread-list row, the drawer's
mailbox) and four vocabularies for one question is worse than any single wrong answer (§10.7).

### 11.1 Why the two registers deliberately do not look alike

> **Addressing is a DISCONTINUITY. Interrupts are a RAMP.**

This is the load-bearing sentence of the section and it is the answer to *"why isn't `@@` just a
brighter `#`?"*

`#` and `@@` are **not two points on a scale.** One costs one run; the other costs N. A reader
who perceives them as adjacent has already made the expensive mistake, and *one weight step
apart* is exactly the treatment that produces it. So the fan-out badge is given a **silhouette
nothing else in this product has** — it is physically two plates, a second hairline lip peeking
above the frame. "There is more than one of these" arrives before the characters do.

`note → steer → halt` genuinely **is** a scale: queued, injected now, stop-and-ask. So it gets a
monotone ramp, and drawing an ordering as a discontinuity would be as wrong as the reverse.

Everything else is shared vocabulary with §10, on purpose, so the three badges are one dialect:
marks are drawn SVG on `currentColor` and never typed glyphs; **fill is a signal in itself**
(filled means status and belongs to `Chip`, hollow means chrome); severity opens the gap **from
above** (`--ivory-2` → `--ivory`), never by pushing the quiet state down into `--ink-3`, which
§9.2 forbids outright.

### 11.2 The addressing register — four forms, four channels

| Form | Typed | Mark | Silhouette | Text | Frame | Runs |
|---|---|---|---|---|---|---|
| `direct` | `@sales/account-enrichment` | stem + crossbar, closed | one plate | `--ivory-2` | `--line` | 1, exactly |
| `dispatch` | `#sales` | stem + crossbar + **free dash above** | one plate | `--ivory-2` | `--line` | **at least** 1 |
| `fan-out` | `@@sales` | **trident** — three arms, three ends | **two plates** | `--ivory` | `--line-2` | N, exactly |
| `default` | *(nothing)* | **broken stem** — a gap, no cap | one plate | `--ivory-2` | `--line` | at least 1 |

Every pair differs on at least two channels, so no channel is load-bearing alone. The sigil
itself is a **confirming** channel and never the load-bearing one: `#` and `@@` at 11px are
precisely the confusion the register exists to prevent, so they may not be the thing that
prevents it.

**One drawing rule spans all four marks, and it is `runsAreExact` drawn rather than described:**

> **A mark whose topmost stroke terminates in a cap is an exact count. A mark whose topmost
> stroke is a free-standing dash continues past what we can count.**

This is the register's answer to the second thing `Plan §23.8` gets wrong. The plan says
`#sales` *"says 1 run"*. It does not — the lead answers **or delegates**, and a delegation is a
second run (`thread-model.md` §6). A flat "1 run" beside a mechanism that routinely costs two is
a plausible number one decimal place up, which is the same defect as a plausible zero. So the
copy says *"at least"*, the mark says it too, and `AddressBadge.test.tsx` binds them: a form
draws the open end **iff** `addressCost()` reports its count inexact. **The limit of that binding
is stated in the test rather than implied** — it binds the *label* on a stroke to the contract,
not the pixels to the label, and a redraw that moves `data-open-end` onto the wrong stroke is a
review question.

**`default`'s broken stem is the honest drawing of an M16 fact**, not a decoration: the bare
address means Chief of Staff *as an address*, and the router that would answer it is M22's
(`thread-model.md` invariant 11). The message leaves and the far end is not ours to draw yet.

### 11.3 The cost slot — count without money is the full state, not a degraded one

`Plan §23.8` asks the composer to say `@@sales · 4 runs · ~$0.40`.

**The `4` is real** — it is the resolved member count. **The `$0.40` has no source**: zero runs
have ever completed, so there is nothing to average, and a cost preview is exactly the surface
where a plausible number gets believed (BOARD rule 9). `TurnCost.estimatedUsd` is typed `null`
by its owner precisely so a figure stops the file compiling.

The primitive encodes that rather than trusting the composer with it:

| | How it is prevented |
|---|---|
| A money prop | There is none. No `label`, no `children`, no `suffix`. The only cost input is `TurnCost \| 'unresolved'`, and `TurnCost` has no money field to fill. |
| Money through a **translated string** | `AddressBadge.test.tsx` sweeps every form × both locales × both exactness values against a currency pattern. Falsified: adding `~$0.40` to one English plural turns it red. |
| Money hardcoded in a **future composer** | Two gates compose into one property: `check-rtl` fails an uncatalogued user-visible string, and the catalogue test fails a currency symbol under `threads.`. A composer cannot print money without breaking one of them. Stated as a composition, not claimed as airtight — a composer could still render an interpolated value, and that is a review question. |
| `estimatedUsd` **widening** | A `@ts-expect-error` on a priced `TurnCost`. The day the type widens, the suppression becomes unused and `tsc` fails — so the diff that adds a figure is the diff that has to say where it came from. |

**Three cost states, and the third is designed at the same time as the first two** (the standard
`ChartEmptyState` and `EmptyCell` set):

| State | Renders | Why |
|---|---|---|
| exact | `· 4 runs` | tabular figures |
| lower bound | `· at least 1 run` | `runsAreExact: false` |
| **unresolved** | `· Runs not counted yet`, at `--ink-2`, **with no numeral at all** | the roster has not resolved, so N is genuinely unknown |

**`runs: 0` and "unresolved" are two different facts and the badge draws them differently.** "This
department has no members" is an answer; "nobody has looked" is the absence of one, and collapsing
them is BOARD rule 9 in miniature. The unresolved state carries **no digit**, asserted by test —
the absence of a figure *is* the signal.

**It does not borrow the chart's hatch, and the reason is worth keeping.** `EmptyCell`'s hatching
fills an *area* that would otherwise hold data. A text slot has no area to hatch, and importing
`chart/model/hatch.ts` into a primitive inverts the dependency §9.6a already refused when it kept
a repo-wide guard out of a feature directory. The honest empty state here is a complete sentence
at the required-reading floor, which §9.2 requires of every honest empty state anyway.

**BOARD's `@@` confirm is not this primitive**, and the badge is built so it can be one: it
renders no focusable node and sets no `tabindex`, so a composer may legally wrap it in a
`<button>` — a button containing a button is not reachable, which is the trap this avoids. The
badge contributes the count the confirm has to name; reachability and dismissal are
`sessions-relay-engineer`'s and `drawer-engineer`'s.

### 11.4 The interrupt register — three levels, one question answered three times

The question a reader must resolve **before they commit**:

> **Will this interrupt work in progress, or will it wait?**

| Level | Mark | Enclosure | Text | Consequence |
|---|---|---|---|---|
| `note` | unbroken stem, full height | **none** | `--ivory-2` | queued; read at the next tool boundary |
| `steer` | stem **steps sideways** and continues | **leading rule** (`border-s`), **dashed in M16** | `--ivory` *(never drawn in M16 — see 11.4a)* | injected into the live session now |
| `halt` | stem stops at a bar; **top of the box empty** | **full box** | `--ivory` | stop, checkpoint, ask |

All three channels answer `interruptsWorkInProgress()` identically, and the test asserts that
agreement rather than restating it: a reader who scans the shape and a reader who scans the
brightness must reach the same conclusion, or one of them is being misled. The enclosure ramp is
asserted **monotone** — nothing, a rule, a box — because that ordering is the escalation.

#### 11.4a The ramp has one rung that is currently unavailable, and the type is what says so

**M16 ships two interrupt levels and a refusal, not three.** The runner answers **every** `steer`
with `interrupt_not_deliverable` (409), in flight or not: `createSdkSession` drives the Agent SDK
with a *string* prompt, injecting another user turn needs its streaming-input mode, that mode has
never been exercised here, and the first thing that would exercise it is a **paid** run. BOARD
records this as the M16 scope change; `MID_RUN_STEER.supported` is the runner's declaration.

A register that drew all three as **equally available** would be the only part of the design that
is not true yet, so this is a **monotone ramp with one rung unavailable** — not a two-rung ramp,
because `steer` is a real level that is coming back, and not three equal rungs, because it does
not work today. The unavailable rung keeps its place in the ordering and its own mark and
enclosure, and loses only the brightness that would read as *"this will land"*.

| | Mechanism | Where |
|---|---|---|
| A caller may not **claim** a steer will land | `SteerDeliverable` is derived from `STEER_DELIVERY.supported`, so today it is the literal `false`. `deliverable={runIsInFlight}` **does not compile** | `InterruptBadge.tsx`; `typecheck` |
| The refusal may not be **lifted quietly** | Two gates: `_steerStaysNarrowedUntilSomethingProvesOtherwise`, a type-level pin in the **source** file, and the test's `@ts-expect-error` becoming an unused directive. Both stop compiling the moment `SteerDeliverable` widens | `InterruptBadge.tsx`; `typecheck` · `InterruptBadge.test.tsx`; `typecheck:tests` |
| The web mirror may not **drift from the runner** | The test reads `apps/runner/src/lib/mailbox.ts` and fails if `MID_RUN_STEER.supported` and `STEER_DELIVERY.supported` disagree — in **either** direction | `InterruptBadge.test.tsx`; `test:web` |
| An unavailable rung may not be **dressed as available** | Rendering assertion: dashed enclosure present, `text-ivory` absent | `InterruptBadge.test.tsx`; `test:web` |

**Why the pin is in the source file as well as in the test, and the hour in which one of them was
a lie.** The first draft used only the `@ts-expect-error`-becomes-unused trick, which is how the
runner pins `MID_RUN_STEER`. It did nothing here: `apps/web/tsconfig.json` excluded this app's
test files, so **every `@ts-expect-error` in the web suite was inert** — four live gates in
`apps/runner`, six decorative ones in `apps/web`, indistinguishable by reading. Measured rather
than assumed: a deliberate `const _blatant: number = 'x'` in `InterruptBadge.test.tsx` produced
zero `tsc` output, while the identical probe in `apps/runner` was caught at once.

`commandcenter-orchestrator` closed it with `apps/web/tsconfig.test.json` /
`npm run typecheck:tests`, and the instrument immediately found a **second** defect nobody could
have seen: §11.3's *"has no prop that could carry a money figure"* had its directive on the
`const _priced: TurnCost = {` line rather than on `estimatedUsd: 0.4`, where the violation is. So
BOARD rule 9's type gate on the one surface where a plausible number gets believed was **inert and
misaimed at once**. Fixed; falsified by widening `TurnCost.estimatedUsd` to `number | null` in
`packages/contracts`, which now fails with `TS2578 Unused '@ts-expect-error' directive`.

**The rule this leaves behind:** the source-file pin stays even though the test pin now works.
A gate that was silently dead for a week is not replaced by the gate that replaced it — it is
joined by it.

**The stated reason had to change too, and the old one was the wrong reason.**
`a11y.threads.interrupt.undeliverable` used to say *"Nothing is running on this thread"* — which
is thread-model §4.2's refusal, the one that applies when there is no run in flight. Under the
runner's actual behaviour that sentence tells a reader **with** a run in flight that the refusal
does not apply to them. §4.2 describes the **level**; `STEER_DELIVERY` describes this **build**,
and the register may only draw what the build can do.

**What separates `halt` from `steer` at 12px without reading either label is an absence**: steer's
line reaches the top of the box; halt's stops against a bar with nothing above it. An absence
survives greyscale, RTL and 12px, which is why it is the third silhouette rather than a heavier
stroke.

**`deliverable` is required on `steer` and forbidden on the other two.** `thread-model.md` §4.2
and invariant 7: a `steer` with no run in flight is **refused**, never silently downgraded —
*"a human who steered and was silently queued believes they changed course, and nothing did."*
`note` and `halt` are always deliverable, so there is nothing to ask. The props are therefore a
discriminated union: a caller offering `steer` **must** answer *"is a run in flight?"*, and a
caller offering `note` **cannot**. A boolean defaulting to `true` would have been a
deliverability claim spent by a call site that never made it — §9.6a's lesson, which was about a
colour, applied to a semantic prop exactly as `ProvenanceBadge.state` applies it. **And today the
only admissible answer is `false`** — see 11.4a.

A refused steer renders with a **dashed** enclosure and stays at `--ink-2`. §9.3 homes `--ink-3`
at disabled controls and this looks like one; **§9.2's delete-the-text test overrules that** —
delete the sentence and the reader believes their steer will land. Required reading is `--ink-2`
at minimum, and it is asserted, because this is the one place in the two registers where the
faint token was genuinely tempting.

### 11.5 Why these are the tenth and eleventh primitives

`index.ts` says the set is closed and a new primitive is a decision-request. This is that
decision, recorded rather than assumed — the same act §10.4 performed for the ninth.

Both were offered `Chip` as a host and both refused it, **for the reason that makes them exist**:
`Chip` is the product's *status* vocabulary and the one component allowed to spend data ink.

- **An address is not a status.** Nothing is wrong, nothing is running, nothing needs a human. It
  is a **price**, and a price rendered in a status hue would put money in the same visual drawer
  as *"at risk"* — the reader would then have to learn which colours are conditions and which are
  costs.
- **An interrupt level is not a status either.** It is a *choice the sender is about to make*.
  And the enclosure ramp is not a `Chip` shape at all: `Chip` is always a bordered box, and two
  of these three deliberately are not.

Neither is a variant of the other. They answer different questions — *to whom* and *how
disruptively* — and they compose side by side in the composer.

### 11.6 RTL — declared in the table, not decided in the component

Both entries live in `apps/web/src/i18n/direction.ts`, which is where a control declares which
way it goes. That table existing and **not** naming the carousel is exactly why three components
each decided locally and one shipped backwards; these were added in the same act as the
primitives rather than after them.

- **`MIRRORS['threads.addressBadge']`** — a badge is a label in a sentence: mark, sigil, count,
  joined by `·`. Reading order, so the whole run mirrors, and it does so for free because the
  spacing is `gap` and the one enclosure edge is `border-s`.
- **`DOES_NOT_MIRROR['threads.registerMarks']`** — the marks are counts and states drawn on the
  **block axis**. A message rises into the runs it becomes; work runs upward until something
  interrupts it. That was a drawing decision taken to make this question cheap, not a discovery
  afterwards. One exception is named in the table: `steer`'s lateral step is a change of course,
  not a direction of travel, so mirroring it would assert the work was heading somewhere.

**The decision that actually needed making, and would have been missed:** `@`, `#` and `@@` are
direction-**neutral** characters (BiDi class ON). An address sitting against Arabic text takes its
side from whatever runs beside it, so `@@sales` can render with the sigils on the wrong end of the
name with nothing in the component being wrong — and the sigil is the character that distinguishes
one run from N. The typed address is therefore wrapped in `<bdi>`, so the run resolves by its own
first strong character. Same answer §10 gives `{commit}`; not optional here.

**The stacked lip is inset symmetrically on the inline axis and offset only on the block axis**, so
it is the same stack in both directions rather than a physical property needing an `rtl-exempt`.

### 11.7 What ships as an admitted gap, and why the split is where it is

Fifteen catalogue keys, and **exactly one** ships as `todo()`.

The first draft filed five, on §10.7's precedent, and it was **wrong on four of them — caught by
a gate rather than by taste.** `i18n.test.ts` caps the whole repo's admitted gaps at five, and
five new ones took it to eight. That ceiling is `rtl-arabic-pdpl-specialist`'s and raising it
would have been a silent re-baseline of somebody else's instrument, so the gap was closed the only
honest way available: **write less copy, and translate what is genuinely translatable.**

| | State | Why |
|---|---|---|
| run counts (five plural classes), unresolved sentence, six behaviour sentences | **written** | «عملية تشغيل» is already this catalogue's word for a run (`shell.status.queue`), so reuse is consistency rather than a guess, and the plural classes are grammar rather than taste. The behaviour sentences describe what each form and each level *does* and **never name it**. |
| `note` · `steer` · `halt` | **written** | §10.7's precedent is about **metaphors** with no Arabic technical idiom — «fork» is a garden fork, and importing it is the textual equivalent of a faux italic. These are three *actions*, and MSA has a direct verbal noun for each. **Guessing a metaphor and writing an ordinary verbal noun are different acts, and only the first is what the catalogue's header warns against.** `rtl-arabic-pdpl-specialist` owns the register and may overwrite all three with no decision-request; a message says so. |
| *Chief of Staff* | **`todo()`** | A role title, not a UI verb, with at least three defensible renderings — رئيس الأركان is military, رئيس الديوان is administrative, مدير المكتب is corporate — whose choice says something about what this product thinks that agent **is**. That is a company decision, not a translation one. |

**And one English string was reworded to make that possible**, which is the part worth keeping:
`a11y.threads.address.default` used to say *"goes to the Chief of Staff"* and was therefore
untranslatable-by-consequence. It now says *"the project's default recipient"* — describing the
role instead of naming it — so choosing the title later forces no rewrite of the sentence around
it. **The gate did not just refuse a number; it found a copy defect**, which is the argument for
a ceiling over an equality.

**No motion, ever**, in either register — a pulsing badge reads as *alive*, and alive is copper's
single word (§1.3). Reduced motion is therefore a still with no layout change by construction
rather than by a guard, and both tests assert the absence.
