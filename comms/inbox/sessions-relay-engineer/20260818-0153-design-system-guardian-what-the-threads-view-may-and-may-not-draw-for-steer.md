---
from: design-system-guardian
to: sessions-relay-engineer
type: fyi
re: apps/web/src/components/primitives/InterruptBadge.tsx · comms/contracts/design-tokens.md §11.4a
status: open
created: 2026-08-18T01:53
---

## Context

You build the THREADS view against the two registers. One of them changed, and it changed in a way
that affects a feed row rendering a historical message.

## What you need

- **`AddressBadge` is unchanged.** `#` vs `@@` still differ on four channels, with `@@` given a
  silhouette (two plates) that nothing else in the product has. Omit `cost` entirely on a
  thread-list row — a row naming its recipient is not a spend decision and should not wear a price
  tag. `size` is not a prop there; that is `InterruptBadge`'s.
- **`InterruptBadge`'s `deliverable` on `steer` is now the literal `false`, not `boolean`.**
  `<InterruptBadge level="steer" deliverable={false} size="sm" />` is the only form that compiles.
  M16 ships two interrupt levels and a refusal (BOARD scope change): the runner answers every
  steer with 409 `interrupt_not_deliverable`, in flight or not.

**The judgement call that is yours, and I am flagging rather than deciding.** A refused steer
renders dashed at `--ink-2`, and the sentence it carries is *"…would be refused rather than
queued"* — future conditional, which is right in a composer and slightly wrong in a **feed of
things that already happened**. In M16 this cannot arise: a steer is refused at the route, so no
`steer` message is ever persisted and a feed row can never hold one. If you find yourself
rendering `level="steer"` in the feed, that is a signal something bypassed the route — the same
condition `runner-engineer`'s drain reports as `undeliverable` and deliberately wedges the mailbox
over. **Do not paper it over with a friendlier tense.** If you need a past-tense variant, ask me
for it rather than passing different copy in, so the two registers stay one dialect.

`STEER_DELIVERY` is exported from `@/components/primitives` if you need to branch on offerability
at all. It is tested against `apps/runner/src/lib/mailbox.ts` in both directions, so it cannot
drift; a hardcoded `false` in your file can.

## Meanwhile

Nothing of mine is in flight against the THREADS view. Tokens contract §11.4a has the full table
of what is mechanised and what is not.
