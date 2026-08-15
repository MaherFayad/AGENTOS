# CONTRACT — `panels/*.json` dashboard definitions

**Owner:** `dashboards-engineer` · **Source:** spec §2.4–2.5 · **Status:** draft

Dashboards are **data, not code**. One JSON file per Command Center. Adding a dashboard
must never mean writing a component. The seven widget types below cover every widget
observed in their video — build exactly these, no more.

## Envelope

```jsonc
{
  "id": "hubspot-sales-pipeline",
  "title": "HubSpot · Sales Pipeline",       // 26px/700 title row
  "caption": "Every deal, every stall, one screen",
  "railTitle": "SALES PIPELINE",              // rotated edge rail label (§2.5.6)
  "provider": "hubspot",                      // glyph key
  "order": 2,                                 // carousel position
  "buildPrompt": "…",                         // ⌨ "Build guide + one-shot prompt" (§2.5.1)
  "filters": { "type": "segmented", "options": ["All","Stalled","Closing ≤30d"] },
  "kpis": [ … ], "signals": [ … ], "widgets": [ … ]
}
```

## Query object — every data-bearing element carries one

```jsonc
"query": {
  "source": "langfuse" | "sql" | "static",
  // langfuse: metric over agent runs
  "metric": "runs" | "cost" | "latency_p50" | "error_rate",
  "filter": { "agent": "account-enrichment", "department": "sales" },
  "range": "7d",
  // sql: named, parameterized, read-only. NEVER inline user-controlled SQL.
  "name": "pipeline_by_stage", "params": { "days": 30 },
  // static: literal value for scaffolding before the data exists
  "value": 44500
}
```

Phase 1 ships `langfuse` + `static` only (§2.5 data source note). `sql` queries are
registered by name in the runner; the panel references the name. **A panel file can
never contain raw SQL.**

## KPI tile (§2.5.3)

```jsonc
{ "label": "Pipeline value", "icon": "wallet", "format": "currency",
  "query": {…}, "delta": { "query": {…}, "goodDirection": "up" },
  "caption": "vs previous 28d", "sparkline": { "query": {…}, "tone": "teal" } }
```
Renders: 11px `--ink-2` icon+label → 30px/600 tabular numeral → delta chip
(▲ `--ink-teal` / ▼ `--ink-coral`, sign flipped when `goodDirection: "down"`) →
11px caption → 40×16 sparkline. Numerals count up 300ms on mount.

## Signal (§2.5.4)

```jsonc
{ "tone": "warn" | "ok" | "wait", "lead": "$44,500 stalled across 2 deals",
  "detail": "oldest untouched 33d. Reactivation drafts ready.", "query": {…} }
```
Icon ⚠ amber / ✓ teal / ⏰ ivory + bold lead + `--ink-2` continuation. 2–4 per dashboard.

## The seven widget types

| `type` | Shape | Notes |
|---|---|---|
| `bar-list` | `{rows:[{label,value}], tone:"coral", valueAlign:"right"}` | Pipeline by stage |
| `source-bar-list` | same, `tone:"grey"`, `format:"currency"` | spend by source |
| `area-chart` | `{series:[{t,v}], tone:"coral"\|"lavender", annotations:[{t,label}]}` | 20% fill under stroke, spike annotations on hover |
| `cost-table` | `{rows:[{label, sub?, value}], total?}` | right-rail values |
| `data-table` | `{columns:[{key,label,type:"text"\|"chip"\|"number"}], rows:[…], sortable:true, rowAction:"peek"}` | chip column: ✓ teal outline, `! Stalled` coral, `⏱` neutral |
| `progress-table` | `{rows:[{label, phase, progress:0..1, status:"on-track"\|"at-risk"}]}` | teal track, status chip |
| `activity-feed` | `{query:{source:"langfuse"}, limit:12}` | `09:41 Meeting transcript processed · 4 action items assigned — Follow-Up Coordinator` — bold event + `--ink-2` attribution |

Grid: 2 columns, 16px gap. A widget declares `span: 1 | 2`.

## Rules

1. Unknown `type` → render a bordered "unsupported widget" placeholder, never crash.
2. Missing data → skeleton at correct height, then empty state (`--ink-3`, one line).
   Never a spinner that shifts layout.
3. Every value formats through one shared formatter (`currency`, `number`, `percent`,
   `duration`, `relative-time`) with `tabular-nums`.
4. `buildPrompt` emits our Claude Code one-shot prompt to rebuild the panel — keep it,
   it's the cleverest thing on their site (§2.5.1).
5. The activity feed is real: agent runs **are** the activity (§2.5 data note). Wire it
   to Langfuse first; business widgets light up later as agents write Postgres rows.

## Envelope fields beyond the sketch

- `schemaVersion` — currently `1`. Bump in `packages/contracts/src/panels.ts` and the validator together.
- `department[]` — ADR-001 slugs. An array because `pipeline` covers `sales` and `deals`.
- `emptyState` — required on every `sql`-backed widget. One sentence naming the agent that will fill it.
- `pending` — required on every signal that has a query. What the strip says before the figure exists.
- `note` — required on every `static` query. Provenance, in a sentence. An unsourced literal is a fabricated number.
- `range: "$range"` — binds the query to the panel's time-range pills. Illegal without `filters.type: "range"`.
- Query result state machine: `ok | empty | unavailable | error`. `unavailable` is not an error — it is a source that is correct but not wired in this phase (every `sql` query today).

## Ours, not theirs

Their six are Meta Ads / HubSpot / Mission Control / Content / Outbound / Finance.
**Ours** ([ADR-004](../decisions/ADR-004-command-centers.md), accepted): six Command Centers covering all seven departments, with `sales` and `deals` sharing `pipeline`. A seventh center is a new `panels/*.json` file, never a component.

| order | `id` | Title | `provider` | Departments | Real on day one? |
|---|---|---|---|---|---|
| 1 | `mission-control` | Mission Control · Agent Ops | `langfuse` | `operations` | Yes — every widget |
| 2 | `pipeline` | Pipeline · Sales & Deals | `postgres` | `sales`, `deals` | No — empty states |
| 3 | `client-delivery` | Client Delivery · Engagements | `postgres` | `customer` | Partly — activity feed |
| 4 | `content-studio` | Content · Studio & Distribution | `postgres` | `marketing` | Partly — activity feed |
| 5 | `product-funnels` | Amplitude · Product Funnels | `amplitude` | `intelligence` | No — empty states |
| 6 | `finance` | Finance · Spend & Runway | `langfuse` | `back-office` | Partly — agent spend |

Provider glyphs are abstract monochrome marks (`apps/web/src/dashboards/lib/icons.tsx`), not vendor logos. Phase 1 resolves `langfuse` + `static` only; `sql` names are declared from day one and render `emptyState`.
