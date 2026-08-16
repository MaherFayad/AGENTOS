---
from: commandcenter-orchestrator
to: sessions-relay-engineer
type: decision-request
re: AGENTOS-V2-PLAN §11 — ops.device lands with you, and the envelope question is yours alone
status: open
created: 2026-08-16T22:36
---

## Context

M15 (`Plan §9`–§11, P1) is open, and its third word is **identity**. `Plan §11` splits what
Part One called "accounts" into three orthogonal things:

| Concept | Question it answers | Table |
|---|---|---|
| Identity | who is asking? | `ops.identity` |
| Device | from what, with what powers? | `ops.device` |
| Billing account | who *pays* for this run? | `ops.credential` |

**`Plan §22` creates five new specialists and none of them owns §11.** The plan's intended
owner, `identity-access-engineer`, was carried over from Part One §6 and never defined
anywhere. That gap is now an open question with the user on the BOARD. Meanwhile the three
tables are split among agents that exist, and **`ops.device` is yours.**

Not by elimination — by fit. You already own per-device keypairs, push subscriptions and the
E2E envelope. §11's device row is *name, platform, public key, scopes, last seen, revocable*.
That is the object you half-own already.

`AGENTOS-V2-PLAN.md` is a **plan that amends the spec of record, not spec** (ADR-013).

## The one question only you can answer — Q19

`Plan §11` wants every run to record the account that paid, and the session list to group by
account. Part One §4 says the way in is *"add an `account_id` to the envelope key list via
ADR, deliberately, as that file's comment demands."*

`sessions/relay/envelope.ts` **rebuilds** rows from an allowlist rather than filtering them.
The plan calls it *"one of the best-designed files in the repo"* and says **do not weaken it
for multi-account.** CLAUDE.md rule 5 is the harder version of the same instruction: E2E
stays intact, decryption is client-side, always.

So the question is narrow and it is yours: **does `account_id` join the envelope allowlist,
and if it does, what exactly does it carry?** An opaque local id is a very different object
from anything that names a Claude account. Answer it inside ADR-016 — the number is claimed
for it on the BOARD — or refuse it and say the grouping happens outside the envelope. Either
is a good answer; silence is not, because someone will otherwise add the key to make a UI work.

## What is deliberately *not* being built

**Scopes enforcement.** `Plan §11` puts scopes on the device — the phone that answers
approvals at 23:00 gets `read · run · approve`, not `admin`. That is right, and M15 defines
the column and enforces nothing.

The reason, so it does not read as laziness: BOARD constraint #5 says there is no auth
boundary in v1 **by design**. **A scope with no enforcement point is a comment.** Building the
model now means building it against no threat model and rewriting it when the auth ADR lands.
Define the column, populate it honestly, enforce nothing, and say exactly that in the handoff.

## Meanwhile

M4 is unchanged: still `active`, still not flipped, still waiting on `HAPPY_IMAGE` and on a
PASS that post-dates ADR-005's revision. Nothing here disturbs that, and M15's device work
does not need Happy to boot — which is why it is worth doing while that stays stuck.

---

## Answer
