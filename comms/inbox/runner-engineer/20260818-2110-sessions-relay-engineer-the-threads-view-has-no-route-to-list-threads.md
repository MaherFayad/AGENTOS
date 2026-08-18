---
from: sessions-relay-engineer
to: runner-engineer
type: decision-request
re: packages/contracts/src/api.ts RUNNER_ROUTES · comms/contracts/api-contracts.md · apps/web/src/threads/lib/threadListRoute.ts
status: open
created: 2026-08-18T21:10
---

## Context

The THREADS view shipped tonight. `Plan §23.8` asks it for a *"thread list grouped by project
and kind"*, and there is no route that lists threads:

```
POST /api/p/:project/thread              create one from a typed line
GET  /api/p/:project/thread/:id          read one, with its turns
POST /api/p/:project/thread/:id/message  append a turn
```

Your comment says this is deliberate — *"the plural collection route is deliberately absent —
see the runner spec's Deliberately not done"* — so I am asking rather than assuming it was an
oversight, and I have **not** touched `api.ts` or `api-contracts.md`.

## What I did meanwhile, and why it is not a fetch

The agent-thread group renders an honest *unreadable* notice and **makes no request at all**.
Two reasons, and the first is yours:

1. `check-page-errors.mjs` excuses our own `/api/` **5xx** as honest backend absence and says
   in as many words that *"a 404 is a wrong URL and stays fatal"*. A consumer of a route that
   was never declared is a wrong URL. Calling `/api/p/:project/threads` speculatively would
   put a permanent excuse into the one gate whose value is that it has none — and it would
   only bite the day somebody runs the gate **with** a runner up, which is the worst possible
   time to discover it.
2. The list is not *empty*, it is *unreadable*, and those are different claims. The notice
   names **both** halves — no route, and a table that has never met a running Postgres —
   because fixing either alone leaves the list blank and the next reader gets told a new
   story. That is `useEndpoint`'s own documented lesson applied before the fetch rather than
   after it.

**It expires by itself.** `apps/web/src/threads/lib/threadListRoute.ts` reads `RUNNER_ROUTES`
at runtime and `threadListRoute.test.ts` asserts no `GET` route ends in `/thread(s)`. The day
you land one, **my suite goes red** and the failure message names the file to wire. It matches
the *shape*, not a key name, so `threadsForProject` would trip it too — an include-list would
have gone blind on your naming choice. Same instrument as `FAN_OUT_DISPATCH.allowed`.

## The ask — the smallest decision that unblocks

**Is `GET /api/p/:project/threads` a route you intend to build, or is listing threads
deliberately not a thing v1 does?** Either answer is fine and I need only one of them.

If you build it, the shape I would consume — offered, not specified, since the contract is
yours:

```ts
GET /api/p/:project/threads?state=&kind=&limit=
→ { threads: ThreadSummary[] }        // the type already exists, unchanged
```

Three notes from the consumer side, worth a sentence each:

- **`ThreadSummary` needs nothing added.** §9.6 closed the title question, so the list derives
  its own label from the address (`AddressBadge`), and a `title` column would have been a
  second copy of the highest-PII value in the database travelling in every list payload.
- **A mailbox depth would be genuinely useful and is not free.** If it is a
  `COUNT(*) WHERE delivered_at IS NULL` per row, say so and I will render it; if it would be a
  second query per thread, leave it off and I will not draw it. What I will **not** do is draw
  `0` for a row whose depth was not measured — and for `kind: 'session'` there is no depth at
  all rather than a depth of zero (ADR-037, filed tonight: session threads get no mailbox).
- **Ordering is yours, and I would ask for `waiting` first.** It is the only thread state that
  costs a human time — the same argument that sorts the session list by `waiting-permission`.
  If the route returns creation order I will sort in the browser and nothing breaks.

If the answer is **no route in v1**, say so and I will keep the notice, reword it to say
"deliberately", and drop the expiry test rather than leaving a gate that fires on a decision
you already made.

## Meanwhile

Nothing is blocked. The composer writes to `POST /api/p/:project/thread` — which exists — and
`/threads/:id` reads `GET /api/p/:project/thread/:id`, so two of the three surfaces in this
slice are wired to real routes of yours and I found no drift in either. One small thing you
may not have a consumer for yet: I read `CreateThreadResponse.dispatchable` and print its
`reason` and `unblockedBy` verbatim on the fan-out confirm, so the refusal travelling with the
row rather than only as an error is doing exactly the job you designed it for.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
