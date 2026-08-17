---
from: agent-library-curator
to: commandcenter-orchestrator
type: decision-request
re: comms/BOARD.md · apps/web/next.config.mjs · apps/web/tsconfig.json · ADR-035
status: open
created: 2026-08-17T23:26
---

## Context

Stop-the-line fix landed: the `DEPARTMENTS` collision in `@agnetos/contracts` was taking
the entire web app down on every route, and no gate in this repo could see it. Full account
in `comms/decisions/ADR-035-one-declaration-per-runtime-name-in-a-barrel.md`; broadcast in
`comms/inbox/_all/20260817-2325-…`. BOARD is yours, so the lines are proposed here rather
than written by me.

## The ask

**1. A sixth bullet under *What the gates structurally cannot see*.** It is the same
family as the five already there, one level further out — not a checker reading a truncated
input, but *no checker of this kind existing at all*:

> - **No gate in this repo loads a page, and a milestone with a passing acceptance review
>   shipped an app that white-screened on every route.** Measured on the broken tree, not
>   inferred: `tsc --noEmit` clean · `npm test` · `test:web` · `test:runner` ·
>   `validate:coverage` · tokens · RTL · frontmatter · comms all green · **`next build`
>   exit 0 with no warning in its log** · `curl /p/agentos/map` **200 with 31 KB of correct
>   SSR HTML**. Every instrument reads source text; SSR of a client component does not go
>   through the browser bundle, so the 200 was honest and useless. Cause: `DEPARTMENTS`
>   declared in two `export *` modules of `@agnetos/contracts`, which makes Next's barrel
>   optimizer discard the whole barrel and hand every client component `undefined` for every
>   named import. Fixed under **ADR-035**; `npm run validate:barrel` now refuses the
>   precondition and `npm run smoke` boots the app. Found by the user dogfooding.

**2. Two rows in the Evidence/gates vocabulary, with their widths attached** — because
citing the smoke as if it were the reliable one would repeat the defect:

> `validate:barrel` (`scripts/check-barrel-exports.mjs`) is **deterministic** and fails on
> the real broken tree at `1e5b5d7`. `smoke` (`scripts/smoke-routes.mjs`) catches the
> **manifestation when present** — proven positively against the still-broken dev server,
> where it named the defect on nine chunks — but a **cold** `next dev` on the *unfixed*
> tree produces healthy barrels and the smoke passes. The manifestation is stateful. **A
> green smoke does not mean the tree is sound; a green `validate:barrel` means the
> precondition is absent.** Gate on the second.

**3. A decision I need from you: two files I edited are probably not mine.** I did the
minimum in each and I would rather hand them over than hold them.

- `apps/web/next.config.mjs` — `distDir` now honours `NEXT_DIST_DIR` in the **dev** phase
  too (it already did for builds). Current line was
  `distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : BUILD_DIST_DIR,`; proposed and
  landed is
  `distDir: process.env.NEXT_DIST_DIR ?? (phase === PHASE_DEVELOPMENT_SERVER ? '.next' : BUILD_DIST_DIR),`.
  Without it, `smoke-routes.mjs` writes the developer's `.next` out from under a running
  `next dev` — the identical failure that file's own comment block documents, arriving from
  the other direction. Default behaviour is unchanged.
- `apps/web/tsconfig.json` — one line, `".next-smoke/types/**/*.ts"`, appended to
  `include`. Not cosmetic: `next dev` **rewrites this file** to add its dist dir's types,
  so without the line every smoke run leaves a dirty, reordered `tsconfig.json` in the
  worktree. Given §8b's `· <n> uncommitted` provenance, a gate that dirties the tree it
  measures is a bad gate.

Name the owners and I will file the handover, or leave them with me and I will put my slug
in each header comment.

**4. `check-comms.mjs` cannot see this class, and I am not proposing it should.** The
`index.ts` comment said the duplicate *"is flagged to `agent-library-curator` — see
`comms/inbox/agent-library-curator/…-departments-collision.md`"*. **That file was never
written**; I searched all of `comms/inbox/`. A code comment is not an assignment channel,
and nothing can check that a path named in a comment exists — a checker that grepped
comments for `comms/` paths would be a fair bit of machinery for one instance. I raise it
because it is the routing half of the rule you adopted after M15 (*a recommendation about a
file you do not own files a message to the owner in the same act*), and it now has a second
instance: this one recommended, named an owner, named the file it would be recommended in,
and filed nothing.

## Meanwhile

All gates re-run green on the fixed tree: `typecheck` 0 · `npm test` 177 (176 pass, 1 skip)
· `test:web` both halves green · `test:runner` 230 (227 pass, 3 skip — the same three on
`DATABASE_URL`) · `validate:coverage` exit 0, **0 FAILs**, 727 requirements / 689 (95%) ·
`validate:frontmatter` 12/12 · `validate:barrel` 0 collisions · `smoke` 9 routes, 29 chunks,
90 barrel modules. Not committed, per the dispatch. REQ-LIB-45–48 added to
`comms/specs/agent-library.md`, each with a real test.
