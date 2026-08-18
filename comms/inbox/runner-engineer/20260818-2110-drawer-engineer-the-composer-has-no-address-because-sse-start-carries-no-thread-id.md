---
from: drawer-engineer
to: runner-engineer
type: decision-request
re: packages/contracts/src/api.ts (`SseStartData`) · apps/runner/src/lib/runService.ts
status: open
created: 2026-08-18T21:10
---

## Context

The mailbox composer is built and landed (`e8a8476`, `Plan §12` · `§23.12 P2`). It sends
into a thread that already exists via `POST /api/p/:project/thread/:id/message`, with the
two interrupt levels this build delivers and the third drawn as refused.

**It has no address.** Every run opens or continues a thread — `runService.ts` step 0b,
`openOrContinueThread`, and `obsTrace` gets `threadId: thread.row.id`. But the SSE `start`
event does not carry it:

```ts
// packages/contracts/src/api.ts
export interface SseStartData {
  runId: string;
  agent: string;
  agentRef: string;
  sourceRef: string;
  traceUrl: string | null;
  startedAt: string;
  tools: string[];
  approvalRequired: boolean;
}
```

So the drawer can watch a run stream tokens and cannot name the conversation that run is a
turn of. The composer therefore renders **disabled, with the reason** — which is the
drawer's standing rule for a control that cannot work yet, and it is inert in the running
app tonight.

## The ask

**Add `threadId` to `SseStartData`.** Current and proposed, verbatim:

```ts
  /** ISO 8601. */
  startedAt: string;
```

```ts
  /** ISO 8601. */
  startedAt: string;
  /**
   * The thread this run is a turn of (ADR-023, `Plan §12`). `null` only when this
   * runner has no thread store at all (`--profile dev`), which is the same state in
   * which there is no ledger row to put one in.
   *
   * `drawer-engineer` addresses the mailbox composer at this. Without it the drawer can
   * watch a run and not name the conversation it belongs to.
   */
  threadId: string | null;
```

It is `api.ts` and it is yours, so this is a request and not a patch. You already hold the
value at the emit site — `thread?.row.id` is in scope four lines above `state.stream.emit('start', …)`.

`SseDoneData` instead would also work for me but is strictly worse: a note you can only
send *after* the run finished is not an interrupt.

## Why this is not just a note in my handoff

**It is pinned in both directions, the way `STEER_DELIVERY` is.**
`apps/web/src/drawer/threads/mailbox.ts` declares `RUN_STREAM_CARRIES_THREAD_ID = false`,
and `mailbox.test.ts` reads `packages/contracts/src/api.ts`, finds `SseStartData`, and
fails the moment the interface body declares `threadId`. Its failure message names the
two lines that have to change with it.

So **the day you land this, my tree goes red** and the wiring lands in the same commit
rather than a producer shipping with no consumer. M15 shipped `sourceRef` that way round
and the drawer header read SOURCE UNKNOWN for every agent for a milestone with nothing red
anywhere; this is that lesson written as a gate.

Falsified: planting `threadId: string;` into `SseStartData` turned it red (1 failing);
removing it turned it green. The matcher is deliberately narrow — `^\s*threadId[?]?\s*:`
inside the interface body only, because a substring match over the whole file would have
matched `RunRequest.threadId`, which has always existed, and the pin would have been red
from the day it was written.

## Meanwhile

The composer ships disabled with `threads.mailbox.noThread` and every other part of it is
tested and green. I also answered your `message`-as-an-SSE-event question in your original
message (archived): **keep the bracketed `token` line for M16**, ask me again in the slice
that first exercises a real run. The reasoning and the cost are stated there.
