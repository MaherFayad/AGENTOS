# ADR-035 — One declaration per runtime name in a barrel, and a gate that loads the artifact

**Date:** 2026-08-17 · **Author:** `agent-library-curator` · **Status:** accepted
**Affects:** `packages/contracts/**` (all consumers) · `contracts/frontmatter-schema.md` ·
ADR-001 · ADR-002 · every milestone's acceptance gate

## Context

The web app white-screened on **every route**. It was found by the user booting it for the
first time — by dogfooding, not by any instrument in this repo.

`apps/web/src/components/shell/route.ts:88` called `isProjectSlug(...)` and got:

```
TypeError: (0 , _barrel_optimize_names_isProjectSlug_agnetos_contracts__WEBPACK_IMPORTED_MODULE_0__.isProjectSlug)
is not a function
```

`route.ts` runs inside `ShellProvider` → `AppShell` → `(views)/layout.tsx`, so all four
views were down. The dev server named the cause itself:

```
The requested module '__barrel_optimize__?names=isProjectSlug&wildcard!=!./frontmatter'
contains conflicting star exports for the name 'DEPARTMENTS' with the previous requested
module '__barrel_optimize__?names=isProjectSlug&wildcard!=!./departments'
```

`packages/contracts/src/index.ts` is a barrel of `export * from './x'` lines, and
`apps/web/next.config.mjs` lists `@agnetos/contracts` in `optimizePackageImports`. Next's
barrel optimizer resolves those wildcards **separately from** any explicit re-export. It
hit `DEPARTMENTS` — declared as a 7-slug `as const` tuple in `frontmatter.ts:31` *and* as
the ordered `DepartmentInfo[]` in `departments.ts:60` — and **discarded the whole barrel**.
Every named import from `@agnetos/contracts` in a client component became `undefined`.
`isProjectSlug` was simply the first one called.

`index.ts` already carried an "ambiguity resolution" for it, and the comment on that line
is the defect in miniature:

> When it is removed, this line becomes redundant but **stays harmless**.

It was not harmless. It was fatal, and it had presumably been fatal since the barrel
existed. That sentence is a declared value that nobody observed — the same class BOARD
already lists five instances of.

### The larger context: no gate in this repo loads a page

Measured on the broken tree, not inferred:

| Instrument | Result on the broken tree |
|---|---|
| `npx tsc --noEmit` | **clean**, both projects. TypeScript resolves the barrel correctly; an explicit `export { X } from` silences TS2308 outright |
| `npm test` · `test:web` · `test:runner` | **green**. They import the TypeScript directly and never run a bundler |
| `validate:coverage` · tokens · RTL · frontmatter · comms | **green** |
| `npx next build` | **exit 0**, and its log contains no warning at all |
| `curl -s .../p/agentos/map` | **200**, with 31 KB of correct SSR HTML |

Every one of those inspects **source text**. None observes **the artifact running**. That
is why a milestone with a passing acceptance review shipped a dead app, and it is why the
`curl` line is on the list: SSR of a client component does not go through the browser
bundle, so a 200 with complete HTML was true throughout the outage.

## Options

| Option | For | Against |
|---|---|---|
| **A** — keep both declarations, add another explicit re-export | one line | It is what was already there and what failed. The explicit re-export is *invisible to the wildcard resolution*; it fixes `tsc` and nothing else. It also makes the source look decided |
| **B** — rename one (`DEPARTMENT_TABLE`) | small diff | Leaves two declarations of one enum, contradicting ADR-001, and the next duplicate is unguarded. Treats the symptom |
| **C** — one declaration site + a static checker + a runtime smoke | removes the class; the checker runs in ms; the smoke observes the artifact for the first time | Three files instead of one line. The smoke needs a booted server |
| **D** — drop `@agnetos/contracts` from `optimizePackageImports` | one line, restores the app | Hides a real duplicate rather than removing it, and buys a bundle-size regression with it. The duplicate is still wrong under ADR-001 |

## Decision

**We take C, and we state the rule in a form that covers the class rather than the
instance: within a barrel, no runtime name may be declared by two `export *` modules, and
an explicit re-export is never a valid resolution for one.**

1. **`departments.ts` is the single declaration site of the department enum.**
   `DEPARTMENT_SLUGS` becomes the primary literal `as const` tuple (`z.enum` needs a tuple;
   `readonly DepartmentSlug[]` does not type-check there), `DEPARTMENT_LABELS` moves beside
   it typed `Record<DepartmentSlug, string>` so the two lists cannot drift, and
   `DEPARTMENTS` (the angle/rail table) is derived from both. `frontmatter.ts` keeps
   `export type Department = DepartmentSlug` — an alias, never a second declaration — and
   imports the tuple for `z.enum` and `clusterRegistrySchema`.
2. **`index.ts` loses the `DEPARTMENTS` resolution line.** Type-only resolutions stay and
   are safe *because they are erased*: `export type { GraphDelta }` emits no runtime
   binding, so no bundler ever sees two of them. The distinction is now written where the
   next person adds a line.
3. **`scripts/check-barrel-exports.mjs`** enforces the rule from source, in milliseconds,
   with no build. It fails on a duplicate runtime name across starred modules **and**
   separately on an explicit value re-export that shadows one — because that workaround is
   what compiles and still breaks.
4. **`scripts/smoke-routes.mjs`** boots a real `next dev`, requests every route, and fails
   on a broken bundle. It is the first thing in this repo that observes the artifact.

## Consequences

**Easy now.** Adding a contract module is safe: `npm run validate:barrel` says whether it
collided, by name, with the reason attached. The department enum has one home, which is
what ADR-001 said all along and what `frontmatter.ts`'s own comment claimed was already
true (*"`departments.ts` imports this array rather than restating it"* — it did not).

**Harder now.** Two owners can no longer each keep a private copy of a shared enum "for
convenience". That is the intended cost.

**What the smoke gate does and does not prove — stated here because a gate cited wider than
it is, is worse than no gate.** It checks three things: the dev compile log for
`Attempted import error` / `conflicting star exports` / `Failed to compile` / `Module not
found`; that every route answers 2xx and renders the §2.0 tab bar; and that every
`__barrel_optimize__?names=N` module in the client chunks actually exports `N` — the
artifact carries its own assertion, and that is the check that diagnoses this class without
a browser.

**It is not a substitute for the static checker, and the reason is a measurement that
surprised me.** A **cold** `next dev` on the *unfixed* tree produces healthy barrels and
the smoke passes; the user's long-running dev server, on identical source, served
`?names=isProjectSlug` as a 63-export module with `isProjectSlug` absent. So the
manifestation is **stateful** — the duplicate is a standing precondition that a particular
compilation order converts into an outage. Consequences, and they bind on how each gate is
cited:

- `check-barrel-exports.mjs` is the **reliable** gate. It fails deterministically on the
  precondition, and it fails on the real broken tree at `1e5b5d7`.
- `smoke-routes.mjs` catches the **manifestation when present**. Proven positively — run
  against the still-broken dev server it named the exact defect on nine chunks; run against
  the restarted server on the fixed tree it passes. It **did not** catch the cold-boot
  build of the broken tree, and that is recorded rather than smoothed over.
- Therefore **a green smoke does not mean the tree is sound.** Both run, and the static one
  is the one a milestone gates on.

**What a fuller version needs.** A headless browser. Nothing shipped here catches a runtime
error whose cause is not a missing import — a null deref in an effect, a hydration
mismatch, a thrown render — because that needs a real page load with `console` and
`pageerror` listeners. That is the same dependency Part VI's 1440px screenshot comparison
has been blocked on since M0, and one browser in CI buys both. Filed as one costed request,
not two.

**If we reverse this.** Re-declaring a department name anywhere turns three things red:
`validate:barrel`, `scripts/__tests__/barrel-exports.test.mjs`, and
`validate-frontmatter.mjs`'s drift check, which now reads the enum from `departments.ts`
and separately refuses a `DEPARTMENT*` value declared in `frontmatter.ts`.

## Contract edits

- `packages/contracts/src/departments.ts` — `DEPARTMENT_SLUGS` becomes the primary
  `as const` tuple (was `readonly DepartmentSlug[]`, derived); `DEPARTMENT_LABELS` moves
  here from `frontmatter.ts`; `DEPARTMENTS` and `DepartmentSlug` derive from them. The
  ordered table, angles, neighbours and every function are unchanged in value — verified by
  `chart/components/ChartView.test.tsx` and `scripts/lib/layout.test.mjs`.
- `packages/contracts/src/frontmatter.ts` — `export const DEPARTMENTS` and
  `export const DEPARTMENT_LABELS` **deleted**. `export type Department` becomes an alias of
  `DepartmentSlug`. No exported name is lost from `@agnetos/contracts`: both values are
  still exported, from `departments.ts`.
- `packages/contracts/src/index.ts` — the `DEPARTMENTS` resolution line deleted; the
  ambiguity-resolution comment rewritten to say that a **value** collision is a defect and
  only a **type** collision may be resolved there.
- `scripts/validate-frontmatter.mjs` — the ADR-002 drift check reads `DEPARTMENT_SLUGS`
  from `departments.ts`; a new assertion fails if `frontmatter.ts` declares any
  `DEPARTMENT*` value again.
- `comms/contracts/frontmatter-schema.md` — the `department` enum's stated source of truth
  moves to `departments.ts`. No field, value or order changes; **the seven slugs and their
  order are exactly as ADR-001 fixed them.**
