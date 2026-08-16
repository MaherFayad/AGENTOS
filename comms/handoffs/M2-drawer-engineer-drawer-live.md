---
agent: drawer-engineer
milestone: M2
spec: §2.3, §2.6.5
created: 2026-08-16T15:00
status: ready-for-review
---

# M2 — the drawer renders real frontmatter, and the reason it didn't is not the one we were given

Both drawers were already built. What was broken was everything between them and the
runner. This handoff is mostly about that, plus one fidelity bug that had been visible in
every screenshot of the drawer since it was mounted.

## What exists now

- `apps/web/src/drawer/data/client.ts` — `slugPath()`, and both slug-in-path call sites
  (`fetchAgent`, `downloadUrl`) go through it.
- `apps/web/src/drawer/data/client.test.ts` — **new.** Pins the separator-survives /
  segment-is-escaped behaviour so this cannot regress silently.
- `apps/web/src/drawer/drawer.module.css` — `.panel:focus, .panel:focus-visible {
  outline: none }`, and **every type literal gone**: 26 rules now `@apply` a named §1.4
  role, tracking reads `var(--track-1|2|accent)`, and four off-scale sizes are documented
  local properties. `validate:tokens` is at **0 violations repo-wide**; the drawer was the
  last file failing it.
- `apps/web/src/drawer/run/transport.test.ts` — a fixture fix; the suite was red.
- `apps/runner/src/routes/api.ts` — `GET /api/agents` (the collection) mounted, and
  `GET /api/agents/` answers it too instead of 400.
- `packages/contracts/src/api.ts` — `AgentSummary`, `AgentsIndex`,
  `RUNNER_ROUTES.agentsIndex`.
- `comms/contracts/api-contracts.md` — the list route documented, plus the encoding rule
  callers kept guessing at.

## How to use it

```
GET /api/agents                       -> {agents:[{slug, path, frontmatter}], skipped:[…]}
GET /api/agents/sales/account-enrichment -> AgentDetail   (the slash is a path separator)
```

From the web side, nothing changed: `fetchAgent('sales/account-enrichment')`.

## The bug that was reported, and what it actually was

I was handed a confident root cause: `fetchAgent()` builds `` `/api/agents/${slug}` ``
without encoding, the slash becomes an extra path segment, Fastify 404s. **That is not
what was happening.** `RUNNER_ROUTES.agent.path` has been `'/api/agents/*'` — a wildcard —
this whole time, and the runner answers the unencoded path correctly:

```
curl -o /dev/null -w '%{http_code}' http://localhost:8787/api/agents/sales/account-enrichment
200
```

The supporting evidence in the report was two curls that don't test the claim: a **bare**
slug with no department (`/api/agents/account-enrichment` → 400, correct — that is the
runner telling you the id is a folder path) and a `%2F`-encoded slug (→ 200, because
`slugParam` decodes it). Neither one exercises `sales/account-enrichment` as written.

The real cause is one line, and it is not in the drawer:

```ts
// apps/web/src/drawer/run/transport.ts:46
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
```

Empty, so the browser requests `/api/*` **same-origin at :4321**, where Next serves no
such route. In production that is right: `infra/Caddyfile` proxies `/api/*` and `/ws/*` to
the runner, so same-origin is the correct shape. Locally there is no Caddy and no
substitute for it, so *every* runner-backed read 404s — the drawer, the cost ticker, the
connection status, and `ws://localhost:4321/ws/graph`. The map only looks alive because it
falls back to `public/graph.json`.

This is worth being precise about, because "the drawer 404s" and "nothing in the app can
reach the runner locally" get fixed by different people.

Setting `NEXT_PUBLIC_API_BASE=http://localhost:8787` does **not** fix it either — the
runner sends no CORS headers (correctly; it is same-origin behind Caddy and has no public
port, §3.6). Verified from the page:

```
fetch("http://localhost:8787/api/agents/sales/account-enrichment") -> BLOCKED: Failed to fetch
```

So the only correct local fix is a same-origin proxy that mirrors the Caddyfile. That is a
`next.config.mjs` rewrite, which is outside my file boundary — see *Deliberately not done*.

## What I did fix

**1. The browser-blue drawer border (BOARD constraint 3, §1.3).** Not a border and not a
token — the browser's own focus ring, `rgb(153, 200, 255)`:

```
{"tag":"DIV","cls":"glass rounded-panel shadow-drawer drawer_panel",
 "role":"dialog","tabindex":"-1","outline":"auto 1px rgb(153, 200, 255)","fv":true}
```

`.panel :focus-visible` is a **descendant** selector, so it never matched `.panel` itself —
and `.panel` is exactly what `useFocusTrap` calls `.focus()` on when the drawer opens.
Chrome matched its own `:focus-visible` on the panel root and painted `outline: auto`.
Seating focus on a dialog container is a screen-reader affordance, not a keyboard position
the user navigated to, so it now draws nothing; the ivory ring still belongs to the
controls inside. Confirmed `outline: none` on all seven agents checked.

**2. Slug-in-path encoding, done properly.** `encodeURIComponent(slug)` would have been the
wrong fix: it turns the separator into `%2F` and makes the URL disagree with the contract's
own example. `slugPath()` encodes **each segment** and joins with `/`. The separator
survives; a `%`, `?`, `#` or space inside a folder name no longer reaches the runner raw,
where `decodeURIComponent` would throw a URIError before any handler ran and surface as an
unexplained 500. Audited every other call site: `fetchRuns` (query param, already
encoded), `postApproval` (encodes `runId`), `postSchedule` (slug in the body),
`transport.ts` (slug in the body, `runId` encoded). All correct; only the two named above
needed changing.

**3. Type discipline — the drawer was the last file failing `validate:tokens`.** I had
written this up as blocked, on the reasoning that `tokens.css` has `--track-1…4` and no
font-size tokens, so a CSS module cannot express a size as `var()`. That was wrong, and
`rtl-arabic-pdpl-specialist` said so mid-session: `@apply text-label / text-meta /
text-small / text-pill / text-chip` works inside a CSS module and pulls size, weight and
leading out of `tailwind.config.ts` together. They had just taken `sessions.module.css`
from 34 violations to 0 the same way. So I did the drawer's 31 rather than escalate them.

Twenty-six rules now `@apply` a named rung. Four sizes have no rung and became documented
local properties on `.drawer` — `--drw-fs-title` (§2.3.2 specifies 24/700; the scale steps
16px → 28px and the title sits in that gap), `--drw-fs-close`, `--drw-fs-rung`,
`--drw-fs-badge` — which is the `--ses-fs-gate` precedent, not a new invention. Weights
were pinned explicitly wherever a rung would have changed one, and the result is
byte-identical rendering, checked against computed styles rather than by eye:

```
title 24px/700   sectionLabel 11px/500/3.3px   ladderLabel 9px/500/2.25px
chip 11px/400    description 13px/400   quote 13px/400   fieldLabel 11px/400
```

`npm run validate:tokens` → **0 violations, 281 files**.

**4. `GET /api/agents`.** Implemented rather than de-advertised. `listAgents` already
existed in `apps/runner/src/lib/agents.ts` and was unused by the API. `/api/agents/`
(trailing slash) used to answer 400 `bad_request`, which reads like the caller's mistake
when the route was simply missing; it now answers the collection. Returns summaries only —
no `body`, no `runnable` — because a twelve-tile matrix does not need twelve system
prompts. Unparseable files are absent from `agents[]` and named in `skipped[]`, the same
rule the map follows, so the two views cannot disagree about which agents exist.

## Contracts touched

- `comms/contracts/api-contracts.md` (owner: `runner-engineer`) — added the `GET
  /api/agents` row, the list-shape rationale, and the caller encoding rule. `packages/contracts/src/api.ts`
  updated to match, so the doc and the TypeScript agree. **This is an edit to a contract I
  do not own**, made under an explicit instruction to make the doc and the code agree.
  `decision-request` filed at
  `comms/inbox/runner-engineer/20260816-1500-drawer-engineer-agents-index-route.md` — if
  `runner-engineer` wants a different shape, it is three lines in `api.ts` and one row in
  the doc.
- `comms/contracts/frontmatter-schema.md` — consumed, unchanged.

## Deliberately not done

- **The local `/api/*` proxy — the actual reason the drawer 404s at :4321.** The fix is a
  `next.config.mjs` rewrite mirroring `infra/Caddyfile`, env-guarded so it is inert in
  production. `next.config.mjs` is outside the file boundary I was given, and a rewrite
  there is a real deployment decision that deserves its owner rather than a drive-by from
  the drawer. The exact patch is in
  `comms/inbox/shell-navigation-engineer/20260816-1500-drawer-engineer-local-api-proxy.md`.
  I did **not** take the alternative that *was* inside my boundary — CORS on the runner —
  because it is the worse answer: it forks the topology (cross-origin in dev, same-origin
  in prod) across SSE, preflights and credentials, to work around a missing proxy. Picking
  a worse fix because of where the file lives is how a codebase gets its scars.
- **10 `validate:rtl` findings in `drawer/sections/**`** — hardcoded user-facing strings
  (`ChartSections` 1, `Ladder` 1, `LastRuns` 2, `RunConsole` 3, `SkillFileCard` 3) that
  belong in `i18n/strings.en.ts`. Real and mine, but M8 work: `validate:rtl` is not in
  `npm run verify`, the repo is at 72 findings across five owners, and doing the drawer's
  ten in isolation is a worse use of one pass than doing them with the Arabic review that
  will read them. Flagged by `rtl-arabic-pdpl-specialist` mid-session; not regressed by
  anything here.
- **`⏰` in the Schedule button renders as a colour emoji glyph** — arguably colour in the
  chrome (§1.3), but the glyph is the spec's own (§2.3.4). Flagged, not changed.
- **`/chart` (the index route) throws a client-side exception** and renders nothing. Not my
  file (`chart-matrix-engineer`); `/chart/:department` is fine and is where I verified
  §2.6.5. `fyi` filed. It is *not* caused by the missing agents list — `loadChartAgents`
  handles a non-ok response and has an honest empty state.
- **Run/Schedule remain honestly disabled** where the runner is not reachable, and
  `Take it ↓` stays disabled while `DOWNLOAD_ROUTE_AGREED === false`. Unchanged by design:
  no fake ▶.

## Verification

Servers: the existing runner on :8787 was left running and untouched. Because the new
route needs a restart to mount, I verified it on a second runner at :8788, and verified
the drawers through a throwaway same-origin shim that mirrors the Caddyfile (web :4322,
runner :8787) — the shim lives in the scratchpad, not the repo.

```
npm run typecheck                      0 errors (web, runner, contracts)
npm run build                          ✓ Compiled successfully
npm run test:runner                    57 tests, 57 pass, 0 fail
npx vitest run src/drawer              8 files, 27 tests, all pass (was 1 failing)
npm run validate:tokens                0 violations, 281 files (drawer was 37; repo now green)
npm run validate:comms                 ok
npm run validate:rtl                   72 findings repo-wide, 10 in drawer/sections/** (M8, see above)
```

Route behaviour, against the runner carrying the change:

```
/api/agents                             200   (12 agents, 0 skipped)
/api/agents/                            200   (was 400)
/api/agents/sales/account-enrichment    200
/api/agents/account-enrichment          400   (correct: bare slug, keeps its hint)
```

Drawer, at 1440x900, **seven agents across all seven departments** — all render the full
anatomy, none shows "could not be loaded", none has a blue outline, zero console errors.
Re-run after the type refactor, so this is the final state, not a mid-session one:

| agent | eyebrow | sections rendered |
|---|---|---|
| `sales/account-enrichment` | FULLY AUTONOMOUS | breaks into · wired into · builds on · replaces · ladder · the human · last runs · inputs |
| `intelligence/company-deep-dive` | FULLY AUTONOMOUS | same eight |
| `back-office/invoice-chaser` | FULLY AUTONOMOUS | seven — **builds on collapsed** |
| `operations/agent-auditor` | FULLY AUTONOMOUS | seven — **builds on collapsed** |
| `marketing/content-repurposer` | HUMAN-ASSISTED | seven — **wired into collapsed** |
| `deals/proposal-drafter` | HUMAN-LED | eight |
| `customer/support-triage` | HUMAN-ASSISTED | seven |

The collapses are the point: optional sections vanish with no empty header (§2.3 rule),
and the eyebrow tracks `tier` from frontmatter rather than a constant — all three tiers
appear across the seven, with the ladder's active row moving to match each time.

§2.6.5 verified on `/chart/sales`: `side=end`, `view=chart`, 360px, cluster eyebrow
(ENRICHMENT), autonomy toggle row with FULLY AUTONOMOUS lit, REPLACES cost quote, WHAT IT
DOES, FROM MANUAL TO AUTONOMOUS with the `NOW` badge, SKILLS cards with Read → / Download ⬇
/ ▶ Run, TOOLS, HOW TO RUN IT. One component set, one `side` prop, as specified.

Screenshots were written to the session scratchpad (`after-sales.png`,
`after-sales-bottom.png`, `after-chart-drawer.png`, one per agent). They are ephemeral —
the reproduction is the shim plus `browse goto`, both described above.

## Next agent

`fidelity-qa-reviewer` for the §2.3 / §2.6.5 gate — start with *Deliberately not done*,
because item 1 decides whether the drawer can be reviewed at `localhost:4321` at all, and
item 2 is the open token debt. `shell-navigation-engineer` owns the unblock.
