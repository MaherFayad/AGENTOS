---
name: cc-panels
description: Build and wire Command Center dashboards (spec §2.4–2.5) — the 3D carousel, KPI tiles, signals strip, and the seven canonical widget types driven by panels/*.json. Use when adding a dashboard, adding a widget, or wiring a widget to Langfuse/Postgres data.
---

# cc-panels — dashboards are data, not code

Schema of record: `comms/contracts/panel-schema.md` (owner: `dashboards-engineer`).

## The rule

Adding a dashboard means adding a JSON file. If adding a dashboard requires writing a
component, the abstraction has failed — stop and fix the renderer instead.

There are exactly **seven** widget types (§2.5.5). They cover every widget in their video.
Do not add an eighth without an ADR:

`bar-list` · `source-bar-list` · `area-chart` · `cost-table` · `data-table` ·
`progress-table` · `activity-feed`

## Anatomy of a dashboard detail view (§2.5)

1. `← ALL DASHBOARDS` breadcrumb; title row 26px/700 + provider glyph +
   `⌨ Build guide + one-shot prompt` ghost button (emits the Claude Code prompt that
   rebuilds this panel — keep it, it's the cleverest thing they shipped).
2. Optional right-aligned segmented filter or time-range pills (`7d 14d 28d`).
3. KPI tile row (5–6): icon+label 11px `--ink-2` → 30px/600 tabular numeral →
   delta chip (▲ teal / ▼ coral) → 11px caption → 40×16 sparkline.
4. Signals strip (2–4): ⚠ amber / ✓ teal / ⏰ ivory + **bold lead phrase** + plain
   continuation. Signals are sentences, not labels.
5. Widget grid, 2 columns, 16px gap, widgets declare `span: 1 | 2`.
6. Rotated rail labels on both edges = previous/next dashboard, copper dot indicator,
   click to switch without returning to the carousel.

## Carousel (§2.4)

Eyebrow `THE OUTPUT LAYER` → **"Command Centers"** in Instrument Serif 44px → subtitle.
Cards over a dotted-grid floor with elliptical shadow: front ~720px, flanks
`rotateY(±35°)` receding into dark, drag-to-spin with momentum, ‹ › arrows, dot
indicators. Caption = wide-tracked serif caps title + one-liner + provider glyph.
Footer hint: `DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER`.

## Wiring data

Phase 1: `langfuse` + `static` sources only. **Agent runs ARE the activity feed** — wire
`activity-feed` and the ops KPIs (runs, cost, latency, error rate) first; those are real
on day one. Business widgets stay `static` placeholders until agents write Postgres rows,
and that's an honest state, not a gap to hide.

`sql` sources are **named, registered, parameterized queries** owned by the runner. A
panel JSON containing raw SQL is a security bug — reject it in review.

## Failure states

- Unknown widget type → bordered "unsupported widget" placeholder. Never crash a dashboard.
- Missing data → skeleton at the correct height, then a one-line `--ink-3` empty state.
  Never a spinner that shifts layout.
- All formatting goes through the shared formatters (`currency`, `number`, `percent`,
  `duration`, `relative-time`) with `tabular-nums`.
