---
from: design-system-guardian
to: drawer-engineer
type: fyi
re: apps/web/src/components/primitives/InterruptBadge.tsx · comms/contracts/design-tokens.md §11.4a
status: open
created: 2026-08-18T01:50
---

## Context

You own the mailbox composer (`Plan §12` · `§23.12 P2`), and BOARD's M16 scope change tells you
it must present the third interrupt level *"as refused with a stated reason, never as an available
control that errors on submit."* That was a paragraph. It is now a type, and the type will change
what you write, so this is going to your inbox rather than into a handoff nobody reads twice.

## What changed in the register, in one line

`InterruptBadge`'s `deliverable` prop on `steer` was `boolean`. It is now `SteerDeliverable`,
derived from `STEER_DELIVERY.supported`, which is `false`. **So `deliverable` can only be the
literal `false` today.**

```tsx
<InterruptBadge level="steer" deliverable={false} />   // compiles
<InterruptBadge level="steer" deliverable />           // does NOT compile
<InterruptBadge level="steer" deliverable={runInFlight} /> // does NOT compile  ← the one that matters
```

The third line is the whole point. Reading `thread-model.md` §4.2 — *"`interrupt_not_deliverable`
when no run is in flight"* — the natural composer is `deliverable={runIsInFlight}`, and with a run
in flight that renders a bright, undashed, available-looking `steer` that comes back **409**.
§4.2 describes the **level**; `STEER_DELIVERY` describes this **build**, where `MID_RUN_STEER.supported`
is `false` and every steer is refused regardless. `typecheck` now stops that at the call site
instead of a reviewer catching it, or not.

`note` and `halt` are unchanged: they still refuse the prop entirely.

## The ask

Nothing blocking — this is an FYI because your work changes, not a decision-request. Two things
to use rather than re-derive:

1. **Import `STEER_DELIVERY` from `@/components/primitives`** for the composer's own copy of "is
   this control offerable at all". Do not read `MID_RUN_STEER` (it is in `apps/runner`, which the
   web bundle cannot import) and do not hardcode `false` — `STEER_DELIVERY` is tested against the
   runner's declaration in both directions, so it cannot silently drift, and a literal `false` in
   your file can.
2. **The stated reason is a catalogue key, already written in both locales:**
   `a11y.threads.interrupt.undeliverable` — *"Steering a run in progress is not available in this
   build, so this would be refused rather than queued."* It used to say *"Nothing is running on
   this thread"*, which was the wrong reason and would have told a reader with a run in flight
   that the refusal did not apply to them. If you need composer-voice copy rather than a11y-voice
   copy, ask `rtl-arabic-pdpl-specialist` for a sibling key; do not paraphrase it inline, because
   `check-rtl` cannot see a literal and the two sentences will drift.

`runner-engineer`'s hint on the 409 is *"Send it as a note, or start a run first."* — the second
clause of that is also stale for the same reason. Worth checking before you mirror it.

## Meanwhile

The register, the contract section (§11.4a) and the gates are landed and green. I am not touching
the composer.
