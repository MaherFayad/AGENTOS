# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-18T03:45
**Milestone:** M16 — `thread-model.md` §9.3 PDPL ruling · M8 ongoing
**State:** review

## Now
**§9.3's ruling half is closed, and the §7.2 flattening finding is a gate instead of a fifth
paragraph.** Ruling: v1 ships **project-level erasure only**, stated not gapped. The framing
correction is that **selection precedes deletion** — tier 1 (project) and tier 2 (author) are
selectable and not executable, and **tier 3, a third party named inside free text, is not
selectable at any price and no delete verb fixes it**. So minimisation is load-bearing, not tidy.
Derived planes are erasure-**by construction** (traces, metrics, ledger, push) — with one row I
added: **the model is a processor and a thread's history reaches it verbatim**, and this repo
asserts no processing region for that endpoint. *"Traces stay local"* answers for the
observability plane only.
**§7.1 had no enforcer.** Measured: `trace.event('mailbox-read', message)` +
`trace.tool(…).ok(message)` put the body **verbatim into the OTLP payload in three places**,
`hits: []`, nothing red. `messageSpanAttributes` was real and **opt-in** — it held because one
call site had good manners. Backstop landed (`body` + 4 on `KEY_DENYLIST`, disclosed to the file
owner) plus `message-body-never-traced.test.ts`, 7 tests. Falsified: keys removed → 4 red; the
2 known-gap tests correctly stay green.
**Two inert claims found and fixed:** `COMPANY.md` rule 7 asserted a working erasure capability
(false, inherited by every run), and **REQ-RTL-12's verification could not see it** — it asserted
four unrelated strings. Its checker now normalises whitespace, because the first draft went red
only on a line wrap, and a phrase-checker that fails open on rewrap is blind in the safe-looking
direction.

## Blocked on
nothing. `db/threads.ts:175` does not parse (backticks inside a SQL template literal, 15 runner
suites red) — **not mine**, routed to `thread-model-engineer` with the diagnosis.

## Last handoff
`comms/handoffs/M15-rtl-arabic-pdpl-specialist-checker-counts-what-it-names.md`
(this dispatch is a ruling + a routed request + a gate; no handoff by design)

## Next
1. **§23.11 rule-6 pass over the new M16 surfaces** — THREADS view, composer, `thread-feed`,
   tab slot. Deferred deliberately: four agents were in those files during this dispatch.
2. The egress ADR, now **three** things not two: `deliver:` · `library_remote` · **the model
   endpoint's unasserted region**. Needs the human.
3. `components/shell` — 91 findings, the largest module and now fully visible.
4. Empty states in both languages · light-theme parity · mobile QA (M8 core).

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
