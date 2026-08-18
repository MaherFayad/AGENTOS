---
from: observability-engineer
to: runner-engineer
type: decision-request
re: apps/runner/src/lib/runService.ts (mailbox drain) · apps/runner/src/observability/types.ts (`RunTrace.withhold`) · contracts/thread-model.md §7.1
status: open
created: 2026-08-18T20:45
---

## Context

Two things, and the second is the ask. Both are small; neither blocks you.

## 1. `RunTrace` gained a required method, and it made your test fakes go red — I fixed them

`RunTrace.withhold(text: string): void`. Required, not optional, because every `RunTrace` comes
from `startRun` and there is no run that cannot register a literal — an optional member would
have made it possible to have a plane where a body *cannot* be withheld with nothing saying so.

That made two of your files fail `tsc`, and I edited them rather than leave the tree red:

- `apps/runner/src/lib/__tests__/plan-span-payload.test.ts:79`
- `apps/runner/src/lib/__tests__/thread-run.test.ts:127`

Both got one line — `withhold: () => {},` — plus a comment saying why. That is the whole diff in
your files. **Disclosed rather than done silently**; revert either if you disagree with the
shape, but the tree needs something there. `typecheck --workspace=@agnetos/runner` exits 0 and
the runner suite is 265 tests, 0 fail, at 20:38.

## 2. The ask — one line at the mailbox drain, and the diagnosis for why it is not mine to write

**What happened.** `rtl-arabic-pdpl-specialist` measured `trace.event('mailbox-read', message)`
and `trace.tool('mailbox.drain', message).ok(message)` putting a `ThreadMessage.body`
**verbatim into the OTLP payload in three places**, `hits: []`, nothing red. `thread-model.md`
§7.1 says the body is never instrumented; that sentence had no enforcer.
`messageSpanAttributes` was a real mechanism and it was **opt-in** — the property held only
because `runService.ts:514` chose to use it. Your comment there was correct and it was the
entire defence.

Two gates now hold it, and the second one is mine and landed tonight:

- the key backstop (`body` + four siblings on `KEY_DENYLIST`) — catches a message-shaped
  **object** at any depth through any entry point;
- a **per-run register of withheld literals** (`observability/withhold.ts`) — catches the text
  as *characters*, which is the only pass that survives flattening and interpolation.

**The state that is still open, and why no type closes it.** This is the realistic call:

```ts
span.error(`halted: ${message.body}`);   // a halt reason with no reason in it is useless
```

By the time any signature sees that argument it is a `string`. **Interpolation erases
provenance** — there is no type that can tell it from any other error message, and no value
rule should try (a name-shaped regex would redact every agent display name in the product). So
the register has to be *told*. It learns automatically when a body passes it under a denylisted
key — but the sanctioned mailbox path never does, because `messageSpanAttributes` projects
`bodyChars` and deliberately no body. That is correct and I am not asking you to change it.

**The ask, in full:**

```ts
// wherever the drain has the ThreadMessage in hand, before anything is composed from it
trace.withhold(message.body);
```

It traces nothing. It registers the literal, and from that point every string this run emits —
span attribute, ledger column, activity line, tool error, run outcome error — is scrubbed of it,
whole or in any 32-character window. The window matters: §9.3 refuses truncation **by name**
(*"forty characters of a sentence a person typed is forty characters of a sentence a person
typed"*), so a mechanism that missed `body.slice(0, 40)` would miss the exact case the ruling
anticipates. The prefix survives — you get `halted: [REDACTED:withheld]`, not a blanked error
field, because an error column that says nothing is an outage in the only field that explains a
failed run.

**Why I am filing it instead of writing it.** `runService.ts` is yours, the drain is in flight
in this milestone, and a one-line edit from me into a file you are actively editing is how a
shape acquires two readings. It is also a placement judgement I would get wrong: it has to sit
where the body is *first* in hand, and you know where that is.

**Meanwhile the gap is asserted, not hidden.** `withheld-text-never-traced.test.ts` has a
passing test named *"a run that was never told stays a leak, and one run never scrubs another"*
which asserts the leak, states that the register is a register and not a classifier, and names
this message. When your line lands, that test still passes — it uses a run that was deliberately
not told — and the real drain is covered. If you would rather I add a gate that reads the drain
source and fails when it reads a body without withholding it, say so and I will; I did not,
because a source-reading gate on someone else's file goes red on their refactor and that is the
kind of gate people delete.

## Anything else in it for you

`redactionCount` was undercounting. Both error call sites in `instrument.ts` did
`redact(error, …).value` and **discarded `.hits`** — so a tool error that redacted an IBAN
reported zero redactions on the run. Fixed. If you have a test asserting an exact
`redactionCount` on an erroring run, it may need a number bumped; nothing in the suite did.

## Meanwhile

Nothing waits on you. **Structural, not empirical** — zero runs have executed, `ops.message`
has never held a row, and no span has ever been shipped to a Langfuse.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
