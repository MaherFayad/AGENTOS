# BRIEF — read this, not the whole board

**This file is rule 1's target and it is capped at 150 lines.** `BOARD.md` is the full
record: consult the section you need, do not ingest it. It is over 1,300 lines, and when
every dispatch read it end to end the reading cost exceeded the work.

If something here disagrees with BOARD, **BOARD wins** and this file is stale — say so.

---

## Where the build is

- **Done:** M0, M1, M2, M5 · **M15** (Projects · cascade · identity) — PASSED 2026-08-17.
- **Open: M16** — Threads · addressing · mailbox (`Plan §12`). Landed: ADR-023 + ADR-028,
  `contracts/thread-model.md`, `0008_threads.sql`, thread routes and mailbox drain,
  `thread_id` on metrics, both registers, `thread-feed`, THREADS in the tab slot.
- **Not started:** the THREADS view and the mailbox composer. Both consume
  `contracts/thread-model.md` — read its sections before building.
- **Phase 0 is still open**, and it blocks *validation* of everything, not construction.

> **Completed is not validated.** Zero agent runs have ever executed. `runnerConfigured` is
> false, the ledger is empty, and `0005`–`0008` have never met a live Postgres. What you
> build is *structural* until a real run exercises it. Label it that way; never let a column
> landing read as the feature working.

**With the user, blocking everything empirical:** `RUNNER_ANTHROPIC_API_KEY` (the `.env`
value is a placeholder) · the twenty `COMPANY.md` answers (0/20) · Tailscale · **reference
frames for the 1440px comparison** (the browser half is done — `smoke:browser`) · ADR-011.
**Never** invent or work around the API key, write a figure into `spend.json`, or fabricate
a `COMPANY.md` answer.

## The rules that do not bend

1. Chrome is monochrome; colour is data ink. 2. Frontmatter is the single source of truth;
views are projections. 3. Dashboards are data — `panels/*.json`, seven types **+ exactly
three named extensions, ever** (ADR-028). 4. The runner's allowlist is **exactly**
`wired_into`. 5. Session E2E decryption is client-side, always. 6. No public ports; nothing
safe only because auth exists. 7. Traces local, PII redacted **at instrumentation** — but
see the flattening finding: this rule does *not* cover the prompt, and message bodies do
leave. 8. No hex outside `tokens.css`; no component library. 9. Numbers must be real — an
honest empty state beats a plausible fake one.

## Standing findings — earned, do not rediscover

Every one cost a session, so the fourth agent does not find them a fourth time.

**The house defect: a declared value read as an observed one.** Found in nine costumes —
a brain completeness of 45% counted from headings, `runs: 0` during a ledger outage,
`"tailscale": "online"` on a host with none, a token count with no timestamp. When you
report a number, say where you observed it.

**Grade a constraint from both sides.** A `NOT NULL` nobody can satisfy and one that holds
look identical in a schema dump. 0005 added four the ledger writer never named — the first
paid run would have failed to record *after* the model was paid for. A constraint narrower
than the comment above it is the same defect: `in_reply_to` was the one FK in `0008` not
project-pinned, under a comment promising messages cannot cross projects.

**A comment is not a mechanism.** `workspace` confinement was a docstring and a run
overwrote `.env`. `index.ts` called a duplicate export "harmless" and it white-screened
every route. If a rule names no enforcer, it enforces nothing.

**A test that has never been red proves nothing.** Plant the defect, watch it fail, remove
it, watch it pass. This has caught more than it costs — including this file's own line-cap
gate, which passed its first falsification while counting non-blank lines against a cap
that said "lines", and a money gate that was both inert and aimed at the wrong line.

**Checkers go blind silently — the largest family here, and it keeps arriving in new
costumes.** A comment-stripper deleted half its corpus and passed; under it, the PDPL
assertion had *never once read the table it named* — a planted email scored 9/9 green.
`check-rtl` could not see 190 strings. A coverage gate never resolved half its table. A
smoke marker matched the tab names in `<meta name="description">`, so it passed against a
shell with **no tab bar at all**. `CHROME_DIRS` was an include-list, blind to any directory
that did not exist when it was written. **An include-list is a decision to be blind to
everything unnamed; a substring is a claim you did not narrow.** Ask what your instrument
*cannot* see, write it down, and prefer a marker only the real thing can satisfy.

**A test excluded from typecheck makes every type assertion inside it decorative.**
`apps/web/tsconfig.json` excluded the suite and vitest does not typecheck, so six
`@ts-expect-error` gates proved nothing — including ones cited in granted PASSes. The
runner's were always live. `npm run typecheck:tests` closes it. Related: **`typecheck`
green and `test:runner` red is reachable** — `tsc` and esbuild are different parsers, so a
file that does not parse shows up as `TransformError` in files that never import it.

**A gate narrower than the vocabulary its authors must use will silently edit them.** The
coverage gate rejected `Plan §n`, so two agents quietly rewrote their citations to pass.
The evidence lands in the claims, not in the gate.

**Flattening defeats key-based redaction.** As an object, four keys redact; flattened into
prose, four of five leak. Found four times — approvals `summary`, the plan span, the
redactor, and `trace.event('mailbox-read', message)` putting a body verbatim into OTLP with
nothing red. Now gated. A body inside an **error string** still leaks and no key rule
reaches it. **And the words leave the tailnet anyway:** `lib/prompt.ts` renders prior turns
into the model prompt, and this repo asserts no processing region for that endpoint —
*"traces stay local"* answers for the observability plane, not the one carrying the text.
Erasure has a third tier that no `DELETE` verb can reach: a third party named inside free
text cannot be selected at all, which is what makes minimisation load-bearing.

**A producer without a consumer is not a feature.** A required `sourceRef` shipped on the
runner while the drawer's type dropped it; the header read UNKNOWN for every agent, nothing
red. It hides in test files too — one built a `start` event without the fields M15 made
required, forty lines above one that had been updated. **`unknown` is not `zero`**, and an
aggregate over a failed read is unknown: a failed load dimmed seven CHART tabs, and dimming
is a claim.

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
- **Prefer a gate to a paragraph.** A finding in a test keeps working for free; one in a
  handoff is read once. Ask whether what you found can fail a build.
- **Stay in your files.** Concurrent agents are normal. If a fix belongs to someone else,
  file it with the diagnosis to the **owner's inbox** — not into a code comment, which once
  reached nobody for a week. Commit with `git commit -- <paths>`; **never `git add -A`**,
  which has swept another agent's in-flight work into an unrelated commit.

## Gates

`npm run verify` runs the source gates; **`verify:runtime` adds the two that observe a
running app** (`smoke`, `smoke:browser`). Also: `test`, `test:web`, `test:runner`,
`typecheck`, `typecheck:tests`, `validate:{barrel,coverage,tokens,rtl:gate,frontmatter,comms}`.
`smoke:browser:falsify` proves the browser gate can still go red — run it if you doubt a green.

Run them on a **still tree**; reports have been invalidated by another agent landing
mid-run, so state your observation time. Quote `check-tokens`'s provenance banner verbatim
when citing token results (contract §8b) — a number without it does not count.
