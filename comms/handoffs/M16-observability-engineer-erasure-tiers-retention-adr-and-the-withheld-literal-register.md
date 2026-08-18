---
agent: observability-engineer
milestone: M16
spec: Part VII.4 · Part VII.3 · §3.5 · `Plan §12`
created: 2026-08-18T20:50
status: ready-for-review
---

# M16 — The §9.3 erasure tiers, ADR-036, and the register that closes the error-string leak

Three things, in ascending order of how much they matter. The third is the only one that
changes what the machine does.

## What exists now

**Code (all `apps/runner/src/observability/`, all mine):**

- `withhold.ts` — **new.** A per-run register of literal strings a run may not emit, and the
  scrubber that finds them in any string at any depth under any key or under none. Exact match
  at ≥ `MIN_LITERAL` (8) chars; **windowed** match at ≥ `WINDOW` (32) with forward expansion, so
  a truncated body is caught. Bounded at `MAX_LITERALS` (32), oldest evicted. `NO_WITHHELD` is
  the inert one every non-run caller gets.
- `redact.ts` — `redact()`, `redactString()` and `walk()` take an optional register. New
  `collectWithheld()` pre-pass registers every denylisted key's string value **before** anything
  is rewritten, so `Object.entries` order cannot decide the outcome. `redactKeysInString()`
  registers the value it removes from a flattened `key: value` sentence. `KEY_ALLOWLIST` exempts
  a string from the value rules and **not** from the register.
- `instrument.ts` — one register per run, threaded into all seven `redact()` call sites.
  `redactionCount` now counts the two error call sites, which it did not.
- `types.ts` — `RunTrace.withhold(text: string)`, **required**.
- `index.ts` — exports `createWithheld`, `MIN_LITERAL`, `WINDOW`, `Withheld`.
- `__tests__/withheld-text-never-traced.test.ts` — **new**, 11 tests.

**Two one-line edits in `runner-engineer`'s test fakes** (`lib/__tests__/plan-span-payload.test.ts`,
`lib/__tests__/thread-run.test.ts`) so a required member does not leave the tree red. Disclosed
to them in writing; revert-able.

**Documents:**

- `comms/specs/observability.md` — *Erasure* rewritten around the three tiers; a **scope
  paragraph** naming which planes the table speaks for and excluding the model endpoint; the
  RLS correction; the trace plane's *"by construction"* argument now cites two gates instead of
  a type; tier 2 added to the missing list; a *"not on this list"* paragraph for tier 3.
  Decision 14 rewritten. **REQ-OBS-42** and **REQ-OBS-43** added; REQ-OBS-41 gains its second
  verification. *Retention* now names the ADR and says why the two are one document.
- `comms/decisions/ADR-036-erasure-and-retention.md` — `proposed`.
- `comms/BOARD.md` — **036 claimed before the file**; **035 registered retroactively** (it was
  on disk and absent from the register — the double-012 state); a paragraph on why.

## How to use it

```ts
const trace = obs.startRun(init);
trace.withhold(message.body);          // registers; traces nothing
trace.tool('mailbox.peek').error(`halted: ${message.body}`);
// → span error reads: halted: [REDACTED:withheld]
```

Nothing else changes. A `redact(value, path)` with no third argument behaves exactly as it did
before this file existed — asserted as its own test, because `db/ledger.ts` depends on it.

## Contracts touched

- **Consumed, not changed:** `contracts/thread-model.md` §7, §9.3, §9.4, §8b —
  `thread-model-engineer`'s. Their §9.4 asked which ADR holds the horizon; the answer is
  ADR-036 and the section stays **ANSWERED** rather than *"ANSWERED, pending"*, with the reason
  in their inbox.
- **Co-owned, not changed:** `redaction-rules.ts`'s rule set (`rtl-arabic-pdpl-specialist`).
  Their `body` denylist entry is **kept**, with the counter-argument they wrote.
- **Mine, changed:** `comms/specs/observability.md`, ADR-036, the BOARD register rows.

## Deliberately not done

**1. No delete verb, at any tier.** ADR-036 is `proposed`, not accepted, and no `DELETE`,
`rm -rf` or Langfuse delete call is written. It authorises the first destructive operation in
this product and it needs the human. Tier 2 is deliberately sequenced *after* tier 1 — shipping
the narrower blast radius first sounds prudent and is how the wide one arrives later untested.

**2. No retention horizon, and no number invented.** `ops.prune` is not extended to
`ops.thread` or `ops.message`. Any figure picked today is a plausible number on a surface with
zero threads, zero messages and zero runs — Part VII.3.

**3. Nothing for tier 3, and that is the ruling rather than a gap.** No full-text index, no
entity extractor, no "PII scan". A third party named inside free text cannot be selected at any
price, so each of those produces a number nobody can audit and a report that reads like
completeness. The erasure table names its own limit; an erasure surface that looks complete is
worse than one that does not.

**4. The type-level refusal `rtl-arabic-pdpl-specialist` asked about — declined, with reasons.**
`NotAMessage<T>` works (with `detail?: T & NotAMessage<T>`; their sketch would have inferred
`T = unknown` and evaluated to `unknown`). Declined anyway: it is **strictly weaker** than the
key rule already landed — it waves through `{nested:{deep:{m:message}}}`, which the key rule
catches — it would make its own gate uncompilable, and **it cannot reach the case that matters**.
`` `halted: ${message.body}` `` is a `string` before any signature sees it. Interpolation erases
provenance; characters are the only handle left, which is what produced `withhold.ts`.

**5. The one line at the mailbox drain is not written.** `runService.ts` is
`runner-engineer`'s, they are editing it this milestone, and the placement is a judgement I
would get wrong. Filed with the full diagnosis. **Until it lands, a body that only ever appears
inside an error string still leaks** — asserted as a *passing test* that names the message, not
a TODO.

**6. No source-reading gate on the drain.** I could fail the build when `runService.ts` reads a
body without withholding it. I did not: a gate that reads someone else's file goes red on their
refactor, and that is the kind of gate people delete rather than fix. Offered to them as an
option.

**7. Nothing said about egress, on purpose.** ADR-036 states in its own Decision section that it
does **not** settle the model endpoint: `lib/prompt.ts` renders prior bodies into the prompt and
no region or base-URL config exists in `apps/runner`. That ADR is
`rtl-arabic-pdpl-specialist`'s, unclaimed, and needs the human. I have not written a line of it.

**8. `ops.agent_runs.thread_id` untouched.** Still nullable, still written by the ledger and
never by a run. Both forcing functions still armed. Across the metrics endpoints and LAST RUNS
it is empty, honestly — `unknown` is not `zero`.

**9. Eleven older messages in my inbox stay open.** Answering them was not this dispatch's work
and doing it would have been the reading-cost failure the BRIEF names. Listed in status.

## Verification

Observed **2026-08-18 20:38–20:47 +03:00**, at `e9204e4` with other agents landing web/drawer
work concurrently — **the tree was not still**, and that is stated rather than glossed.

| Gate | Result |
|---|---|
| `test:runner` | **265 tests, 262 pass, 0 fail, 3 skipped** |
| `typecheck --workspace=@agnetos/runner` | **exit 0** |
| `typecheck` (repo) | **red — not mine.** `apps/web/src/drawer/JobDrawer.tsx(284,12)` missing `threadId` / `sendMessage`; concurrent thread-UI work. Runner and contracts are clean |
| `typecheck:tests` | exit 0 |
| `validate:comms` · `validate:coverage` · `validate:metrics` | **exit 0** each |

**Falsification — five plants, each confirmed present by `grep` before the run**, because a
substitution that never applied looks exactly like a gate catching it:

| Plant | Went red |
|---|---|
| scrub disabled in `redactString` | 6 tests |
| register dropped from the tool-error `redact()` call only | 4 tests |
| `collectWithheld` pre-pass disabled | 2 — including the key-order test |
| allowlist exemption widened to cover the register | 1 |
| windowed matching disabled (whole-literal only) | 1 — the truncation test |

Each plant removed, each suite back to green. `message-body-never-traced.test.ts`
(`rtl-arabic-pdpl-specialist`'s, 7 tests) passes **unchanged** alongside the new gate, including
both of its known-gap assertions — the register is per-run, so neither of their cases has a run
that was ever told. Making their assertions go green for the wrong reason would have been the
worse outcome.

**Structural, not empirical.** Zero runs have executed. `ops.message` has never held a row. No
span has ever been shipped to a Langfuse. Every claim above is about the payload this process
builds at the boundary where redaction is required to run — not about a trace anyone has seen.

## Next agent

- **`runner-engineer`** — `comms/inbox/runner-engineer/20260818-2045-…-one-line-at-the-mailbox-drain-…`.
  One line, and it closes the last state of the body leak.
- **`rtl-arabic-pdpl-specialist`** — the verdict on their type question and the disclosure of
  what changed in the erasure table are appended to their message in
  `comms/inbox/_archive/observability-engineer/20260818-0320-…`. **037 is the next free ADR
  number for their egress ruling — claim it on BOARD first, and check the register against
  `comms/decisions/` while you do.**
- **The human, via `commandcenter-orchestrator`** — ADR-036 carries two questions that are
  theirs: whether a retention horizon exists and what it is, and whether a destructive verb may
  exist at all. Read the ADR's *Decision* section; it is five numbered items.
