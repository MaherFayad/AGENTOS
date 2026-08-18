# ADR-036 — Erasure and retention: the product's first two destructive operations, and the tier no delete verb reaches

**Date:** 2026-08-18 · **Author:** `observability-engineer` · **Status:** proposed
**Affects:** `comms/specs/observability.md` (erasure + retention) · `contracts/thread-model.md`
§7.3, §9.3, §9.4 · ADR-008 (retention horizons) · ADR-015 Q4 (project deletion) · `ops.prune`
· `company/COMPANY.md` §7 rule 7 · M16 and every milestone after it

> **Row claimed on BOARD before this file was written**, per `decisions/README.md`. While
> claiming it, **ADR-035 was found on disk and absent from the register** — the double-012
> state, one step from happening again. It is registered now.

## Context

PDPL rule 7 in `COMPANY.md` read *"Right to erasure is executable."* It was false, and the
standing finding that replaced it — *"erasure has no delete verb in any plane"* — was one step
short in a way that changes what to build.

**Deletion presupposes selection.** `rtl-arabic-pdpl-specialist`'s ruling of 2026-08-18 splits
the problem on that axis, and it stops being one problem:

| Tier | Unit | Selectable? | Executable? | Does a delete verb fix it? |
|---|---|---|---|---|
| 1 | project | yes | no | **yes, in the live planes** — a backup is a fourth store and no `DELETE` reaches it |
| 2 | author — `ops.message.author = 'human:{identity}'` | yes | no | **yes for what that author wrote**, which is not the same as an erasure request *from* that person |
| 3 | a third party named *inside* free text | **no, at any price** | no | **no** |

**Both qualifications are `rtl-arabic-pdpl-specialist`'s, and both live in
[`company/COMPANY.md`](../../company/COMPANY.md) rule 7, not here.** They were graded onto this
ADR on 2026-08-18 and deliberately written into that file instead, because it is injected into
every run of every project and this ADR is read once. This table now agrees with it rather than
restating it; if the two ever diverge, **rule 7 is the text and this is the summary**. What each
qualification costs is worth one line, because both are read wrongly by default and the wrong
reading is the flattering one:

- **An author is not a data subject.** A single natural person is simultaneously tier 2 for
  their own rows and **tier 3 for everything other people wrote about them** — so the three
  tiers are not three populations, and *"we can erase an author"* answers *"delete everything I
  typed"*, never *"honour my erasure request"*. Which means the conflation this ADR exists to
  prevent was reachable one row above where it prevents it.
- **A backup is a fourth store.** Rule 2 requires encrypted backups; restoring one resurrects
  what tier 1 erased. Judged by this ADR's own standard — *an erasure that cannot be proven
  complete is not an erasure* — that is not complete, and the answer is a backup rotation
  shorter than the erasure commitment: a written, observed number, not a property of the verb.
  It is the human's, like the other two in decision 5, and it is not guessed here.

**Neither weakens tier 3, and neither is a gap to be closed later.** They make tiers 1 and 2
narrower; tier 3 is unchanged and stays what it was — **unreachable by any delete verb, and
that is the finding.** Read the wrong way round, "an author is also tier 3" becomes an argument
for building a tier-3 selector; it is the opposite. It is one more population that minimisation
is the only mechanism for.

Tier 3 is why this is an ADR and not a ticket. A `DELETE` landing tomorrow would not answer
*"remove Fatima Al-Harbi"*: she never touched this system, her name is inside a sentence
someone typed into `ops.message.body`, the rows cannot be enumerated, and full-text search is
a guess whose false negatives nobody can count — a misspelling, a nickname, an Arabic
rendering, a pronoun. **An erasure that cannot be proven complete is not an erasure.**

Retention arrives with it because `ops.prune` exists and `ops.thread` / `ops.message` are not
in it. §9.4 asked for a horizon; the answer was **no horizon**, deliberately, and that answer
is only safe while it is *written down*. An unbounded table that says so is an operational
task. An invented 90-day horizon on a client's conversation is a data-loss incident with a
changelog entry.

**Two constraints make the obvious option not obvious.**

1. **Part VII.3 — numbers must be real.** Any retention figure picked today is a plausible
   number on a surface with no data to derive it from: zero threads, zero messages, zero runs.
   It is the same rule that types `TurnCost.estimatedUsd` as `null`, applied to a duration.
2. **`ops.message` is the first plane holding a data subject's own words in full**, and the
   redactor is demonstrably not a fallback for it: `redact('Chase Fatima Al-Harbi about the
   Olaya lease…')` returns the string **verbatim with `hits: []`**, because free text has no
   keys. Minimisation, not deletion, is the tier-3 mechanism — which makes minimisation
   decisions load-bearing rather than tidy.

## Options

| Option | For | Against |
|---|---|---|
| **A — Ship a `DELETE` verb now at every tier we can, and describe erasure as solved** | One statement per table; the operation terminates; the compliance sentence reads well | The sentence would be false where it matters most. Tier 3 is untouched and a surface that *looks* complete stops anyone asking the question again. This is the house defect — a declared value read as an observed one — on the highest-stakes surface in the repo |
| **B — Defer all of it until a subject-level answer exists** | Nothing irreversible ships early | "It waits" with no owner becomes "it was forgotten". Tier 3 has no answer coming, so this defers tiers 1 and 2 forever on account of a tier they do not depend on |
| **C — Build tiers 1 and 2; state tier 3; leave retention unbounded and say so; one ADR for both** *(chosen)* | Each claim is exactly as wide as its evidence. The two destructive operations get one review, one blast radius and one human number | Two open items carrying the human's name, visible on the board, uncomfortable — which is the correct discomfort |
| **D — Split erasure and retention into two ADRs** | Smaller documents; each ships when its owner is ready | They share an enforcement point and a blast radius. Split, the irreversible half acquires a default six weeks later, in a migration nobody asked to review, under the honest-sounding heading *"align thread retention with span retention"* |
| **E — Pick 90 days for threads, matching ADR-008's spans** | A number exists; growth is bounded; it looks decided | ADR-008's horizons are horizons **on telemetry**. A span is exhaust; a thread is the record of what a person asked and what was done about it, and `Plan §12` seeds every continuation from it. A cron would delete the product's memory at 03:00, silently — and would make erasure *look* solved for an unrelated reason |

## Decision

**We ship project-level erasure (tier 1), we build author-level erasure (tier 2) from the same
verb behind it, and we state tier 3 as a limit rather than implying coverage we do not have.
Retention stays unbounded, deliberately and in writing. Both live in this one ADR, and both
carry a decision that is the human's.**

Concretely:

1. **Tier 1 is one named operation**, `eraseProject(projectId)`, not five ad-hoc statements:
   `DELETE … WHERE project_id = $1` across `ops.agent_runs`, `ops.agent_run_tools`,
   `app.agent_outputs`, `ops.message`, `ops.thread`; the Langfuse trace-delete API over the
   trace ids `metadata.project` returns; one `rm -rf` of `<artifactsRoot>/<project>/`. It is
   destructive, so it lands behind this ADR and **not** inside a migration.
2. **Tier 2 is the same verb with one more predicate** — `AND author = $2` — and lands
   **after** tier 1, not alongside it. Shipping the narrower blast radius first sounds prudent
   and is how the wide one arrives later, untested, in a hurry.
3. **Tier 3 gets no item on any list.** Not a full-text index, not an entity extractor, not a
   "PII scan" job. Each produces a number nobody can audit and a report that reads like
   completeness. The obligation is discharged by **not accumulating** the text — so §9.6 (no
   thread title), §5.2 (`payload` is an object, never prose), contentless push, and
   `messageSpanAttributes` having no `body` field are hereby **PDPL decisions and may not be
   relaxed for convenience**, whatever their original argument was.
4. **Retention: no horizon.** `ops.prune` is not extended to `ops.thread` or `ops.message`.
   ADR-008's 90/400-day horizons stay exactly where they are, on telemetry.
5. **Two things are the human's** and neither is guessed here: whether a retention horizon
   exists at all and, if so, its number; and the authorisation for a destructive verb to exist
   in this product. Until both land this ADR is `proposed` and no `DELETE` is written.

**What this ADR does not decide, stated because a reader will otherwise assume it did.**
Nothing here settles **data egress to the model endpoint**. `lib/prompt.ts` renders every prior
turn's `body` into the user prompt, and this repo asserts **no processing region** for that
endpoint — no region and no base-URL configuration exists anywhere in `apps/runner`. So a
message body leaves the tailnet the moment a thread takes a second turn. Rule 7's *"traces
stay local"* answers for the observability plane and not for the plane carrying the words
(`thread-model.md` §7.1, corrected 2026-08-18). Cross-border transfer under PDPL Arts. 29–31
is `rtl-arabic-pdpl-specialist`'s **data-egress ADR**, it is unclaimed and unnumbered as of
this file, and it needs the human. An erasure decision that let itself be read as covering
every path the text takes would be worth less than none.

## Consequences

**Easier.** A deletion request has a written answer for the first time: *"we erase everything
for that client, or everything one author wrote; for a third party named inside a message we
do not delete, we do not accumulate — here is the list of mechanisms that make that true."*
Each mechanism cites a gate, not a paragraph.

**Harder — on purpose.** Four design decisions are now frozen against convenience. The next
author who wants a thread title, or prose in `payload`, or a body in a push notification, has
to reverse a PDPL decision rather than make a UI choice. Expect all four to be re-proposed;
each is individually reasonable.

**Growth is now an operational question, not a retention one.** Nothing deletes a thread or a
message, and volume is bounded today only by there being no rows. Whoever runs this box owns
watching it. That is a real cost and it is the one being chosen.

**If we reverse this later**, the expensive half is tier 3. Any future "subject-level erasure"
claim must state its false-negative rate or it is the same overclaim in new words. Reversing
the retention position means writing a number, and that number deletes the product's memory
by cron — so it needs the same review this file got, not a follow-up commit.

**What is verifiable today: none of it, and that is Part VII.3 rather than an excuse.** Zero
runs have executed, `ops.message` has never held a row, and migrations `0005`–`0008` have
never met a live Postgres. Every claim here is **structural**. The first real deletion request
is what tests it, and the ADR should be re-read on the day one arrives.

## Contract edits

- `comms/specs/observability.md` — *Erasure* rewritten around the three tiers; the plane table
  gains a **scope paragraph** naming which planes it speaks for and excluding the model
  endpoint; the `ops.thread`/`ops.message` row drops **RLS** from its list of live mechanisms
  (a superuser bypasses it; `thread-model.md` §8b — cite, do not conclude from); the missing
  list gains tier 2 and a *"not on this list"* paragraph for tier 3; *Retention*'s
  *"what it needs"* row now names this ADR. New **REQ-OBS-42** and **REQ-OBS-43**.
- `comms/BOARD.md` — ADR register: **035 registered retroactively** (file existed, row did
  not), **036 claimed**, and a paragraph on why a file at an unlisted number is the double-012
  in slow motion.
- `contracts/thread-model.md` — **no edit; it is `thread-model-engineer`'s.** §9.3 and §9.4
  already carry the ruling and the horizon; §9.4's *"the same ADR as the delete verb"* now
  resolves to this number, which is the one thing they asked for.
- `company/COMPANY.md` — **no edit; it is `rtl-arabic-pdpl-specialist`'s.** Rule 7 there
  already states the three tiers and rule 10 already states the model is a processor. On
  2026-08-18 they added the author/data-subject distinction and the backup-as-fourth-store
  limit to rule 7 while grading this ADR. **That file is normative for both and this one now
  cites it** — the reconciliation is above, in Context. Putting them there rather than here was
  the right call and is worth naming: rule 7 is injected into every run of every project, so a
  correction placed there is inherited, and the same correction placed in an ADR is read by
  whoever opens the ADR.
- `apps/runner/src/observability/withhold.ts` — decision 3's minimisation freeze acquires its
  first mechanical consequence. The literal register's bound was `literals.shift()` at 32,
  which `rtl-arabic-pdpl-specialist` graded as a **fail-open**: the 33rd registered body
  silently un-protected the 1st. It now refuses the newest, counts refusals, and reports them
  on the root span as `withheld_refused`; protection is monotonic. Gated by
  `withheld-text-never-traced.test.ts` §4, which is red on the old shape.
