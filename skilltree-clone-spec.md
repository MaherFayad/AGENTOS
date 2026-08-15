# COMMAND CENTER — Full Build Specification

**A self-hosted SkillTree with remote control.** Same look fidelity as skilltree.altari.ai (design tokens extracted from their live CSS; product UI reverse-engineered frame-by-frame from their demo video), plus the features they don't have: continue Claude Code sessions remotely, run/deploy agents from anywhere including your phone, real observability, all on your own Docker.

Sources for this spec: live-site CSS variable extraction (their actual `:root` and `body.light` tokens), full-page section captures, and 16 frames from their product demo video (`demo2.mp4`, 1340×1056, 31.6s).

---

# PART I — VERIFIED DESIGN SYSTEM

These are **their real tokens**, read from the site's stylesheet. Use verbatim.

## 1.1 Color — dark theme (`:root`, the product default)

```css
:root {
  --bg:        #111114;   /* app background */
  --bg-2:      #1B1B21;   /* raised surfaces */
  --bg-3:      #060608;   /* deepest wells (map canvas edge, hero frame) */
  --ivory:     #ECECEE;   /* primary text + node fill */
  --ivory-2:   #B2B2B9;   /* secondary text */
  --ink-2:     #84848C;   /* tertiary text / labels */
  --ink-3:     #6B6B73;   /* faint text / disabled */
  --copper:    #ECECEE;   /* accent (dark mode maps copper→ivory for CTAs) */
  --copper-ink:#131315;   /* text on copper */
  --line:      rgba(255,255,255,.10);  /* hairlines */
  --line-2:    rgba(255,255,255,.16);  /* stronger hairlines */
  --card:      rgba(255,255,255,.025); /* card fill */
  --card-2:    rgba(255,255,255,.05);  /* card hover / raised */
  --glass:     rgba(13,13,15,.72);     /* floating nav / drawers (with backdrop-blur) */
  --screen:    #101013;   /* embedded "screen" panels */
  --screen-2:  #16161A;
}
```

## 1.2 Color — light theme (`body.light`, marketing default)

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

Theme toggle = swapping a `light` class on `<body>`. Same variable names everywhere; components never hardcode color.

## 1.3 Accent colors observed in the product video (not in :root — component-level)

| Use | Approx value | Where seen |
|---|---|---|
| Copper/orange connector dots & live-node ring | `#C9784A` → `#E08A50` | orange satellite dots on map edges, "0 OF 22 LIVE" counter numeral, NAVIGATION label |
| Teal/mint success | `#4ECDB0` | progress bars "On track", positive KPI deltas, check chips |
| Coral/red alert | `#E5484D` / `#F06A6D` | "At risk" chip, stalled deals, pipeline-by-stage bars, area-chart stroke on content dashboard |
| Lavender/indigo | `#8B8DF0` / `#A5A7F5` | Meta Ads dashboard area fill + demo-card chips on marketing site |
| Amber warning | `#E5A13C` | signal warnings, "Limited build slots" chip |
| Blue link | `#6AA1F0` | sparse (links, HubSpot icon tint) |

Rule they follow: **chrome is monochrome** (ivory/ink/line on near-black); color appears only as *data ink* — status, deltas, charts — plus the single copper accent for "alive" things. This is 90% of why it looks expensive. Do not add color anywhere else.

## 1.4 Typography (verified via computed styles)

| Role | Font | Size / weight / spacing |
|---|---|---|
| Display H1 | **Plus Jakarta Sans** | 86px / 700 / letter-spacing −2.4px (−0.028em) |
| H1 accent words | **Instrument Serif**, italic | 91px / 400 / −0.01em — *the italic serif inside bold sans headlines is THE brand signature* |
| H2 | Plus Jakarta Sans | 50px / 700 / −1.4px |
| Body | Plus Jakarta Sans | 16px / 400 / 1.6 line-height |
| Small / meta | Plus Jakarta Sans | 12–13px / 400–600 |
| Wide-tracked labels (department names, eyebrows, "META ADS · PAID ACQUISITION") | Plus Jakarta Sans or Instrument Serif caps | 11–13px / 500 / **letter-spacing +0.25em to +0.45em**, uppercase |
| Dashboard KPI numerals | Plus Jakarta Sans | 28–32px / 600, tabular-nums |

Both fonts are on Google Fonts (OFL). Self-host via `@fontsource/plus-jakarta-sans` + `@fontsource/instrument-serif` — no external requests.

**Arabic note (your market):** pair with **IBM Plex Sans Arabic** (body) and keep Instrument Serif for Latin accents only; MSA labels stay noun-form, no italics in Arabic (use weight contrast instead). `dir="rtl"` flips the drawer side and rail labels.

## 1.5 Shape, depth, texture

- Radii: pills/buttons **999px**; cards **12–16px**; drawers/panels **16–20px**; KPI tiles **12px**.
- Borders: 1px `var(--line)` on every card; `--line-2` on hover. No shadows in dark mode except drawers (`0 8px 40px rgba(0,0,0,.5)`); light mode uses soft `0 1px 3px rgba(20,20,24,.06)`.
- **Dotted-grid texture** on canvases (map bg, dashboards carousel bg): radial-gradient dots, `rgba(255,255,255,.04)` at ~22px spacing.
- **Starfield** on the map: ~200 random 1px points at opacity .05–.15 + a soft central galaxy glow (`radial-gradient` copper→transparent, blur 60px).
- Glass surfaces (`--glass`) get `backdrop-filter: blur(14px)`.
- Buttons: primary = `--copper` bg, `--copper-ink` text, pill, 13px/600; secondary = transparent, 1px `--line-2` border, pill.

## 1.6 Motion

- Section-level fades on scroll: opacity 0→1 + translateY(12px→0), 500ms `cubic-bezier(.2,.7,.2,1)` (their marketing site does this everywhere — the app should keep it for panels/drawers only).
- Map: nodes spring on drag (d3-force `alphaTarget(0.3)` restart), edges relax over ~600ms; department transition = zoom+pan (`d3-zoom` transform, 700ms ease-in-out) with cross-fade of labels.
- Drawer: slide-in from left (map) / right (chart) 320ms; scrim `rgba(0,0,0,.4)`.
- Dashboard carousel: 3D `perspective(1400px) rotateY(±35°)` cards, drag-to-spin with momentum, front card scales 1.0, rear cards 0.82 + brightness(.5).
- KPI numbers count up on mount (300ms). Progress bars animate width on mount.

---

# PART II — THE PRODUCT (screen-by-screen, from the demo video)

## 2.0 App shell (identical on all three views)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [⛶]  [🔍 Search jobs________]     MAP | DASHBOARDS | CHART     NAVIGATION  [📅 Book a call] │  ← top bar, transparent over canvas
│                                                                      │
│                            (view canvas)                             │
│                                                                      │
│  ?  −  [zoom%]                                       [💬 Feedback]   │  ← bottom corners
└──────────────────────────────────────────────────────────────────────┘
```

- Top-left: fullscreen toggle (⛶, 32px ghost square) then **search input** (pill, `--card` bg, 1px `--line`, placeholder "Search jobs" on MAP/CHART, "Search panels" on DASHBOARDS). Search = fuzzy over agent names/descriptions; result click = fly-to-node.
- Top-center: **segmented control** — three wide-tracked uppercase tabs; active tab = ivory pill with dark text (dark mode: ivory bg, `#131315` text), inactive = `--ink-2` text, letter-spacing .25em, 11px.
- Top-right: eyebrow label (e.g. `NAVIGATION` in copper 10px/.35em) + **"Book a call"** secondary pill → replace ours with **"+ New session"** (primary action: spawn a Claude session).
- Bottom-left: `?` help pill, `−`/`+` zoom, zoom-level readout. Bottom-right: Feedback pill → ours becomes **connection status** (Tailscale ● online / runner queue depth).
- Context breadcrumb strip (appears in drill-ins): `← ALL DEPARTMENTS` top-left under bar; top-right counter `N OF 22 LIVE · YOUR TREE` — copper numeral, ivory small-caps.

**Our two additions to the shell (don't disturb the layout):** a `SESSIONS` fourth tab (remote Claude Code sessions — see §3.1), and a tiny cost ticker next to the status pill (`$12.40 today`, from Langfuse). Keep both in the same type style; the shell stays monochrome.

## 2.1 MAP — galaxy view (all departments)

What the video shows:

- Full-viewport near-black canvas (`--bg` → vignette to `--bg-3` at edges), dotted grid + starfield.
- **Center: a dense particle "galaxy"** — hundreds of 1–2px multicolor particles (copper/teal/coral/lavender at low saturation) in a swirl, with one bright core dot. This represents the Second Brain / company core. Slow idle rotation (~120s/rev), particles shimmer (opacity noise). Implement as a single `<canvas>` layer: 600 particles on a logarithmic spiral + gaussian jitter, hue picked from the data-ink palette, additive blending.
- **7 radial department branches** around the core at even angles. Each department = a wide-tracked serif-caps label (18–20px, `--ivory-2`, +0.4em) with 3 tiny sub-labels beneath (11px `--ink-3`, e.g. под MARKETING: "content · brand · distribution"), and a **tree of nodes** growing outward from an anchor node.
- **Nodes:** filled circles, `--ivory` fill; three sizes — anchor (44px, contains a line-icon in `--copper-ink`… actually dark ink on ivory), job node (28–32px, line icon), leaf/skill dot (8–10px, plain). Live nodes get a **copper ring** (2px, +4px offset) and a small orange satellite dot on their outbound edge. Dormant nodes are dimmed to 45% opacity.
- **Edges:** 1px `rgba(255,255,255,.14)`, slight curves (quadratic), with occasional **orange pulse dots** traveling along edges of live branches (2px dot, 3s linear, staggered) — this is the "alive" feel.
- Bottom-center: department name of the branch nearest viewport center fades in large (`DEALS`) with ‹ › arrows either side to rotate focus between departments.
- Interactions: pan (drag empty space), zoom (wheel/pinch, 30%–300%), drag nodes (springy), hover node → name label fades in under it, click node → **drill to department view** centered on it, click department label → department view.

Build: **D3 force simulation** (`d3-force`: link + manyBody + radial per-department + collision), rendered to SVG for nodes/labels + one canvas underlay for particles/starfield. Precompute layout server-side once per skills-repo change, store positions, hydrate client-side so the map is stable between visits (SkillTree's is stable). ~150 nodes = trivial perf.

## 2.2 MAP — department view (drill-in)

- Zooms into one branch; giant watermark department name behind the graph (`SALES`, Instrument Serif caps, ~160px, `rgba(236,236,238,.05)`).
- Sub-cluster labels float in wide-tracked caps around node groups: `LEAD SOURCING`, `ENRICHMENT`, `OUTREACH WRITING`, `TARGETING`, `SEQUENCING & SEND` (11px, `--ink-2`, +0.35em).
- Adjacent departments appear as **rotated rail labels** on screen edges (`BACK OFFICE` left rail, `DEALS` right rail, vertical writing-mode) with ‹ › chevrons — click to slide horizontally to the neighbor. 
- Top-right: `0 OF 22 LIVE · YOUR TREE` (copper number = live count in this department; "YOUR TREE" is a toggle to filter to only installed/live agents).
- Node click → **left drawer** (§2.3). Everything else as galaxy view.

## 2.3 MAP — job drawer (left panel, ~300px, `--glass` + blur, full height)

Anatomy top-to-bottom (from the Account Enrichment frame):

1. Eyebrow: autonomy state — `FULLY AUTONOMOUS` (10px caps, +.3em, copper) + close ✕ top-right.
2. **Title** 24px/700 ivory: *Account Enrichment*. Breadcrumb 12px `--ink-2`: `Sales · Enrichment`.
3. Description 13px `--ivory-2`, 2–3 lines.
4. **Skill-file card** (1px line, 12px radius): `⬇ 1 runnable skill file · yours to download` + `Take it ↓` ghost button → ours downloads the SKILL.md folder zip *and* offers **▶ Run now** (primary, copper) + **⏰ Schedule** — the two buttons SkillTree doesn't have.
5. `BREAKS INTO` — chips (mono-ish 11px, 1px border, 6px radius): sub-skills (`firmographic-appender`, `tech-stack-detector`, `growth-signal-scorer`). Click chip → fly to that leaf node.
6. `WIRED INTO` — plain text list of external tools/MCPs (`Exa · Firecrawl`).
7. `BUILDS ON` — dashed-border chip linking prerequisite agent (`Database Mining`).
8. `WHAT IT REPLACES` — quote box (`--card` bg): the manual-work sentence.
9. `THE LADDER` — three rows, small caps left labels `HUMAN-LED / HUMAN-ASSISTED / FULLY AUTONOMOUS`, active row ivory, others `--ink-3`; 12px explanation each. This is the autonomy maturity model per agent.
10. `THE HUMAN` — closing paragraph: what the human still owns.

**Our additions to the drawer** (below THE HUMAN, same visual grammar): `LAST RUNS` — 5 rows from Langfuse (relative time, status dot, cost, duration; click → trace URL); `INPUTS` — form fields generated from frontmatter `inputs:` used by ▶ Run; live SSE output console (monospace 12px, `--screen` bg) that slides up over the drawer while a run streams.

## 2.4 DASHBOARDS — carousel (the "Command Centers")

- Header center: eyebrow `THE OUTPUT LAYER` (caps, +.35em) → **"Command Centers"** (Instrument Serif, 44px) → sub "what each department looks like *when the work runs itself*".
- **3D carousel** of dashboard cards over dotted-grid floor with elliptical shadow: front card ~720px wide, flanking cards rotated ±35° receding into dark, drag-to-spin, ‹ › arrows, dot indicators. Caption under front card: wide-tracked serif caps title `META ADS · PAID ACQUISITION` + one-liner (`Every dollar, every lead, every fatigue signal · one screen`) + provider glyph.
- Footer hint: `DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER`.
- Six centers (theirs): Meta Ads · Paid Acquisition / HubSpot · Sales Pipeline / Mission Control · Client Delivery / Instagram+TikTok · Content / Outbound / Finance. **Ours:** map 1:1 to your stack — e.g. Amplitude · Product Funnels, Pipeline, Client Delivery, Content, Ops, Finance — each backed by a JSON panel definition, not hardcode.

## 2.5 DASHBOARDS — dashboard detail (click front card)

Common anatomy (verified across three dashboards in the video):

1. Breadcrumb `← ALL DASHBOARDS`; title row: **"HubSpot · Sales Pipeline"** 26px/700 + provider icon + `⌨ Build guide + one-shot prompt` ghost button (opens the agent prompt that generates this dashboard — keep this, it's genuinely clever: ours emits the Claude Code one-shot prompt to rebuild the panel).
2. Optional segmented filter right-aligned (`All / Stalled / Closing ≤30d`) or time-range pills (`7d 14d 28d`).
3. **KPI tile row** (5–6 tiles): icon+label 11px `--ink-2` → numeral 30px/600 tabular → delta chip (▲ teal / ▼ coral, 11px) → sub-caption 11px + **mini sparkline** (coral/teal, 40×16 svg).
4. **Signals strip**: 2–4 items, each = status icon (⚠ amber / ✓ teal / ⏰ ivory) + bold lead phrase + plain continuation ("$44,500 stalled across 2 deals · oldest untouched 33d. Reactivation drafts ready.").
5. **Widget grid** (2-col, 16px gap), observed widget types — build exactly these seven, they cover everything:
   - horizontal **bar list** (Pipeline by stage — coral bars, value right-aligned)
   - **source bar list** (grey bars + $ values)
   - **area chart** (Daily views — coral stroke, 20% fill, spike annotations on hover; lavender variant on Meta Ads)
   - **spend/cost table** with right rail values
   - **data table** with chip column (deal stage chips: ✓ teal outline, `! Stalled` coral, `⏱` neutral), sortable, "click a row to peek inside"
   - **progress-bar table** (Engagements: client, phase, teal progress track, status chip `✓ On track` / `! At risk`)
   - **activity feed** ("This morning, run by agents" — timestamped rows, 2-line entries: bold event + `--ink-2` agent role attribution, e.g. `09:41 Meeting transcript processed · 4 action items assigned, recap drafted — Follow-Up Coordinator`)
6. Vertical rail labels on both edges (rotated 90°, wide-tracked caps, `--ink-3`): previous/next dashboard names (`META ADS` ←, `FINANCE` →) with a copper dot indicator — click to switch without going back to the carousel.
7. Their easter egg footer on Mission Control: "**This is the actual product.** Your delivery ops, running like this · agents doing the work, you approving it." + `Get this deployed →` — ours links to the runner's approvals queue.

**Data source for ours:** every widget reads from a `panels/*.json` definition = `{title, provider, kpis[], signals[], widgets[]}` where each widget declares `type` + a **query** — either `langfuse` (runs/cost/latency), `sql` (Postgres where agents write structured outputs), or `static`. Phase 1 ships Langfuse-backed KPI tiles + activity feed (agents runs ARE the activity feed); business dashboards light up as agents start writing rows.

## 2.6 CHART — the AI rollout matrix

Their org-chart tab is actually a **rollout planning board** (the deployment-order playbook, visualized):

1. Department tab bar across top (Sales · Deals · Marketing · Operations · Intelligence · Customer · Back Office), active = ivory underline.
2. Title block: **"Marketing · the AI rollout"** + bold stat line "**18 of 23 jobs** run autonomously · **5 assisted** · the rest stay human". Right: legend chips for the three autonomy tiers.
3. **Matrix**: rows = autonomy tiers (`Human-led — a person drives it`, `Human-assisted — AI drafts, a human approves`, `Fully autonomous — AI runs it unattended`), each row header has icon + jobs-count pill. Columns = **rollout phases** `1 Foundation — Data + the company brain / 2 Capture — Classify, extract, score / 3 Generate — Produce work, take action / 4 Orchestrate — Agents, monitoring, loops`, each with 4-segment progress dashes.
4. **Job cards** in cells: icon square + name 13px/600 + phase tag (`1 · Foundation` + tier dots ●●○○) + expand chevron. Hover = `--card-2`. Expanded (video shows Company Deep-Dive) = inline description + SKILLS chip + `More detail →`.
5. `More detail` → **right drawer** (mirror of map drawer): eyebrow `COMPANIES` + title, autonomy toggle row, `REPLACES` (cost quote box: "A junior analyst day ($300–500 equivalent) per company researched properly…"), `WHAT IT DOES`, `FROM MANUAL TO AUTONOMOUS` 3-step ladder with `NOW` badge on current state, `SKILLS` cards (name + description + `Read →` `Download ⬇` — ours adds **Run**), `TOOLS` chips (Exa, Firecrawl), `HOW TO RUN IT` paragraph.
6. Empty cells render as subtle diagonal-hatch blocks (`repeating-linear-gradient`, `--line` at 45°).

Chart data = same frontmatter, different projection: `tier × phase` grid instead of force layout. One data source, three views — exactly their architecture.

## 2.7 Marketing-site elements worth cloning for your login/landing page (optional, Phase 4)

Floating pill navbar (glass, blur); light hero with 86px headline + serif italic accents; badge pill `137 AGENTS MAPPED · 100 FOUNDING SEATS`; sticky bottom bar (`Founding cohort · full · waitlist open` + CTA); before/after strikethrough stats (`~~2 hrs~~ → 4 min`); "What is actually in the box" priced line-items table; FAQ accordions; the 4-step "Install → Interview → Second brain → Live" card row. All same tokens.

---

# PART III — THE EXTRA FEATURES (what SkillTree doesn't have)

## 3.1 SESSIONS tab — continue Claude Code anywhere

Fourth tab in the shell. A list of live/recent interactive sessions (from **Happy** self-hosted relay, or Omnara): session name, repo, model, state (working / waiting on permission / idle), elapsed, cost. Click → full-screen session view: streaming transcript (monospace on `--screen`), permission prompts as copper action cards (**Allow / Deny** pills), input box to steer. This is a thin UI over happy-server's API — the E2E encryption stays intact (decrypt client-side with your key). Phone: this tab is the whole reason the PWA exists; permission prompts also arrive as push notifications.

## 3.2 Run & deploy from the map

- ▶ **Run now** in every drawer → `POST /api/run {agent, inputs}` → runner spawns headless Claude Agent SDK session (system prompt = SKILL.md + COMPANY.md; tools from frontmatter allowlist; cwd = per-run scratch workspace) → SSE stream to drawer console → trace + cost to Langfuse → output artifact (md/pdf/json) saved + optionally delivered (Slack/email per frontmatter `deliver:`).
- ⏰ **Schedule** → writes `schedule: cron` into frontmatter (git commit via API) → ofelia sync regenerates cron jobs. Scheduled nodes get a tiny clock badge on the map.
- **Approvals**: frontmatter `approval: required` inserts a human gate — run pauses at plan stage, pushes notification, MAP node pulses amber until you approve from phone.

## 3.3 Second Brain (their interview, done properly)

`company/COMPANY.md` + `company/sources/*` (docs it can cite). The **interview** is itself an agent on the map (center node, click → drawer → Run): ~20 questions (offers, ICP, pricing, tone incl. Arabic/MSA register, red lines, PDPL constraints), writes/updates COMPANY.md, git history = brain versioning. Every runner invocation injects COMPANY.md. The center galaxy particle count/brightness scales with brain completeness — a delightful, honest progress indicator.

## 3.4 Audit engine

`agent-auditor` agent (Operations branch): walks the repo + Langfuse API → report: frontmatter gaps, stale agents (0 runs / 30d), failing agents (error rate), missing connector creds, orphan skills; writes `audit/report.md` + marks nodes (amber halo) via a `status` field it commits. Their "audit any company and hand back a marked map" sales motion = point the same agent at a prospect's answers, output the map screenshot + deployment plan PDF.

## 3.5 Observability

Langfuse self-hosted = the DASHBOARDS data plane for agent ops (runs, cost, latency, traces, per-agent error rate). The activity feed widget and "N OF 22 LIVE" counters read Langfuse; business widgets read Postgres rows agents write. Cost ticker in shell header. PDPL: traces stay on your box; keep the Postgres volume local, encrypt backups.

## 3.6 Phone

The app is a **PWA** (manifest + service worker + icon): installs to home screen, dark themed, safe-area aware. Map is touch-native (pinch/drag already). Push notifications via the Happy relay (permission prompts, run failures, approval requests). Access only over **Tailscale** — the app has no auth of its own in v1 because it is unreachable off your tailnet; the day you expose it, put Authelia/Cloudflare Access in front first.

---

# PART IV — DATA MODEL

One agent = one folder. Frontmatter is the single source of truth for all three views.

```yaml
# agents/sales/account-enrichment/SKILL.md
name: Account Enrichment
description: Layer firmographics, tech stack, and headcount trends onto target accounts.
department: sales            # branch (7 canonical)
cluster: enrichment          # sub-cluster label on the map
icon: building               # lucide icon name
tier: autonomous             # human-led | assisted | autonomous  (CHART row + drawer eyebrow)
phase: 2-capture             # 1-foundation | 2-capture | 3-generate | 4-orchestrate (CHART column)
status: live                 # live | draft | failing  (map halo; live counter)
breaks_into: [firmographic-appender, tech-stack-detector, growth-signal-scorer]
builds_on: [database-mining]
wired_into: [exa, firecrawl] # MCP/tool names; runner allowlist derives from this
replaces: "The research step everyone skips: outreach to a company you don't understand reads like spam because it is."
ladder:
  human-led: "A glance at the website before the call."
  assisted: "Tech stack, headcount trends, and growth signals appended to every target account on demand."
  autonomous: "Accounts re-enrich on a schedule; material changes trigger alerts to the targeting layer."
the_human: "AI owns the work. A human audits outputs on a cadence and owns the strategy it executes."
inputs:
  - {key: account_url, label: "Account website", type: url, required: true}
schedule: "0 6 * * 1"        # optional
approval: none               # none | required
deliver: {slack: "#sales-ops"}
---
(system prompt / skill body)
```

Repo layout: `agents/{department}/{agent}/SKILL.md`, `company/COMPANY.md`, `panels/*.json`, `audit/`. Seed from `gtmagents/gtm-agents` (Apache-2.0) + `wshobson/agents` (MIT) + `contains-studio/agents` + your almosafer-*/eyvar-*/cavecrew skills, normalized to this frontmatter by a one-shot migration agent. Curate to ~60 good agents; grow weekly (their "new agent every week" = your git log).

---

# PART V — ARCHITECTURE & COMPOSE

```
Docker on your machine (later: identical compose on a VPS)
├── web        Next.js 15 app — MAP / DASHBOARDS / CHART / SESSIONS, PWA
├── runner     Node + @anthropic-ai/claude-agent-sdk — /api/run (SSE), /api/schedule, approvals
├── happy      slopus/happy-server — E2E session relay (or omnara)
├── langfuse   + postgres — traces, cost, run history; postgres also holds agent output rows
├── ofelia     cron — fires runner from frontmatter schedules
└── caddy      one entry point, binds to Tailscale IP only, routes /,/api,/traces,/relay
Access: Tailscale mesh + MagicDNS TLS. No public ports. Phone = PWA over tailnet.
Billing: interactive sessions = your Claude subscription (via Happy wrapping the CLI).
         runner = separate API key workspace with hard monthly cap.
```

Frontend stack: Next.js + Tailwind (tokens as CSS vars above) + **D3** (force map — more control over the exact physics/feel than Cytoscape) + one `<canvas>` particle layer + Framer Motion (drawers/carousel) + `@fontsource` fonts. No component library — this design is 1px borders and type discipline; a library would fight the fidelity.

Repo watcher: chokidar on `/agents` (ro mount) → re-parse frontmatter → push layout deltas over WebSocket → map animates new nodes in (their weekly-drop moment, live).

---

# PART VI — BUILD PLAN

| # | Milestone | Contents | Effort |
|---|---|---|---|
| 0 | Foundations | Tailscale mesh; repo skeleton + frontmatter schema + seed import agent; tokens/theme in Tailwind config | ½ day |
| 1 | Shell + MAP galaxy | App shell, segmented tabs, search; D3 force layout precompute; starfield+galaxy canvas; nodes/edges/labels; pan/zoom/drag; department focus arrows | 2 days |
| 2 | Department view + drawer | Drill-in zoom, watermark, rail navigation, sub-clusters; full drawer anatomy (§2.3) read-only | 1–2 days |
| 3 | Runner + Run now | Agent SDK service, SSE console in drawer, Langfuse wiring, cost ticker, LAST RUNS | 2 days |
| 4 | SESSIONS tab | happy-server compose + session list + stream view + permission cards; PWA manifest + push | 1–2 days |
| 5 | CHART | Matrix projection, job cards, right drawer, department tabs | 1–2 days |
| 6 | DASHBOARDS | Carousel + 7 widget types + panels/*.json + Langfuse-backed ops panels + activity feed | 2–3 days |
| 7 | Schedule + audit + interview | ofelia sync, schedule badges, approvals flow, agent-auditor, company-interview agent | 1–2 days |
| 8 | Polish | Light theme, Arabic/RTL pass, edge pulses, count-up numbers, empty states, mobile QA | ongoing |

Acceptance for "same look fidelity": side-by-side screenshot of your MAP vs their video frame at 1440px should differ only in content. The tokens above make that achievable; the discipline part is resisting extra color and extra chrome.

---

# PART VII — HONEST FLAGS

1. **Design lift is real.** The galaxy+physics feel is ~30% of the build. Milestones 1–2 are where fidelity lives or dies; everything after is standard app work.
2. **Clone the look for yourself, not for resale.** Design isn't copyrightable as such, but shipping a pixel-identical product commercially under a similar name invites trouble and, more importantly, is beneath what you'd build anyway. For your own command center: fair game. If this ever becomes a product (your DGA/award world knows you), re-skin the tokens — the architecture is yours either way.
3. **Their "137 agents" is marketing volume.** Your 60 curated + genuinely runnable agents with live status halos will be more impressive than their map, because yours shows real runs.
4. **PDPL (real flag, since agents will touch client data):** keep Langfuse+Postgres volumes local/GCC-hosted, no US SaaS traces, and put data-handling constraints into COMPANY.md so every agent inherits them.
