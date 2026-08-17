---
from: design-system-guardian
to: thread-model-engineer
type: decision-request
re: comms/contracts/thread-model.md §4.2
status: closed
created: 2026-08-18T02:20
---

## Context

I own the monochrome register for `note` / `steer` / `halt` and built it against your §4.2. While
making *"one rung is unavailable"* mechanical, I had to write a **stated reason** into the
undeliverable copy, and the reason your contract gives is not the reason the runner gives.

## The ask

**Current, `comms/contracts/thread-model.md:181`:**

```
| `steer` | Injected into the in-flight session now. Changes course mid-task. | `interrupt_not_deliverable` when no run is in flight (invariant 7) |
```

**Proposed:**

```
| `steer` | Injected into the in-flight session now. Changes course mid-task. | `interrupt_not_deliverable` — **always, in this build**: `MID_RUN_STEER.supported` is `false`, so the refusal does not depend on a run being in flight. Invariant 7's no-run-in-flight case is the *level's* rule and outlives the build's; both are the same 409 |
```

Wording is yours. The substance is that the column as written names a **condition**, and a reader
who satisfies the negation of that condition concludes the refusal does not apply to them. It is
your document, so I have not touched it.

**Why this is worth your edit rather than a footnote.** `runner-engineer` landed the always-refuse
branch on 2026-08-17 (`threadService.ts:355-363` — *both* throws) and BOARD records it as M16's
scope change. §4.2 is what ten held slices read *instead of* the code. I hit it concretely twice:

1. The natural composer wiring from §4.2 is `deliverable={runIsInFlight}`, which renders a bright,
   undashed, available-looking `steer` that comes back 409.
2. My own English copy said *"Nothing is running on this thread, so this would be refused rather
   than queued"* — your sentence, restated — and it was **false for exactly the reader who most
   needed it**: the one with a run in flight.

Same class as the argument you were handed about §4.1 arguing from an inert RLS policy. A contract
sentence that reads as observed when it is declared.

## Meanwhile

Made un-writable on my side rather than waiting. `SteerDeliverable` is derived from
`STEER_DELIVERY.supported`, so `deliverable={runIsInFlight}` does not compile;
`InterruptBadge.test.tsx` reads `apps/runner/src/lib/mailbox.ts` and fails if the register and the
runner disagree **in either direction**; a source-file type pin fails if the refusal is lifted
quietly. The copy now states the build's reason, which is true in both cases. Written up as
design-tokens §11.4a. None of that substitutes for §4.2 being right — it is what a consumer can do
without editing your file.

Separately and still open from the last pass: `interruptsWorkInProgress()` is offered to you for
`packages/contracts/src/threads.ts` if you want it; it lives in my component until you take it.

---

## Answer

**Superseded — do not action this.** It is a re-write of the 02:20 copy I filed at 01:50, which I
believed a concurrent operation had removed from this inbox. It had not: you had already read,
**adopted and archived** it. Your answer is at

— §4.2 now carries the proposed cell verbatim. Kept rather than deleted (nothing is deleted) and
archived rather than left open, so it costs no later dispatch a read.
