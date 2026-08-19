# ADR-026 — Work products, worktree isolation, and where a diff may travel

**Date:** 2026-08-19 · **Author:** runner-engineer · **Status:** proposed
**Affects:** `comms/contracts/work-product.md` (new) · `comms/contracts/api-contracts.md` ·
`0010_work_products.sql` · M17 · `drawer-engineer`'s wave-2 surface

## Context

`Plan §13` asks for one entity — *"every run that touches a repo produces a `ops.work_product`
row"* — plus two supporting requirements it calls load-bearing: **worktree isolation per run**
(*"without this, run three agents at once corrupts all three"*) and **review the diff from the
phone, and approve**.

Four constraints made the obvious implementation wrong:

1. **M17 is the first milestone whose central entity describes something that has not
   happened.** Zero agent runs have executed, and — the second missing precondition, unnamed
   before M17's frame — **no project has a checked-out repo path** a run could work in. A table
   full of columns nobody can populate is exactly the *declared value read as an observed one*
   this board has now found nine times.
2. **Worktree isolation is the first mechanism here whose failure corrupts data**, not a claim.
   It is also, unusually, provable today: git is local.
3. **A worktree is not a jail.** This repo has already paid for the alternative: `workspace`
   confinement was a docstring and a run overwrote `.env`.
4. **A diff is a body**, at 100× the volume of the message bodies that leaked four times. The one
   mechanism that reaches interpolated text — the `withhold()` register — is bounded and now
   *refuses* at capacity, so it cannot be the answer for a diff.

One ADR rather than three, per the ADR-028 precedent: splitting it would give one decision three
authors, and the three halves are the same decision seen from the schema, the filesystem and the
wire. The egress question stays in ADR-038 and is the human's.

## Options

| Option | For | Against |
|---|---|---|
| **A — one shared working tree, isolate by convention** | Nothing to build | The failure `Plan §13` names, verbatim. Two runs share `.git/index` and `git add` in one stages the other's work. Not a design, an absence. |
| **B — a full clone per run** | Perfect isolation | Copies the whole history per run; on a laptop-class host, minutes and gigabytes. Loses the shared object store that makes a worktree cheap. |
| **C — a git worktree per run, branch `agnetos/run/<runId>`** | Real isolation with a shared object store, and every property assertable against real git today | Needs an explicit lifecycle: cleanup, prune-after-kill, and the confinement question below |
| **D — store the diff in the row** | The review screen reads one table | Puts file contents in Postgres, in backups, in `SELECT *`, and one interpolation from a span or a prompt |
| **E — compute the diff from the tree on demand** | The database cannot leak what it does not hold | The diff dies with the worktree, so *"the tree is gone"* has to be a distinguishable answer |
| **F — sandbox the run so a shell cannot leave the tree** | Actual confinement | Needs a container-per-run sandbox this build does not have. Claiming it without one is the `.env` incident again |
| **G — refuse a worktree to a run we cannot bound** | Honest, enforceable today, costs nothing (no agent declares such a connector) | Blocks a future repo agent that wants a shell, until an ADR says otherwise |

## Decision

**We use C + E + G.**

**C.** One git worktree per run at `<worktreeRoot>/<slug>/<runId>`, on branch
`agnetos/run/<runId>`, cut from HEAD and recorded as `base_sha`. `git worktree add` is serialized
per repository in-process; a tree inside its own repository is refused; a killed run leaves a
**prunable** worktree, never a locked repository; a tree with no commits and no changes is
removed, and **a tree holding work is kept**, because removing it destroys what the row points at.

**E.** The diff is computed from the worktree on demand, parsed **server-side** into files and
hunks, capped per file with the cut declared (`truncated`, `linesWithheld`), paginated on two
axes, and pinned to `head_sha` by an opaque cursor that a moved tree refuses with 409. **No diff
column exists in `ops.work_product` and none will**; the schema being unable to hold one is the
mechanism, and a rule saying not to would not be. A diff may not reach a span, an error string,
a thread message, or `lib/prompt.ts` — the last of which would carry it out of the tailnet under
a processing region this repo has not asserted.

**G.** `Connector.writes` becomes a **required** field (`gated` · `none` · `ungated`), and a run
whose allowlist holds an `ungated` connector is **refused a worktree** (`worktree_unconfinable`).
We do not claim to jail a shell; we decline to hand it a repository. Confinement for
path-declaring tools is `isPathInsideRunRoots`, extended from one root to the run's roots.

Two further rulings that fall out of the same decision:

- **`push_state` is nullable, paired with `push_checked_at` by an equality CHECK.** `NULL` is
  *nothing has ever looked*; `'none'` is *something looked, at this time, and found nothing to
  push.* A default of `'none'` would tell a person their work is safe when nothing examined it.
- **M17 records push state and performs no push, PR or merge.** Enforced by a source scan, not by
  a paragraph. `pushed` remains reachable and truthful because a *human* may have pushed.

## Consequences

**Easy.** Three agents can work in one repository without corrupting each other, and that
sentence is backed by tests against real git rather than by a design note. The review screen gets
structure it never has to parse. The roster line gets every field it needs named in the same
commit as the schema, so wave 2 does not ship a second inert surface. A diff cannot leak through
the database, because the database cannot hold one.

**Hard.** The diff dies with its worktree, so kept trees accumulate until something prunes them
(`work-product.md` §9.2, `scheduler-engineer`'s clock). A repo agent that genuinely needs a shell
is blocked until an ADR unblocks it. And a project's `repo_path` is a process env var today
rather than a column, which is a real gap with a named owner rather than a hidden one.

**If we reverse this later:** dropping G is one CHECK-free code deletion and an ADR — the field
stays useful as documentation either way. Reversing E is the expensive one: adding a diff column
later means a migration *and* re-auditing every plane in §6 of the contract, which is the reason
it is refused now rather than deferred.

**What this ADR does not decide.** Whether a push may ever happen (ADR-038, `proposed`, the
human's), and whether the review verdict grows its own read model (`work-product.md` §9.4).

## Contract edits

- **New:** `comms/contracts/work-product.md` — the whole file.
- `comms/contracts/api-contracts.md` — three routes added under the project-scoped table
  (`work-products`, `work-product/:runId`, `work-product/:runId/diff`), four error codes
  (`repo_unavailable` 503, `worktree_unconfinable` 403, `work_product_moved` 409,
  `work_product_unavailable` 410), and two SSE fields (`start.threadId`, `done.threadState` +
  `done.workProduct`).
- `packages/contracts/src/work-product.ts` — new module, types only, exported from the barrel.
