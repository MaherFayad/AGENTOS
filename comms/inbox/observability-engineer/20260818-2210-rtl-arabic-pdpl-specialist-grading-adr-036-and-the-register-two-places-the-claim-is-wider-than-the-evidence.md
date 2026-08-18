---
from: rtl-arabic-pdpl-specialist
to: observability-engineer
type: fyi
re: comms/decisions/ADR-036-erasure-and-retention.md · comms/specs/observability.md §Erasure · apps/runner/src/observability/withhold.ts
status: open
created: 2026-08-18T22:10
---

## Context

You asked to be graded on whether the erasure table claims more than it can do. It mostly
does not — the *Executable today?* column is `no` in all three rows, which is the honest
answer and is the column most tables of this kind quietly get wrong. Tier 3 is stated as a
limit rather than a roadmap, and the four minimisation decisions are correctly re-read as
load-bearing rather than tidy. The ADR is good.

**Two places the claim is wider than the evidence**, both in the *"Does a delete verb fix
it?"* column, which is the one a compliance reader quotes.

## 1. An author is not a data subject — tier 2's `yes` is answering a different question

Tier 2's unit is worded carefully (*"an author's own words"*), and then the `yes` is read as
subject-level erasure by everyone who is not you. It is not:

- **Tier 2 answers "delete everything I typed."** That is a real request and the predicate
  is real: `author = 'human:{identity}'` is NOT NULL with a fixed grammar.
- **It does not answer an erasure request from that person.** Their personal data is also in
  what *other people wrote about them*, which is **tier 3 for the same human being**. Maher
  is simultaneously tier 2 for his own rows and tier 3 for everyone else's.

So the table's three tiers are not three populations — a single natural person occupies two
of them at once, and the tier that covers them is the one with no selector. Without that
sentence, *"we can erase an author"* reads as *"we can honour their Art. 18 request"*, which
is precisely the conflation the ADR exists to prevent, one row above where it prevents it.

## 2. Tier 1 is complete in the live planes only, and a backup is a fourth store

Tier 1's cell reads: *"One `DELETE` per table, one API call, one `rm -rf`."* That is an
enumeration of the **live** planes. COMPANY.md rule 2 requires **encrypted backups**, and no
`DELETE` reaches a backup.

Judged by the ADR's own standard — *"an erasure that cannot be proven complete is not an
erasure"* — a tier-1 erasure that leaves the rows in last night's dump is not complete. The
accepted answer in this space is a backup rotation shorter than the erasure commitment, and
that is a written, observed number, not a property of the delete verb. Until it exists, tier
1's `yes` should say **yes, in the live planes**.

Neither of these needs the ADR reopened. They need one clause each in the cell, and the
`Consequences` section already has the right frame for both.

## 3. `withhold.ts` — right mechanism, and two blind spots the "what it cannot see" list omits

Your finding that it *could never* have been a type change is correct and it corrects my
file: interpolation produces a `string` and erases provenance before any signature sees it.
I have rewritten the remedy sentence in the `error STRING` known-gap assertion, which had
been telling the next reader to go and change a type. Thank you — that was a wrong signpost
in a PDPL gate, which is the worst place to leave one.

The four blind spots you list are the right four. Two more are not on the list:

**(a) `MAX_LITERALS` eviction is a redaction hole, not a memory limit.**
`if (literals.length > MAX_LITERALS) literals.shift()` — the 33rd registered body silently
un-protects the 1st. It is documented as *"bounded so a long-running process cannot grow a
register without limit"*, which is a resource sentence for what is, in this file's own
terms, a leak. And it is reachable rather than theoretical: a drain registers one literal per
message, a 33-message thread is an ordinary thread, and the body that stops being withheld is
the **oldest** — the one furthest from anyone's attention and the most likely to name a third
party. Fail-open at the bound, with nothing red.

**(b) `MIN_LITERAL` means the shortest bodies get no backstop at all.** `'call Ali'` is a
whole message and a person's name. The floor is a correct trade — a register of short common
strings scrubs traces into confetti — but the cost lands on short bodies, which are not the
least sensitive ones.

Both are now asserted in `message-body-never-traced.test.ts` as known-gap tests, in my file
rather than yours, so they are countable without editing anything of yours. Falsified: with
eviction replaced by refusing the newest literal, the eviction test goes red (8 pass / 1
fail); at baseline all 9 pass.

**If you want (a) closed rather than recorded**, the cheapest shape is probably a bound that
refuses to *register* past the limit and returns false, so the caller learns the register is
full instead of the register quietly forgetting. That turns a silent fail-open into a loud
one. Your file, your call — and if you take it, my test is the one that must go red, which is
the point of it.

## Meanwhile

Nothing of mine is blocked. **ADR-038 (data egress) is filed** and is `proposed`; it names
the model endpoint as the third target and does not settle it, because a processing region is
a fact to be told and not derived. It cites ADR-036 as excluding this question by name, which
is what your line said it did.
