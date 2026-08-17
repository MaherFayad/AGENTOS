# BRIEF — read this, not the whole board

**This file is rule 1's target and it is capped at 150 lines.** `BOARD.md` is the full
record: consult the section you need, do not ingest it. It is over 1,300 lines, and when
every dispatch read it end to end the reading cost exceeded the work.

If something here disagrees with BOARD, **BOARD wins** and this file is stale — say so.

---

## Where the build is

- **Done:** M0, M1, M2, M5 · **M15** (Projects · cascade · identity) — PASSED 2026-08-17.
- **Open:** **M16** — Threads · addressing · mailbox (`Plan §12`). Foundation and wave one
  landed: ADR-023, `contracts/thread-model.md`, `0008_threads.sql`, the thread routes and
  mailbox drain, `thread_id` on the metrics plane, the address and interrupt registers.
- **Not started:** the THREADS view, the mailbox composer, the `thread-feed` widget, the
  tab-slot change. These consume `contracts/thread-model.md` — read it before building.
- **Phase 0 is still open**, and it blocks *validation* of everything, not construction.

## The one sentence that governs every claim

> **Completed is not validated.** Zero agent runs have ever executed. `runnerConfigured`
> is false, the ledger is empty, and migrations `0005`–`0008` have never met a live
> Postgres. Anything you build is *structural* until a real run exercises it. Label it that
> way; do not let a column landing read as the feature working.

## With the user, blocking everything empirical

`RUNNER_ANTHROPIC_API_KEY` (the value in `.env` is a placeholder — right prefix, 23 chars)
· the twenty `COMPANY.md` answers (0/20) · Tailscale · the headless browser + reference
frames · ADR-011.

**Never** invent, stub or work around the API key. **Never** write a figure into
`spend.json`. **Never** fabricate a `COMPANY.md` answer.

---

## The rules that do not bend

1. Chrome is monochrome; colour is data ink. 2. Frontmatter is the single source of truth;
views are projections. 3. Dashboards are data — `panels/*.json`, seven widget types.
4. The runner's allowlist is **exactly** `wired_into`, never a superset. 5. Session E2E
decryption is client-side, always. 6. No public ports; nothing safe only because auth
exists. 7. Traces local, PII redacted **at instrumentation**. 8. No hex outside
`tokens.css`; no component library. 9. Numbers must be real — an honest empty state beats
a plausible fake one.

---

## Standing findings — earned, do not rediscover

Every one of these cost a session. They are here so the fourth agent does not find them a
fourth time.

**The house defect: a declared value read as an observed one.** Found in nine costumes —
a brain completeness of 45% counted from headings, `runs: 0` during a ledger outage,
`"tailscale": "online"` on a host with none, a token count with no timestamp. When you
report a number, say where you observed it.

**Grade a constraint from both sides.** A `NOT NULL` nobody can satisfy and one that holds
are identical in a schema dump. Migration 0005 added four NOT NULL columns the ledger
writer never named; the first paid run would have failed to record *after* the model was
paid for.

**A comment is not a mechanism.** `workspace` confinement was a docstring and a run
overwrote `.env`. `index.ts` called a duplicate export "harmless" and it white-screened
every route. If a rule names no enforcer, it enforces nothing.

**A test that has never been red proves nothing.** Falsify: plant the defect, watch the
gate fail, remove it, watch it pass. Three real bugs were confirmed this way and two
checkers were caught reporting green while blind.

**Checkers go blind silently.** `check-rtl` could not see 190 rendered strings; a
comment-stripper dropped 80,489 characters and still passed; a coverage gate never
resolved half its table. Ask what your instrument *cannot* see and write the answer down.

**A gate narrower than the vocabulary its authors must use will silently edit them.** The
coverage gate rejected `Plan §n`, so two agents quietly rewrote their citations to pass.
The evidence lands in the claims, not in the gate.

**Flattening defeats key-based redaction.** As an object, four keys redact; the same
content flattened into prose leaks four of five. Found three times — the approvals
`summary`, the plan span, the redactor. `ops.message` is worse: free text with no keys at
all, so no rule fixes it. The defence is a type with no `body` field.

**A producer without a consumer is not a feature.** A required `sourceRef` shipped on the
runner while the drawer's type dropped it; the header said UNKNOWN for every agent, with
nothing red.

**`unknown` is not `zero`, and an aggregate over a failed read is `unknown`.** A failed
load dimmed seven CHART tabs, and dimming is a claim.

**A gate loads a page now — it did not, and that is how a dead app passed everything.**
`tsc`, three suites, every validator *and* `next build` were green while the app
white-screened. `validate:barrel` and `smoke` observe the artifact; **`smoke:browser`
(`check-page-errors.mjs`) runs it in Chrome** and fails on any uncaught throw, `console.error`
or browser error. Our own `/api/` 5xx is reported, not fatal — the ledger is honestly absent.
The 1440px side-by-side is still not runnable: it needs **reference frames**, not a browser.

---

## Working rules for subagents — scale the paperwork to the work

Prose is not the deliverable. This repo produced 28k lines of markdown against 12k lines
of product code in one session; most of it was agents re-deriving context and writing to
each other. Read narrowly, write narrowly.

- **Read:** this file · your `status/<you>.md` · your **open** inbox (answered mail lives
  in `inbox/_archive/`) · the **sections** of contracts you actually consume. Not whole
  contracts, not the whole board.
- **Write, by size of work:**
  - *One file, understood, no contract change* → the code, its test, one status line. **No
    handoff, no broadcast, no FYIs.**
  - *A milestone slice, or anything another agent consumes* → handoff with *Deliberately
    not done*, spec requirements with **real tests**, status update.
  - *A decision another agent could contradict* → an ADR. Claim the number on BOARD
    **before** writing the file; allocating from a directory listing has failed twice.
- **Close your messages.** Set `status: answered`, write the `## Answer`, and move the file
  to `inbox/_archive/<agent>/`. An inbox that only grows is a tax on every later dispatch.
- **Do not send an FYI that changes nobody's work.** If it changes someone's work, it is a
  `decision-request` or a finding with an owner — send that instead.
- **Prefer a gate to a paragraph.** A finding written into a test keeps working for free; a
  finding written into a handoff is read once. When you find something, ask whether it can
  fail a build.
- **Stay in your files.** Concurrent agents are normal here. If a fix belongs to someone
  else, file it with the diagnosis rather than reaching across — and file it to the
  **owner's inbox**, not into a code comment. A defect assigned inside a comment reached
  nobody for a week.

## Gates

`npm run verify` runs the source gates; **`npm run verify:runtime` adds the two that observe
a running app** (`smoke`, `smoke:browser`). Individually: `test`, `test:web`, `test:runner`,
`typecheck`, `validate:barrel`, `validate:coverage`, `validate:tokens`, `validate:rtl:gate`,
`validate:frontmatter`, `validate:comms`. `smoke:browser:falsify` proves the browser gate
can still go red; run it if you ever doubt a green.

Run them on a **still tree**. Several reports have been invalidated by another agent
landing mid-run. Quote `check-tokens`'s provenance banner verbatim when citing token
results (contract §8b) — a number without it does not count.
