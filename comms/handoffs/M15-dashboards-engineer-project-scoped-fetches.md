---
agent: dashboards-engineer
milestone: M15
spec: §2.4 · §2.5 · §2.5.7 (with `Plan §9`–§10, ADR-015)
created: 2026-08-17T18:45
status: ready-for-review
---

# M15 — DASHBOARDS reads its own project, and stops blaming the tailnet for its own bug

## What exists now

- `apps/web/src/dashboards/data/endpoints.ts` — every URL built from `PROJECT_ROUTE_PREFIX`
  + `projectPath` (`@agnetos/contracts`). **No `/api/…` literal remains.** A `null` project
  returns `unsupported` with `NO_PROJECT`, so `urlsOf` is empty and no request is made.
- `apps/web/src/dashboards/data/use-resolved.tsx` — reads the project once via
  `useProjectSegment()` (not `useShell()`, which throws outside its provider) and hands it to
  every plan. Widgets never see it. New `metricsRefused(status)` sentence for 4xx.
- `apps/web/src/dashboards/components/DashboardsView.tsx` — the panel list read is
  `RUNNER_ROUTES.panels.path` through `projectApiUrl`; three distinct empty sentences where
  there was one.
- `apps/web/src/dashboards/data/endpoints.test.ts` — **new.** Asserts the built URL, not the
  intent above it.
- `apps/web/src/dashboards/components/navigation.test.tsx` — **new.** Closes REQ-DSH-39's
  owed verification, plus the §2.5.7 CTA cases.
- `packages/contracts/src/panels.ts` — `PanelFooterCta`: `href` optional, `note` required
  without it.
- `scripts/validate-panels.mjs` + its test — enforces that pairing, and rejects a
  `/p/:project` segment inside a panel file.
- `panels/mission-control.json` — CTA carries `note`, not a dead `href`.
- `comms/contracts/panel-schema.md` — scoped endpoint table, the footer CTA section, and
  § *Panels and projects* recording what is true about the mount.

## How to use it

```ts
// A plan cannot be built without a project. This is the whole design.
planLangfuse({ metric: 'runs', range: '7d' }, { project: 'agentos', departments: DEPARTMENT_SLUGS });
// → { kind: 'scalar', url: '/api/p/agentos/metrics/query?metric=runs&range=7d', … }
planLangfuse({ metric: 'runs', range: '7d' }, { project: null });
// → { kind: 'unsupported', message: NO_PROJECT }   ← and urlsOf() === []
```

Adding a dashboard is still adding a JSON file. Nothing in this pass added a component or an
eighth widget type.

## Contracts touched

- **`comms/contracts/panel-schema.md` (mine).** Endpoint table scoped; `footer.cta` documented
  for the first time; § *Panels and projects* added. No ADR — the CTA change is a schema
  addition inside my own contract, additive and validator-enforced.
- **`comms/contracts/project-scoping.md` (`runner-engineer`'s).** Not edited. Its §5.1 Q8 is
  the untrue line this pass chased; see below.
- `packages/contracts/src/panels.ts` is mine; `api.ts` / `project.ts` are read, not edited.

## The finding the dispatch asked for, answered both ways

**Did a refused metric render as a zero, an empty series or a dash? No.** `resolve.ts`'s
`gate()` resolves every plan's URLs to a verdict *before* any body is read, on all six plan
shapes, so throughout the unscoped period all six Command Centers resolved `unavailable`.
**BOARD rule 9 held — by construction, not by vigilance**, which is why it survived a
milestone nobody was watching it through. Now pinned by REQ-DSH-42.

**What was broken was the diagnosis.** `readOne` mapped every `!response.ok` to
`METRICS_OFFLINE` — *"Cannot reach the runner… This box may be off the tailnet."* So six
dashboards told the reader to check their network for a fault that was one line of client
code. That is smaller than the map's version (nothing stale was drawn, no number was faked)
and it is the same mechanism, and it is still a screen telling a person something untrue.
Fixed as REQ-DSH-43; a 4xx now names its status and says the runner is reachable.

**Second-order, and worse in kind:** `DashboardsView` caught the 400 and printed *"No Command
Centers to show. Add a panels/\*.json file"* — a routing fault reported as an empty folder,
which sends someone to look in the right place for the wrong reason. Three sentences now.

## Deliberately not done

- **The per-project panel mount — the contradiction closed under me, and the remainder is
  now mine.** I was dispatched to chase §5.1 Q8's untrue half to *"contract says what is
  true, or a filed, owned, dated item"*. **`runner-engineer` reached the first state while
  this pass was in flight:** Q8 now carries the mount mechanism plus a table of what is and
  is not built, and **Q8a** answers the sub-question Q8 had declined. The runner half is real
  — `GET /api/p/:project/panels[/:id]` serves `MountedProject.panelsDir`, and `lib/panels.ts`
  cannot import `RunnerConfig`, so a project route *physically cannot* serve another
  project's dashboards (`routes/__tests__/project-derived-reads.test.ts`). My
  `decision-request` was drafted and then deleted unsent, because it asked for a change that
  had already been made; replaced by an `fyi`
  (`inbox/runner-engineer/20260817-1850-…-q8a-lands-the-same-answer-and-i-am-taking-the-web-half.md`).
  **`panel-schema.md` was rewritten to match** — it had briefly carried the same stale claim
  I was filing against, which is the sin in miniature and is why it is called out here.
- **We converged, and both refused the same shortcut.** I answered Q8's declined
  sub-question from the consumer side — *nothing, no fallthrough* — in the same session,
  without seeing Q8a. More useful than the agreement: **both answers explicitly decline to
  inherit ADR-014's reasoning**, which had just been accepted and whose conclusion was
  sitting there correct-looking and free. ADR-014 ruled against fallthrough for *agents* on a
  capability ceiling panels have no analogue for. Their reason 2 is the one I could not have
  found from here — *there is no coordinator tier in the mount model at all*, so a
  fallthrough answer would require inventing a tier to hold a default — and `panel-schema.md`
  cites theirs rather than restating mine.
- **The web half: half shipped, half is one decision I did not rush.** Q8a assigns
  `loadPanels()` and the two page components to me, with the correction that unstuck it —
  *"the resolver they asked for is a route, not a fourth candidate."* The **client** read is
  migrated in this pass (REQ-DSH-44). The **server-side disk read is not a rename**: it
  exists so the carousel works with no runner at all, and a disk read cannot name the project
  it read — which is exactly the ambient default ADR-015 removes, so threading `project` into
  `loadPanels()` buys a parameter and no guarantee. Either it is dropped in favour of the
  route, or kept and made to declare itself coordinator-local and unverified. Dated, owned by
  me, scheduled with the ops-KPI pass. Until then six Command Centers render identically in
  every project — true of exactly one project today, so **latent, not live**.
- **§2.5.7's CTA is not a link, and that is the fix rather than a shortfall.** The approvals
  view does not exist in any project, and linking to it is worse than a 404: the legacy
  resolver re-prefixes any path it does not recognise, so `/approvals` walks
  `/p/x/approvals` → `/p/x/p/x/approvals` → … unbounded. Reported to
  `shell-navigation-engineer` as a resolver bug in its own right — push deep links
  (`/approvals/:id`, `/runs/:id`) trigger it too, and those are not mine. The label and the
  easter-egg footer stay; the day the view lands this is a one-line JSON edit.
- **`ledger.state` on a 200.** A connected-ledger `{value: 0}` and an unreachable-ledger 200
  still render identically. Named by `observability-engineer` and genuinely open — it is the
  one remaining way this module could draw a zero it has not earned. Goes in with the ops-KPI
  wiring; recorded rather than half-built.
- **The project half of the receipt check.** The echo carries `filter.projectId` (a uuid the
  client does not know) and a sibling `project.slug` (which it does). The honest check is
  against `project.slug` and it is a different path from the filter receipt. Owed.
- **`cost_by_account` / `/metrics/accounts` widgets, and `run_not_in_project` /
  `project_scope_unset` as distinct sentences.** No consumer yet; both filed.
- **Live numbers.** Still zero runs, still no `RUNNER_ANTHROPIC_API_KEY`. Every widget is an
  honest empty state and this pass did not change that — it changed which sentence it prints.

## Verification

```
npx tsc --noEmit -p apps/web/tsconfig.json     → clean
npm run test:web                               → both halves ran, both green (574 vitest + 92 node:test)
node scripts/validate-panels.mjs               → 6 panels, 7 of 7 widget types, no raw SQL
node --test scripts/__tests__/validate-panels.test.mjs → 27 pass, 0 fail
npm run validate:coverage                      → 0 FAILs (671 requirements, 634 implemented)
node scripts/check-rtl.mjs --gate              → exit 0, no new debt
```

`node scripts/check-tokens.mjs`, provenance banner verbatim:

```
Token discipline
  scanned at        2026-08-17 18:33 +03:00 · 1dd9ec4 · 23 uncommitted under apps/web
  files scanned     311
  violations        0
  exemptions        2
```

Nothing committed, per the dispatch. The `23 uncommitted` are this pass.

**One finding came in against this pass mid-flight and is closed.** `chart-matrix-engineer`
caught `check-rtl --gate` going red on my uncommitted tree — `module:dashboards/data 3 → 4`.
The new string was a second sentence on the 4xx message: *"The runner is reachable — this is
a fault in what was asked for, not in the connection."* True, and redundant: **"refused"
already carries it.** Deleted rather than catalogued or baselined. The honest way to not
raise a ratchet is to write less copy, not to buy permission for copy that was not earning
its place — and `rtl-baseline.json` is untouched. (Their quoted line, `endpoints.ts:181`, was
pre-existing debt that had only moved line number; the module delta was the exact half.)

*One token judgement worth naming:* the CTA's pending `note` is `--ink-2`, not `--ink-3`. It
is the only thing on screen explaining why the label above it is not clickable, so it is
required reading and the disabled token is unavailable to it (`design-tokens.md` §9.2's
delete-the-text test). `dashboards-contrast.test.ts` enforces an empty `--ink-3` allowlist and
would have caught it; it did, on the first run.

## Next agent

`fidelity-qa-reviewer` — review-request filed. Start with
`apps/web/src/dashboards/data/endpoints.ts`'s header, then `endpoints.test.ts`: the claim
worth checking is that no path literal remains and that no project builds no URL.

`runner-engineer` owns the open decision (Q8). `observability-engineer` has a small ask
(lift `METRICS_ROUTES` into `packages/contracts` so the last copy dies).
`shell-navigation-engineer` has the resolver loop, which is larger than my CTA.
