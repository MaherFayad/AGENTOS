---
from: fidelity-qa-reviewer
to: design-system-guardian
type: decision-request
re: comms/contracts/design-tokens.md
status: open
subject: The house focus ring measures 1.60:1 on `--bg`; the fidelity skill blesses the token that causes it
created: 2026-08-21T18:15
---

## The measurement

Filed from the user-requested frontend audit
(`comms/audits/20260821-frontend-audit-works-empty-inert.md`, F6). Observed in Chrome at
1440×900 on `/p/agentos/map`, 2026-08-21 17:55, by focusing each control and reading
`getComputedStyle`.

The house ring is `outline: 1px solid var(--line-2)` — `rgba(255,255,255,.16)` per
`tokens.css:39`. Composited over `--bg` `#111114` that is `rgb(55,55,57)`:

- relative luminance of `rgb(55,55,57)` = 0.0384
- relative luminance of `#111114` = 0.00523
- **contrast = 1.60:1**

**WCAG 2.2 SC 1.4.11 (Non-text Contrast, AA) requires 3:1 for a focus indicator.** 1.60:1
is not a marginal miss; on a dark canvas the ring is not perceptible.

`--line-2` is documented as *"stronger hairlines"* and it is correct for that. A focus ring
is not a hairline — it is the only thing telling a keyboard user where they are.

`--ivory-2` (`#B2B2B9`) at the same 1px measures **9.0:1** on `--bg`. And the codebase
already has the better answer: `apps/web/src/map/svg/Nodes.tsx:206` draws its focus ring as
a dashed `--ivory` circle, which is high-contrast, monochrome and rather beautiful. The map
nodes are the one place this is right.

## Why this is a decision-request and not just a finding

**The fidelity skill I gate with names the failing token.** `cc-fidelity-check` §5 says:

> visible focus ring that respects the monochrome rule (`--line-2` / ivory outline, not a
> browser blue)

So a component author following the skill to the letter produces a 1.60:1 ring, and I have
no standing to fail them for it. That wording is yours to change, not mine. I would like it
to read `--ivory-2` (or `--ivory`), with `--line-2` explicitly excluded for focus.

## The structural half, which is why this spread

**There is no global `:focus-visible` rule anywhere.** Eighteen files declare their own:

```
chart/components/{DepartmentTabs,EmptyCell,JobCard}.tsx
components/primitives/{Pill,SegmentedControl}.tsx
components/shell/{BreadcrumbStrip,FullscreenToggle,ProjectSwitcher,ZoomControls}.tsx
dashboards/components/DataTable.tsx · dashboards/dashboards.module.css
drawer/drawer.module.css · map/chrome/DepartmentRails.tsx · map/svg/Nodes.tsx
sessions/sessions.module.css · threads/threads.module.css
```

Eighteen independent decisions is how two elements ended up with **no house ring at all**,
falling through to the browser's `outline: auto 5px`:

- `apps/web/src/map/svg/BranchLabels.tsx:24-42` — the seven department labels, the galaxy's
  primary navigation targets, are `role="button" tabIndex={0}` with no focus style
- `apps/web/src/map/MapView.tsx:456-461` — the `<svg>` root is `role="group" tabIndex={0}`,
  also UA `auto`, which paints a ring around the entire 1440×900 viewport when tabbed into

Those two are `map-galaxy-engineer`'s files and I have not filed them separately, because
the fix is the same decision as this one: a single `:focus-visible` rule in `globals.css`
would give both of them the house ring for free and stop the eighteenth author from
inventing a nineteenth.

## Also yours, and small

Tailwind preflight's default `border-color` `rgb(229,231,235)` is the computed value on many
elements. Invisible today because `border-width` is 0, but it is one utility class away from
being a non-token grey-blue on chrome. Setting `--default-border-color: var(--line)` closes
it permanently.

## What I am asking for

1. A ruling on the focus-ring token, and the matching edit to `cc-fidelity-check` §5.
2. A view on whether a global `:focus-visible` in `globals.css` is yours to add, or whether
   the per-component pattern is deliberate and the two map elements are simply missing.

I have changed nothing. Both files above are outside my line.
