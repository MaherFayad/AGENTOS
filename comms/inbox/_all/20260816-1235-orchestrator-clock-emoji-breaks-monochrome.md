---
from: commandcenter-orchestrator
to: all
type: decision-request
re: apps/web/src/drawer/sections/SkillFileCard.tsx
status: open
created: 2026-08-16T12:35
---

## Context

Visual pass at 1440×900 against the now-working drawer and dashboards. The §2.3 drawer
renders correctly end to end and the §2.5 detail page is right — but both paint a **colour
emoji** into the chrome, which breaks BOARD constraint 1 and §1.3 ("chrome is monochrome;
colour appears only as data ink … this is 90% of why it looks expensive").

Rendered JSX literals, not comments:

| File | Line | Glyph |
|---|---|---|
| `drawer/sections/SkillFileCard.tsx` | 110, 123 | `⏰ Schedule` (the pill label, both enabled and disabled) |
| `dashboards/components/SignalsStrip.tsx` | 70 | `⏰` for the `wait` tone |

The subtlety, and why this slipped past everyone including a token validator: **`⚠` and `✓`
are fine.** Both are text-presentation glyphs by default and paint in `currentColor`, so
they inherit the ivory/amber/teal you set. `⏰` (U+23F0) has **no text-presentation
variant** — there is no `⏰︎` that renders as an outline. Every platform paints it as a
full-colour emoji, so it lands as a saturated red-orange clock that no CSS `color` can
touch. `check-tokens.mjs` cannot see it because there is no hex and no literal in the source.

§2.5 does say "status icon (⚠ amber / ✓ teal / **⏰ ivory**)" — so the spec named the glyph.
But it named it *with a colour*, and an emoji that cannot be ivory is not the thing the spec
asked for. The spec is describing the intent, not prescribing the codepoint.

## The ask

Replace the two `⏰` with a **lucide** icon (`Clock` or `AlarmClock`) at `currentColor`.
`lucide-react` is already a dependency and already used for job icons, so this adds nothing.

- `drawer-engineer` — `SkillFileCard.tsx:110,123`. Keep the pill label text "Schedule"; swap
  the glyph for `<Clock size={12} />`.
- `dashboards-engineer` — `SignalsStrip.tsx:70`. `⚠` and `✓` in the same switch are correct
  as-is; only the `wait` case needs changing. Do not "fix" the other two.
- `design-system-guardian` — worth a rule: **no emoji in chrome, ever; lucide or nothing.**
  A token validator cannot catch this class, so it needs to be written down where people
  read it, and ideally grepped for in `check-tokens.mjs` (a scan for the emoji presentation
  ranges would catch the next one).

There are two further `⏰` at `SkillFileCard.tsx:7,9` and one at
`run/useRunnerAvailability.ts:6` that are **inside doc comments** — harmless, but worth
changing in passing so nobody copies the pattern back into JSX.

## Meanwhile

Not fixing these myself: three separate owners, and `drawer-engineer` and
`dashboards-engineer` both have live handoffs I would be editing underneath. Nothing is
blocked on it — it is a fidelity defect, not a functional one, and it should ride whatever
milestone each of you has open rather than becoming its own.

Two other visual findings from the same pass, routed separately, not part of this ask:
map cluster labels overlap node labels in the department view (`ENRICHMENT` collides with
`LEAD SOURCING` at `/map/sales`) — `map-galaxy-engineer`. And the dark circle at the
bottom-left of every screenshot is **not ours**: it is Next's dev-mode indicator, because
`:4321` is currently served by `next dev`. Not a defect; do not chase it.
