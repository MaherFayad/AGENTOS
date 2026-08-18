# status — commandcenter-orchestrator

**Updated:** 2026-08-18T23:30
**Milestone:** **M16 done** (PASS at `6323f41`) · **M17 framed, not dispatched** — the human dispatches
**State:** idle

## Now
**M17's frame is on BOARD and the ownership call went against the board's own row.** Row 17 said
`drawer-engineer`; the §13 coverage row said *unclaimed, in trust to `drawer-engineer`*. Split at
a named seam: the entity, the worktree mechanic, `0010_` and **ADR-026** are `runner-engineer`'s
because the runner writes the row and owns the run lifecycle; the roster line, diff screen and
approve are `drawer-engineer`'s because that is what the trusteeship was actually about. The seam
is the **read side of the contract, and it has one author** — with a wave-0 step M16 did not need:
`drawer-engineer` files what the phone screen needs *before* the contract freezes, so §13's
*"design the diff screen first"* survives a lead who writes from the write side outward.

## Ruled this tick
- **`0009_` was being raced and had never been claimed here.** Four comms files call the thread-id
  `SET NOT NULL` migration `0009_`, two of them saying *"unclaimed as far as I can see"*. Ruled to
  `runner-engineer` (the agent who must satisfy a constraint writes it), landing before wave 1.
  **M17's migration is `0010_work_products.sql`, single author.**
- **ADR-026's owner was blank on a *reserved* row** — filled, claimed with the frame, before any
  file, per the 023/028 precedent. One ADR for M17, not three.
- **Should M17 open before a real run? Yes — git is local.** The worktree mechanic and the diff
  render are the first things in this build provable end to end with no API key. What cannot be
  produced is narrower than the milestone: the outcome fields. So M17 opens with `push_state`,
  `pr_*`, `ci_*`, `tests_*` **recorded, not produced**, and three named evidence tiers
  (`real` / `synthesized` / `structural`) with a hard bar: the worktree may not close on
  `structural`.
- **Three hazards added.** (5) approve/merge is egress and ADR-038 is `proposed` with the human —
  routed around by ruling that M17 performs no push. (6) a diff is a body, and it would exhaust the
  `withhold()` register instantly. (7) the roster line needs SSE fields on the seam that is
  *already* inert for the mailbox composer.
- **The worktree hazard's real half:** a worktree is not a jail. `workspace` confinement was a
  docstring and a run overwrote `.env`; the contract must name an enforcer or say plainly there
  isn't one.

## Blocked on
Nothing of mine. M17 dispatch is the human's. `design-system-guardian` still owes the emoji ruling
(the one un-archivable `_all` broadcast).

## Next
1. On dispatch: wave 0 to `drawer-engineer`, then wave 1 to `runner-engineer` **alone**.
2. The four M16 inheritances ride alongside — but all three follow-ups land at the diff screen, so
   they close before *that* slice's review, not before M17 opens.
3. Still 100+ open messages against a soft limit of 60; per-agent boxes are their owners' to close.
