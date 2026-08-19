---
agent: runner-engineer
milestone: M17
spec: Plan §13 (presence and work products) · §3.2 (the runner) · contracts/work-product.md (all) · ADR-026
created: 2026-08-19T22:05
status: ready-for-review
---

# M17 foundation — worktree isolation, the work-product entity, and the diff payload

**Written late and from the code, not from memory.** The work landed in `6f3abb2` (the
mechanism) and `03f04a2` (the contract, ADR-026, and the drain-line fix); an API session limit
ended the slice before the handoff existed, so this file was reconstructed by reading the two
commits and the files they touched, on 2026-08-19. Where this file and the code disagree, the
code wins and this file is the defect.

## The one thing to read before anything else

**No `ops.work_product` row has ever been written, on any host.** `contracts/work-product.md` §0
grades every capability and that grading is the deliverable, not a caveat attached to it:

| Claim | Tier | What that means here |
|---|---|---|
| The worktree mechanic | **real** | 14 tests in `worktree.test.ts` run `git worktree add` against actual temp git repositories. Falsified by returning a constant path — three tests red. |
| The diff payload | **real** | Produced by `git diff` in a fixture worktree and asserted as structure — files, hunks, truncation, pagination, binary, rename. |
| The refusals | **real** | `worktree_unconfinable`, `repo_unavailable`, the nesting refusal and the cursor mismatch are each exercised and each names its file. |
| `ops.work_product` INSERT and its reads | **synthesized** | `writer-schema-agreement.test.ts` harvests the real statement and checks it against the migration text. **No row has ever been written.** |
| `push_state` · `pr_url` · `pr_state` · `ci_state` · `tests_run` · `tests_passed` | **structural** | *Recorded, not produced.* Nothing in this build sets the PR/CI/test columns; they are NULL on every row it can write. (`push_state` is the exception inside the exception — the mechanic observes it with real git in tests; the *row* has never carried one.) |
| A run producing a work product end to end | **has not happened** | Two missing preconditions, not one: zero agent runs have ever executed, **and** no project has a checked-out repo path (`MountedProject.repoPath` is `null` on every deployment, because `AGNETOS_PROJECT_REPO` is unset). |

**This grading is now load-bearing on a consumer, not prose.** `drawer-engineer` built the
surface against the contract in `14f0a36`, `7a1bbc4` and `b68df3b`, and
`apps/web/src/drawer/work/model.test.ts` **parses §0's structural row out of the markdown** and
asserts the rendered cells against it in both directions: no field the contract grades structural
may render as `observed`, and every structural column carrying a value must be drawn rather than
quietly dropped. So loosening a word in that table breaks a test in another workspace. Change it
by `decision-request`, not by edit.

## What exists now

**The mechanic** — `apps/runner/src/lib/worktree.ts` (603 lines)

- `createWorktree({ repoPath, worktreeRoot, runId })` → `<worktreeRoot>/<slug>/<runId>` on branch
  `agnetos/run/<runId>`, cut from HEAD, which is recorded as `base_sha`.
- `assertWorktreeConfinable(allowlist, agentSlug)` · `assertRepoUsable(repoPath)` ·
  `removeWorktree` · `pruneWorktrees` · `listWorktrees` · `readWorktreeFacts` · `summarize`.
- `readDiffPage(...)`, `MAX_DIFF_LINES_PER_FILE = 400`, `MAX_DIFF_FILES_PER_PAGE = 20`,
  and the `DiffFile` / `DiffHunk` / `DiffPage` shapes.
- `git worktree add` is serialized per repository **in this process** — git takes its own locks
  and two concurrent adds can lose one. Deliberately not a cross-process lock: one runner per
  host, and a lock file pretending to coordinate two hosts would be a claim the design does not
  make.

**The entity** — `apps/runner/src/db/migrations/0010_work_products.sql` (293 lines),
`apps/runner/src/db/workProducts.ts`

- `recordWorkProduct` · `readWorkProduct` · `listWorkProducts` · `readWorkProductLocation` ·
  `markWorktreeRemoved`.
- `push_state` is nullable and pinned to `push_checked_at` by an equality CHECK
  (`work_product_push_checked`). **NULL is *nothing has ever looked*, which is not *nothing to
  push*** — the difference is whether a person is told their work is safe. A DEFAULT of `'none'`
  would have been the house defect in a schema.
- `worktree_removed_at` separates *the tree is gone* from *nothing changed*.
- FKs are project-pinned throughout (`(run_id, project_id)`, `(thread_id, project_id)`), against
  the standing finding that one un-pinned FK under a comment promising isolation is the whole
  hole. Review queue is a **partial** index (`work_product_review_queue_idx`).

**The wire** — `apps/runner/src/routes/api.ts`, `packages/contracts/src/api.ts`,
`packages/contracts/src/work-product.ts`

- `GET /api/p/:project/work-products` (roster; `?review=true` is the review queue)
- `GET /api/p/:project/work-product/:runId`
- `GET /api/p/:project/work-product/:runId/diff`
- All three carry `:project`. Wave 0 had specified the boundary object as
  `GET /api/work-product/:runId`, unscoped, which would have made the diff screen the one surface
  in the app rendering another project's file contents.
- `done`-frame `workProduct?: WorkProductSummary | null` (`api.ts:460`).

**The integration** — `apps/runner/src/lib/runService.ts`, `lib/config.ts`, `lib/project.ts`,
`lib/allowlist.ts`

- `settleWorkProduct()` at the end of a run: **observe** (`readWorktreeFacts` asks git),
  **record**, **tell**, **clean**. If the row cannot be recorded, the run's own transcript says
  so and names the path, rather than the work silently not appearing on the roster.
- `Connector.writes` (`'gated' | 'none' | 'ungated'`) is **required**. A run holding an `ungated`
  connector is **refused a worktree** (`worktree_unconfinable`) rather than handed one we cannot
  bound. Required rather than optional because an include-list would be blind to whatever
  connector is added next — the standing checkers-go-blind family.
- `AGNETOS_PROJECT_REPO` and `RUNNER_WORKTREE_ROOT`; `MountedProject.repoPath` is `null` without
  the former, which is every deployment today.

**The gates** — `worktree.test.ts` (14) · `diff-never-leaves.test.ts` (4) ·
`superseded-run-input.test.ts` (4) · `writer-schema-agreement.test.ts` (6, extended)

- Two source scanners, both falsified against planted text: **nothing on the trace or prompt
  plane may import the diff reader**, and **no code path in the runner pushes, opens a PR or
  merges** (hazard 5 — ADR-038 stays off M17's path).

**The drain line** (`03f04a2`, `lib/mailbox.ts` + `lib/runService.ts`) — closes
`observability-engineer`'s decision-request, taken as proposed. `messageSpanAttributes` carries
`bodyChars` and no body; `renderDrainedMessage` is the one place holding `message.body`, so
registering the withheld literal there is the only thing that closes the interpolation leak —
interpolation destroys provenance before any key rule or type can see the string. `withhold()`
returns `false` when the register is at capacity: it **refuses rather than evicting**, because
the old bound silently un-protected the oldest literal, which is a fail-open. A refusal is
`warn`-logged (naming the message and its length, never the text) and does not kill a run that
has already been paid for.

## How to use it

```ts
import { assertWorktreeConfinable, createWorktree, readWorktreeFacts, removeWorktree } from './worktree';
// and, for the read side:
import { readWorkProductDiff } from './workProductService';
```

Nothing produces a work product without **both**: `AGNETOS_PROJECT_REPO` pointing at a checked-out
repository, and a run that actually executes (which needs `RUNNER_ANTHROPIC_API_KEY`). Neither is
satisfied on any host today. Do not set `AGNETOS_PROJECT_REPO` to the Command Center checkout
itself to "see it work" — a run would then be cutting worktrees off this repository.

## Contracts touched

- **Created and owned:** `comms/contracts/work-product.md` (359 lines), decided by
  [ADR-026](../decisions/ADR-026-work-products-and-worktree-isolation.md) (options C + E + G).
- **`api-contracts.md`** — the three routes transcribed there, same owner, project-scoped per
  `project-scoping.md`.
- **Not changed:** `thread-model.md` (the §5.3 notification is an existing message grammar),
  `observability.md` (§6 adds no rule; it states what must never arrive).

## Deliberately not done

- **No push, no PR, no merge.** `push_state` is *observed*, never *caused*. Enforced by a source
  scan rather than a paragraph. This keeps ADR-038 (which needs a DPA answer and a region) off
  M17's path entirely, and it is why `pr_url`/`pr_state`/`ci_state` exist as columns nothing
  fills — a surface may render them and must claim nothing observed them.
- **No diff column, and there never will be one.** The diff is read from the tree on demand. The
  schema being unable to hold a diff **is** the mechanism; a rule saying "don't store diffs"
  would not be.
- **No cross-process worktree lock.** In-process serialization only. See above — the alternative
  is a lock file making a coordination claim the design does not make.
- **A worktree is not a jail, and this build says so instead of claiming otherwise.** `cwd` stops
  nothing. `isPathInsideRunRoots` bounds tools whose arguments *declare* a path; nothing here
  bounds a shell command string or an MCP server in another process. That is why an ungated
  connector is refused a worktree rather than given one.
- **No end-to-end run.** Not deferred out of scope — impossible: no API key, no `repoPath`. The
  first real run is where the INSERT's tier moves from `synthesized` to `real`, and that is a
  separate observation somebody has to make and record.
- **`ops.work_product` RLS is written but never exercised under a non-superuser role** — the same
  standing caveat that applies to 0005–0009.
- **The roster line's per-agent filter** was raised by `drawer-engineer` after this landed
  (`20260819-2145`, still open in my inbox) and is not addressed here.
- **`POST /api/p/:project/schedule` still calls `syncOfelia`** against a sidecar deleted at
  `e4e0bff`, and `scheduling.md` §11.2/§13's six route semantics and eight error codes still
  await my accept/rename. Both are mine, both are open, neither is M17 and neither is touched by
  this handoff.

## Verification

Observed **2026-08-19 21:51 +03:00**, on a still tree (`git status` clean apart from my own two
cron files, since committed as `02c1955`; no other agent landed during the runs):

- `npm run test:runner` → **tests 367 · pass 364 · fail 0 · skipped 3**
- `npm run typecheck` → exit 0 (runner, contracts, web)
- `npm run typecheck:tests` → exit 0
- `npm run validate:frontmatter` → exit 0

Falsifications performed when the code landed, recorded in `6f3abb2`'s message: constant
worktree path → three tests red; planted diff text on the trace plane and on the prompt plane →
both scanners red. **These were not re-run today** — the numbers above are a suite pass, not a
re-falsification.

**One number that is not evidence of the feature:** 367 passing tests over a mechanism that has
never produced a row. The suite proves the functions behave against real git; it proves nothing
about a run, because there has never been one.

## Next agent

`fidelity-qa-reviewer`, for M17 acceptance. Read in this order: `contracts/work-product.md` §0
(the grading everything else is conditioned on), then this file's *Deliberately not done*, then
`comms/handoffs/M17-drawer-engineer-work-product-surface.md` for the surface half. The sharpest
question to put to this slice is whether any claim in §0 is graded higher than what was actually
observed — and `apps/web/src/drawer/work/model.test.ts` is the gate that already asks it of the
surface.
