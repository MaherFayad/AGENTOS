# status — observability-engineer

**Updated:** 2026-08-18T20:50
**Milestone:** M16
**State:** review

## Now
The §9.3 erasure table rewritten around the **three tiers** — project and author are
selectable and a delete verb fixes them; a third party named inside free text is **not
selectable at any price** and a delete verb does not. Stated as a limit, not a roadmap:
nothing on the missing list can be written for tier 3, because a full-text scan produces a
number nobody can audit. The table now opens by naming **which planes it speaks for** and
excluding the model endpoint, and it dropped RLS from a row that listed three enforcers where
two run on the only stack that exists (`thread-model.md` §8b — `thread-model-engineer` found
that in my file).

**ADR-036** — erasure + retention in one document, `proposed`, **row claimed on BOARD before
the file**. Claiming it turned up **ADR-035 on disk and absent from the register**; registered
retroactively. It says in its own Decision section that it does **not** settle egress.

**The error-string leak is closed for two of its three states.**
`observability/withhold.ts` — a per-run register of withheld literals, matched whole or in any
32-character window (§9.3 refuses truncation by name). No type could have done this:
`` `halted: ${body}` `` is a `string` before any signature sees it, so I declined
`rtl-arabic-pdpl-specialist`'s `NotAMessage<T>` and said why. Automatic when a body passes
under a denylisted key; explicit via `trace.withhold()` otherwise. Five plants, each grepped
before the run, each red on the right tests.

**Structural, not empirical.** Zero runs, zero messages, no span ever emitted. `thread_id` has
never held a value and is empty everywhere, honestly.

## Blocked on
nothing. Open, none blocking: **`runner-engineer`** owes one line at the mailbox drain
(`trace.withhold(message.body)`) — until then a body that appears *only* in an error string
still leaks, asserted as a passing test. Human items unchanged: `RUNNER_ANTHROPIC_API_KEY`
unset; ADR-036's two questions (does a horizon exist, may a destructive verb exist).
**Eleven older inbox messages stay open** — 2130, 2226, 1400, 1700, 2146, 0038, 0044, 1757,
1835, 1840, 2250. None blocks anyone; they need a dispatch of their own.

## Last handoff
`comms/handoffs/M16-observability-engineer-erasure-tiers-retention-adr-and-the-withheld-literal-register.md`

## Next
1. `fidelity-qa-reviewer` — grade whether any claim is wider than its evidence, not fidelity.
2. The `denied` CHECK migration on `ops.agent_runs` — a denied run lands as `cancelled` today.
   Worth doing **before** the API key lands; after it, the first denial is a row whose meaning
   we have already lost.
3. Run the standing acceptance case in its literal form (stop the Postgres container) on a
   session with no other agent connected.
4. If `runner-engineer` prefers it, add the drain-source gate I declined to write unasked.
