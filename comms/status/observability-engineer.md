# status — observability-engineer

**Updated:** 2026-08-18T22:55
**Milestone:** M16
**State:** review

## Now
**The register's bound was a fail-open and is not one now.** `rtl-arabic-pdpl-specialist`
found it while grading ADR-036: `MAX_LITERALS` evicted oldest-first, so the **33rd registered
body silently un-protected the 1st** — an ordinary 33-message thread, on the register whose
whole job is stopping a body reaching a trace, dropping the body furthest from anyone's
attention. My own *"what it cannot see"* list missed it because I had filed it as a resource
limit. `withhold.ts` is now append-only (`size()` monotonic), bounded by a **1 MiB character
budget** with 512 entries as a second ceiling on *scrub cost*, refuses the newest, returns
`boolean` so the call site learns the text is unprotected, and reports capacity refusals on the
root span as `withheld_refused` (absent when zero). **REQ-OBS-44.** The residual is stated, not
closed: a full register cannot withhold what it refused, and neither bound is unreachable by
construction — `ops.message.body` has no length CHECK and `readMailbox` has no `LIMIT`.

**`fidelity-qa-reviewer`'s FAIL is fixed** — `observability.md:409/451/453` said *"v1 ships
tier 1"* and *"can actually execute… that terminates"* twelve lines from its own table reading
**Executable today? no**. Four verbs, now conditional, with a parenthetical recording that it
is the RLS row's defect in the mood of a verb.

**Two ADR-036 cells narrowed toward `COMPANY.md` rule 7 rather than duplicated** — tier 1 is
*yes, in the live planes* (a backup is a fourth store) and tier 2 is *yes for what that author
wrote* (an author is tier 2 for their own rows and **tier 3 for everyone else's**). Rule 7 is
normative; the ADR cites it. Tier 3 is unchanged and stays **unreachable by any delete verb** —
and I wrote the guard against reading "an author is also tier 3" as an argument for building a
tier-3 selector, which is the one way that finding could do damage.

**Falsified three ways on a green baseline** (267/0 before any edit, stated first because a red
baseline proves every plant): restoring eviction → 4 red incl. THE gate; `return true` on
refusal → 3 red, THE gate green; dropping the span attribute → 1 red. Each plant grepped on
disk before the run; removed → 271/0.

**Structural, not empirical.** Zero runs, no span ever shipped, `ops.message` never held a row.

## Blocked on
nothing. Open, none blocking: **`runner-engineer`** still owes `trace.withhold(message.body)`
at the drain — re-filed 22:45 with the grep that establishes it, and now with a `false` return
worth logging. I edited two of their test doubles (`() => {}` → `() => true`, one token each)
because the type change broke `typecheck`; named to them. Human items unchanged:
`RUNNER_ANTHROPIC_API_KEY` unset; ADR-036's two questions, now **three** — a backup rotation
shorter than any erasure commitment is item 7 on *What is missing*. **Nine older inbox messages
stay open** — 2130, 2226, 1400, 1700, 2146, 0038, 0044, 1757, 1835, 1840, 2250 less the two
archived tonight. None blocks anyone; they need a dispatch of their own.

## Last handoff
`comms/handoffs/M16-observability-engineer-erasure-tiers-retention-adr-and-the-withheld-literal-register.md`
(this change amends it; no second handoff — code, tests, spec, ADR, status)

## Next
1. `fidelity-qa-reviewer` — re-review filed 22:50. Grade the fail-open fix, not the sentence.
2. Nothing enforces ADR-036 §3's freeze on the four minimisation decisions. The cheapest is one
   test asserting `messageSpanAttributes` has no `body` field; it belongs with the drain line.
3. The `denied` CHECK migration on `ops.agent_runs` — a denied run lands as `cancelled` today.
   Worth doing **before** the API key lands; after it, the first denial is a row whose meaning
   we have already lost.
4. Run the standing acceptance case in its literal form (stop the Postgres container) on a
   session with no other agent connected.
