---
agent: agent-library-curator
milestone: M16 (stop-the-line, not an M16 slice)
spec: PART IV · PART VI · ADR-001 · ADR-002 · ADR-035
created: 2026-08-17T23:28
status: ready-for-review
---

# Stop-the-line — the `DEPARTMENTS` collision that took every route down, and the gate that could not see it

## What exists now

**The fix — one declaration site for the department enum.**

- `packages/contracts/src/departments.ts` — `DEPARTMENT_SLUGS` is now the primary literal
  `as const` tuple and the only declaration of the department enum in the repo.
  `DEPARTMENT_LABELS` moved here, typed `Record<DepartmentSlug, string>` so the slug list
  and the label list cannot drift. `DEPARTMENTS` (the ordered slug · label · index ·
  `angleDeg` · `angleRad` · `neighbours` table) and `DepartmentSlug` derive from those two.
  Every value it produces is byte-identical to before.
- `packages/contracts/src/frontmatter.ts` — `export const DEPARTMENTS` and
  `export const DEPARTMENT_LABELS` **deleted**. `export type Department = DepartmentSlug`
  is now an alias. `z.enum(DEPARTMENT_SLUGS)` and `clusterRegistrySchema` consume the
  imported tuple.
- `packages/contracts/src/index.ts` — the `export { DEPARTMENTS } from './departments'`
  resolution **deleted**, and the ambiguity-resolution comment rewritten to say that a
  **value** collision is a defect to fix at the source, while a **type** collision is
  resolvable there precisely because types are erased. `export type { GraphDelta }` stays
  and is now explained rather than grouped with the thing that was fatal.

**The gates.**

- `scripts/check-barrel-exports.mjs` · `npm run validate:barrel` — static, no build,
  milliseconds. Fails on a runtime name exported by two `export *` modules of a barrel, and
  separately on an explicit `export { X } from` that shadows a starred **value**. Added to
  `npm run verify`.
- `scripts/smoke-routes.mjs` · `npm run smoke` — boots a real `next dev` on a private
  `distDir`, requests nine routes, and fails on (a) `Attempted import error` /
  `conflicting star exports` / `Failed to compile` / `Module not found` in the compile log,
  (b) a non-2xx or a missing §2.0 tab bar, (c) any `__barrel_optimize__?names=N` client
  module that does not export `N`. New script `npm run verify:runtime` = `verify` + `smoke`.
- `scripts/__tests__/barrel-exports.test.mjs` — 8 tests, in `npm test`. The last two read
  the **real** `index.ts` and the real `departments.ts`/`frontmatter.ts`, so the collision
  cannot return without a red test.
- `scripts/validate-frontmatter.mjs` — the ADR-002 drift check now reads `DEPARTMENT_SLUGS`
  from `departments.ts`, and separately fails if `frontmatter.ts` declares any `DEPARTMENT*`
  value again.

**Supporting edits.** `apps/web/next.config.mjs` (dev `distDir` honours `NEXT_DIST_DIR`),
`apps/web/tsconfig.json` (one `include` line for `.next-smoke/types`), `.gitignore`
(`.next-smoke/`), `package.json` (three scripts). The first two are **not obviously mine**
and are filed for reassignment — `comms/inbox/commandcenter-orchestrator/20260817-2326-…`.

**Documents.** `comms/decisions/ADR-035-…` (accepted) ·
`comms/contracts/frontmatter-schema.md` (where the enum lives) ·
`comms/specs/agent-library.md` (REQ-LIB-45–48, each with a real test).

## How to use it

```bash
npm run validate:barrel     # deterministic; gate milestones on this
npm run smoke               # boots next dev on its own distDir, checks the artifact
npm run smoke -- --base http://127.0.0.1:4321   # or point it at a server already up
npm run verify:runtime      # verify + smoke
```

Importing the enum, from anywhere:

```ts
import { DEPARTMENT_SLUGS, DEPARTMENT_LABELS, DEPARTMENTS, type Department } from '@agnetos/contracts';
// DEPARTMENT_SLUGS  the literal tuple — z.enum, iteration
// DEPARTMENT_LABELS Record<slug, label>
// DEPARTMENTS       the ordered angle/rail table (DepartmentInfo[])
// Department        the slug union (alias of DepartmentSlug)
```

## Contracts touched

- **`comms/contracts/frontmatter-schema.md`** (mine) — a new paragraph under *Resolved —
  ADR-001* naming `departments.ts` as the enum's declaration site and why. **No field, no
  value, no order changed. The seven slugs are exactly as ADR-001 fixed them**, so no
  consumer of the contract changes.
- **ADR-035** is new and accepted; it is the rule the two gates enforce.
- **ADR-001 and ADR-002 are unchanged and now actually true.** ADR-001 always said
  `departments.ts` owns the array; `frontmatter.ts`'s own comment claimed `departments.ts`
  *"imports this array rather than restating it"*. Neither was true until today.

## Deliberately not done

- **No headless browser.** `smoke-routes.mjs` catches exactly one class of runtime failure
  — an import that resolved to `undefined` — because Next names each barrel module after
  the symbol it is supposed to provide, so the artifact carries its own assertion. A null
  deref in an effect, a hydration mismatch or a thrown render needs a real page load with
  `console`/`pageerror` listeners. Filed as one costed request to `fidelity-qa-reviewer`
  (`…/20260817-2327-…`) rather than built, and deliberately merged with Part VI's 1440px
  screenshot gap because **one browser binary buys both** and two separate asks for one
  dependency is how neither gets funded. I did use Chrome headless once by hand, as
  evidence; I did not make a gate depend on a locally installed browser.
- **The dispatch's suggested first version — grep the *build* log — is not what shipped,
  because I measured it and it does not work.** `npx next build` on the broken tree exits 0
  and its log contains **no** `Attempted import error`, no `conflicting star exports`, no
  warning of any kind. Those strings appear in the **dev** compile log only. That is why the
  smoke boots a dev server instead of grepping a build, and it is the one place I did not
  follow the dispatch as written.
- **I did not make the smoke a reliable detector of this bug, because it is not one.** A
  **cold** `next dev` on the *unfixed* tree produces healthy barrels and the smoke passes.
  The manifestation is stateful: the duplicate is a standing precondition that some
  compilation order converts into an outage. I spent four experiments trying to force it
  (single edit to `project.ts`, edits to both colliding modules, cold boot, cold boot with
  a wiped `distDir`) and reproduced it in none. I stopped rather than keep going, because
  the static checker already refuses the precondition deterministically and that is the
  gate a milestone should hang on. **What the trigger actually is remains unknown** and is
  written down as unknown.
- **I did not remove `@agnetos/contracts` from `optimizePackageImports`.** It would have
  restored the app in one line and hidden a real ADR-001 violation while costing bundle
  size. Option D in ADR-035.
- **I did not extend `check-barrel-exports.mjs` beyond `packages/contracts/src/index.ts`.**
  It takes paths on argv and `DEFAULT_BARRELS` is one line, so the day another package grows
  an `index.ts` it is a one-line change. Policing barrels that do not exist is not a gate.
- **I did not chase the eighth `engineering` department**, the cluster registry, or any Part
  IV seeding work. This was a stop-the-line dispatch and the tree is uncommitted.
- **`check-comms.mjs` was not taught to see a code comment that names a `comms/` path.** The
  `index.ts` comment claimed the duplicate was *"flagged to `agent-library-curator` — see
  `comms/inbox/agent-library-curator/…-departments-collision.md`"*. **That file was never
  written.** A checker for it is real machinery for one instance; the finding is filed to
  `commandcenter-orchestrator` as a second instance of the routing rule M15 earned, and left
  as a protocol matter.

## Verification

**Everything below was run, not read.** The `curl` line is on this list because it is the
one that fooled the last reader.

*The diagnosis, without a browser.* Fetching the dev server's own `layout.js` and reading
the barrel module it names:

```
user's dev server, broken tree:  __barrel_optimize__?names=isProjectSlug  → 63 exports, hasIsProjectSlug=false
cold dev server, fixed tree:     __barrel_optimize__?names=isProjectSlug  →  1 export,  hasIsProjectSlug=true
```

*The gates, falsified by planting the defect rather than by reading the diff.*

| Act | Result |
|---|---|
| `validate:barrel` on the fixed tree | exit 0 — 7 `export *` modules · 95 runtime names · 0 collisions |
| `validate:barrel` on the **real** unfixed HEAD (`git checkout` of the three files) | **exit 1**, naming `DEPARTMENTS` in both modules **and** the papered-over re-export |
| `tsc --noEmit` on that same unfixed HEAD | **exit 0** — the trap, reproduced |
| `smoke` against the **live broken** dev server | **exit 1**, naming `?names=isProjectSlug does NOT export isProjectSlug` on nine chunks |
| `smoke` against the restarted server on the fixed tree | exit 0 — 9 routes · 29 chunks · 90 barrel modules · compile log clean |
| `smoke` against a **cold** dev server on the unfixed tree | **exit 0 — it did not catch it.** Recorded, not smoothed over |
| the checker's own first version, with the collision planted | **passed** — `stripNoise` blanked string literals and so blanked every `from './x'`, leaving 0 star targets. A green result over an empty set. Fixed, and the checker now fails if it scans nothing |

*A real browser, once, by hand.* Chrome headless `--dump-dom --virtual-time-budget=12000`
on `/p/agentos/map` after the fix: **120 645 bytes post-hydration against 31 710 of SSR**,
7 `canvas` elements, the LIVE counter present, and no `is not a function` anywhere in the
console log — only the service worker's `CacheStorage` errors, which are a throwaway
headless profile, not app code.

*The gate list from the dispatch, on the fixed tree.*

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0, all three projects |
| `npm test` | 177 tests · 176 pass · 0 fail · 1 skip (was 169; +8 mine) |
| `npm run test:web` | both halves green — vitest and `node:test` |
| `npm run test:runner` | 230 tests · 227 pass · 0 fail · **3 skip** — the same three on `DATABASE_URL is not set` that BOARD already tracks; I did not change them |
| `npm run validate:coverage` | exit 0 · **0 FAILs** · 727 requirements · 689 (95%) · warns only |
| `npm run validate:frontmatter` | 12 files · 12 valid · 0 excluded · departments 2·2·2·2·2·1·1 |
| `npm run validate:barrel` | 0 collisions |
| `npm run validate:tokens` · `panels` · `rtl:gate` · `comms` | unchanged and green; RTL holds at baseline **308** |
| `npm run smoke` | 9 routes · 29 chunks · 90 barrel modules · clean |

**Nothing is committed**, per the dispatch. `git status` is the six modified files, the two
new scripts, the new test, the ADR, three comms messages and this handoff.

**One thing this handoff cannot claim.** M16's distinction applies here too: *the app boots
and every route renders*. It has still never executed a run — `RUNNER_ANTHROPIC_API_KEY` is
unset — so "the app works" means the four views render honest empty states, which is what
CLAUDE.md rule 9 asks for and is not the same as the product working.

## Next agent

`fidelity-qa-reviewer` — `comms/inbox/fidelity-qa-reviewer/20260817-2327-…` first; it asks
one thing (a headless browser, merged with the Part VI screenshot gap) and proposes one
sentence for the interim standard's text. Then ADR-035's *Consequences*, which is where the
two gates' widths are stated.

`commandcenter-orchestrator` — `comms/inbox/commandcenter-orchestrator/20260817-2326-…`:
the proposed BOARD bullet, and the two files I edited that are probably not mine
(`apps/web/next.config.mjs`, `apps/web/tsconfig.json`).

**Everyone else** — `comms/inbox/_all/20260817-2325-…`. One paragraph matters: the next
duplicate exported name in `@agnetos/contracts` takes the whole app down again, from any
module, and `npm run validate:barrel` is now the thing that says so.
