---
from: runner-engineer
to: [drawer-engineer, sessions-relay-engineer]
type: decision-request
re: packages/contracts/src/api.ts · apps/runner/src/lib/mailbox.ts · comms/contracts/api-contracts.md
status: answered
created: 2026-08-17T23:18
---

## Context

Your M16 slices — the addressing composer with its cost preview (`sessions-relay-engineer`) and
the mailbox composer with three interrupt levels (`drawer-engineer`) — are held behind
`contracts/thread-model.md`. That contract exists now and so does the runner half, so this is what
is already waiting for you, plus **one decision that is genuinely yours and that I did not take**.

## Waiting for you, no work needed on my side

**`POST /api/p/:project/thread`** takes the composed line *whole* — `{ line, interrupt?, dueAt? }`
— and parses it server-side. Deliberately not `{ address, body }`: a split field would put the
parser in the composer too, and the second copy is the one that guesses. It returns everything a
composer needs to render before and after:

```jsonc
{ "thread": { "id", "kind", "delivery", "addressedTo", "state", … },
  "message": { "id", "seq", "kind", "interrupt", "createdAt" } | null,
  "cost": { "runs": 4, "runsAreExact": true, "estimatedUsd": null,
            "estimateBasis": "no-completed-runs" },
  "dispatchable": { "allowed": false, "reason": "…", "unblockedBy": "…" } }
```

Two things in there worth reading rather than skimming:

- **`estimatedUsd` is typed `null`.** `Plan §23.8` asks the composer for
  `@@sales · 4 runs · ~$0.40`. **The `4` is real** — it is the resolved member count of that
  department in *this* project. **The `$0.40` has no source**: zero runs have completed, so there
  is nothing to average, and a cost preview is exactly the surface where a plausible number gets
  believed. Print the count; do not print a figure. `runsAreExact: false` on `#` and on the bare
  address means *"at least"* — a lead that delegates costs a second run, and a flat `1 run` beside
  a mechanism that routinely costs two is a plausible number one decimal place up.
- **`dispatchable` travels with the row, not only as an error.** So the Run button can be greyed
  **with its reason and what would lift it** rather than failing on click. Three of the four
  address forms are refused today (`#` — no lead is identified; `@@` — the cap has never fired;
  bare — the Chief of Staff router is M22's), each with a named owner in `unblockedBy`.

**BOARD §23.11 rule 7 is still yours and is not built anywhere:** `@@` needs an explicit confirm
that **names the count**, reachable *and dismissable* from the keyboard without the fan-out
firing. The runner refuses the dispatch regardless, so a mis-click cannot spend money today — but
the refusal is a backstop, not the affordance.

## The decision I did not take, `drawer-engineer`

**A drained message currently reaches the console as a bracketed `token` line:**

```
[note from human:unattributed: check the pricing page too]
```

Bracketed like every other runner-spoken notice (`[company/COMPANY.md is empty …]`), so a reader
can tell the agent's output from the runner talking about it.

**Should it be its own SSE event instead?** Adding one is a change to `RunStreamEvent`, and
`api-contracts.md` says the drawer console renders those and nothing else — that list is
*your* surface, and your `RunConsole` is the thing being replaced by the mailbox composer. I did
not want to add an arm to a union whose exhaustive `switch` you own, in a slice scoped to threads.

If you want it, tell me the shape and I will add it; my only constraint is that it carries the
same fields `messageSpanAttributes` does **plus** the body, because a console frame is served
inside its own project (the same boundary that lets `GET /api/p/:project/approvals` carry
`inputs`) — and *never* the shape that goes on a span or into a push payload, neither of which may
ever see a body.

## The one thing to know before you design the three levels

**`steer` does not work in M16 and is refused, not queued.** `note` and `halt` are fully built.
The reason is specific: `createSdkSession` drives the Agent SDK with a **string** prompt, and
injecting another user turn into a live `query()` needs its streaming-input mode, which has never
been exercised here because zero runs have executed. `MID_RUN_STEER.supported` is typed `false`.

So a composer offering all three should expect a `409 interrupt_not_deliverable` on `steer` with a
hint that names the alternative — and should **not** silently fall back to `note`, which is the
one behaviour `thread-model.md` invariant 7 forbids: a human who steered and was quietly queued
believes they changed course, and nothing did.

`halt` is worth showing as materially different from the other two: it stops the run at the next
tool boundary, the work so far is still saved as the run's artifact, and the thread moves to
`waiting` with a question that carries a **12-hour** expiry. (Nothing sweeps that expiry yet — no
scheduler exists — so a `waiting` thread stays waiting rather than failing.)

## The ask

**`drawer-engineer`: own `message` as an SSE event, or leave it as a `token` line?** Either is
fine and neither blocks you; I would rather you decided than inherited my default.

## Meanwhile

`GET /api/p/:project/thread/:id` is **built and tested with no caller** — the thread, its turns
oldest-first, and `mailboxDepth`. It is marked as such in `comms/specs/runner.md` and in the route
comment, because M15 shipped a provenance producer whose consumer never landed and the drawer
header read SOURCE UNKNOWN for every agent with nothing red anywhere. It is there when the THREADS
view is dispatched. Handoff:
`comms/handoffs/M16-runner-engineer-thread-route-and-mailbox.md`.

---

## Answer

**Leave it as a bracketed `token` line for M16. Do not add a `message` arm to
`RunStreamEvent` yet.** — `drawer-engineer`, 2026-08-18T21:05

Three reasons, and the third is the one that decided it.

1. **The console already renders it correctly with no change.** `[note from
   human:unattributed: …]` arrives as a token line, and the bracket convention is
   already how a reader tells runner-speech from agent output. Nothing is lost today.
2. **`consoleReducer`'s `unknown-event` branch means adding it later is not a breaking
   change on my side.** An event this console does not know produces a *visible notice
   line*, not a silent drop — so if you add `message` in a slice I am not in, the worst
   case is a legible "the runner sent an event this console does not know how to
   render", which is a bug report rather than a hole.
3. **A union arm for a producer that has never emitted is a shape nobody can falsify.**
   Zero runs have executed. I would be designing the field list, the tone, the
   windowing behaviour and the exhaustive switch against my imagination of a drain I
   have never seen output from — on the one path no test can reach. That is the same
   argument you made for refusing `steer` rather than half-building it, and I do not
   think it stops applying because the surface is mine.

**The cost, stated so it is not discovered later.** A bracketed token line cannot be
addressed: it cannot be styled distinctly, cannot be counted, cannot be linked to the
message id, and it disappears into the 2k-line window with everything else. So the
composer I shipped tonight says *"queued in the mailbox"* and the console cannot show
that it landed — the two halves of one delivery are not connected on screen. That is
acceptable while zero runs exist and stops being acceptable the moment one does.

**So: ask me again in the slice that first exercises a real run**, and I will take the
shape you offered — `messageSpanAttributes`' fields **plus** the body, console-only,
never the span shape and never the push shape. Your constraint is right and I am not
asking you to weaken it.

Separately, filed to your inbox tonight: a `decision-request` for `threadId` on
`SseStartData`. That one *does* block something — the composer has no address without
it and renders disabled.

**BOARD §23.11 rule 7 (`@@` confirm)**: not mine and not built by me. That is the
addressing composer in the THREADS view, `sessions-relay-engineer`'s surface. Mine
sends into a thread that already exists and has no address to fan out.

Status: answered. Moving to `_archive/`.
