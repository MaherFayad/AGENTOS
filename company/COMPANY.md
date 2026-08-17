# COMPANY.md — the second brain

**This file is injected into every runner invocation (§3.3).** Every agent in
`agents/**` reads it before it does anything. That makes it the highest-leverage file in
the repo and the most dangerous: a sentence written loosely here is a sentence twelve
agents will act on loosely, confidently, and at scale.

**How it gets filled:** run `intelligence/company-interview` (the centre node of the
galaxy) — it asks the twenty questions, writes the answers into the sections below, and
commits. Git history is the brain's version history. Do not hand-edit a section that the
interview owns without also telling the interview, or the next run will overwrite you.

**Honesty rule:** every unanswered item stays marked `<!-- UNANSWERED -->`. Do not delete
the marker to make the file look finished, and do not fill a gap with something plausible.
The galaxy's core brightness scales with real completeness (§3.3) — a brain that looks full
and is not is worse than an obviously empty one, because nobody goes back to fix it.

**Completeness:** 0 of 20 answered · every section below is a placeholder.

---

## 1. Identity

What the company does, in the words a customer would use.

<!-- UNANSWERED: Q1 what we do -->
<!-- UNANSWERED: Q2 what we want to sell more of / less of -->
<!-- UNANSWERED: Q3 whose decisions this brain must reflect -->

## 2. Offers

One block per offer: name · one line · what "done" looks like · what is always included ·
what is never included. Agents quote this catalogue rather than describing offers
themselves — `deals/proposal-drafter` will refuse to price anything that is not here.

<!-- UNANSWERED: Q4 offer catalogue -->
<!-- UNANSWERED: Q5 the front door offer and what it leads to -->
<!-- UNANSWERED: Q6 retired offers people still ask for -->

## 3. ICP

Sector · size · geography · maturity · who signs. Then the **exclusion list** — the client
shape we regret — which `sales/database-mining` applies before scoring, not after.

<!-- UNANSWERED: Q7 best client -->
<!-- UNANSWERED: Q8 the client we regret (exclusion list) -->
<!-- UNANSWERED: Q9 what triggers the need this quarter -->

## 4. Pricing

Write the **rule**, not the number: "day rate × estimated days, floor 5 days" survives a
price change; "SAR 40,000" does not. Name the floor and who may go below it.

<!-- UNANSWERED: Q10 pricing rule per offer -->
<!-- UNANSWERED: Q11 the floor and who may go below it -->
<!-- UNANSWERED: Q12 always included / never included -->

## 5. Voice

Register per channel, words we use, words we never use. `marketing/brand-voice-guard`
enforces this section literally — anything not written here is a rule it cannot enforce.

### Arabic and MSA register

MSA or dialect per channel · which terms stay in English · numerals, dates and honorifics ·
who signs off on Arabic that reaches a client. Arabic is written for Arabic, never as a
translation of the English draft.

<!-- UNANSWERED: Q13 writing we admire -->
<!-- UNANSWERED: Q14 words we never use -->
<!-- UNANSWERED: Q15 Arabic register rules -->

## 6. Red lines

Absolute. Not weighted against anything else, not overridable by a good reason in a prompt.

- Sectors, clients and work we will not take: <!-- UNANSWERED: Q16 -->
- What an agent may never do without a human — **send, sign, spend, delete, publish**:
  <!-- UNANSWERED: Q17 -->
- What must never leave our infrastructure: <!-- UNANSWERED: Q18 -->

## 7. Data handling — PDPL constraints

**This block is standing policy, not an interview answer. It binds every run.** The
interview may add to it; nothing may soften it (Part VII.4, §3.5).

1. **Personal data is collected only where a task requires it**, and only in a
   professional capacity: role, employer, public statements. Never personal contact
   details, never inference about individuals, never special-category data.
2. **Traces stay local.** Langfuse and Postgres volumes live on our own infrastructure.
   No US SaaS observability, no third-party trace forwarding, encrypted backups.
3. **Redact at instrumentation, not after.** Names, emails, phone numbers, national IDs and
   payment details are stripped before a trace is written — a redaction step that runs
   later is a leak that already happened.
4. **Client data does not cross clients.** A run for one client may not read another
   client's artefacts, and no agent may aggregate across them without an explicit,
   human-approved task.
5. **Committed artefacts carry no personal data.** `audit/report.md`, agent outputs in git
   and anything posted to Slack name files, slugs and companies — never individuals or
   trace payloads.
6. **Retention:** run artefacts and scratch workspaces are disposable and expire; anything
   that must persist is written deliberately to a named location, not left in a trace.
7. **Right to erasure — what is executable, and what is not.** Corrected 2026-08-18 by
   `rtl-arabic-pdpl-specialist`; this rule previously asserted a working erasure capability,
   which was **false in this build** — the house defect (a declared value read as an observed
   one) sitting in the one file every run inherits. The old sentence is not reproduced here,
   because a false claim quoted inside its own correction is still a sentence a model reads out
   of context. The true position, by tier:
   - **Selectable and executable:** nothing. **No plane in this repo has a delete verb.**
   - **Selectable, not executable:** the *project* (one predicate, one row set) and a named
     *author* (`author = 'human:{identity}'`). A delete verb would discharge these. Deleting
     a project is separately refused while history exists (ADR-015 Q4).
   - **Not selectable at any price:** a third party named only *inside* free text — a message
     body, an agent summary, an artefact filename. **A delete verb does not fix this tier**,
     because erasure requires selection first and prose has nothing to select on. This is the
     tier that matters most in our market, because it is the client's customers.
   The operative consequence, and the reason this is policy rather than a note: **the only
   defence for tier three is not accumulating it.** Minimise at the point of writing, keep
   free text out of every derived plane, and never create a second copy of a body.
8. **Never put a human's message into a trace, a log, or a push payload** — not truncated,
   not summarised, not "just the first line". Reference it by id. A message body is free text
   a person typed; it has no keys to deny and no shape a regex knows, so the redactor is not a
   partial defence there — it is not a defence at all. Enforced by construction where it can
   be (`messageSpanAttributes()` is a type with no `body` field) and backstopped by the `body`
   key on the redaction denylist; still **not** enforced for free text pasted into an error
   string, which is why this line is a rule you follow rather than one a tool applies.
9. **Do not flatten a structured payload before tracing or logging it.** Pass the object.
   Key-based redaction walks object keys and a string has none: as `{client_name, address,
   date_of_birth, salary}` four keys redact; composed into one sentence first, four of five
   leak. Compose prose at the point of display, never before the point of storage.
10. **The model is a processor, and a thread's history goes to it.** A run's prompt carries
   the thread's prior message bodies by design (`lib/prompt.ts` — *"it is going into a model,
   which is the point"*). *"Traces stay local"* is true and is **not** the whole egress story:
   traces and Postgres are ours, the model endpoint is not. **This repo asserts no processing
   region for the model endpoint** — there is no region or base-URL configuration anywhere in
   it — so rule 11's *"if a connector's region is unclear it does not belong in `wired_into`"*
   currently has an exception that is unwritten. Naming it here rather than leaving it in the
   gap between two rules; it is settled in the data-egress ADR, with the human.
11. **Cross-border:** processing and storage stay in-region. An agent may not send client
   data to a tool whose processing location is unknown; if a connector's region is
   unclear, it does not belong in a `wired_into` list. See rule 10 for the one processor
   this rule does not currently bind.
12. **This file is two tiers, and only one of them is global.** Under N projects
   (`Plan §9`–§10) the brain splits: a **global tier — this file, sections 5 and 7 —
   holding facts about *us*, and a **project tier**, `<project>/company/COMPANY.md`,
   holding facts about *that client*. §3.3 injects both into every run of that project;
   the global tier is injected into **every run of every project**, which is precisely why
   nothing client-identifying may ever be written into it. A client name, a client's
   pricing, a client's red line or a client's ICP in the global tier is a breach of rule 4
   on every subsequent invocation for every other client, with no code defect required.
   The global tier answers *who is writing*; the project tier answers *who it is for*.
   Sections 1–4, 6, 8 and 9 of this file are **project-tier by default**; sections 5
   (Voice) and 7 (this block) are global.

Tool-level consequence: `wired_into` is the runner's allowlist (§3.2). A connector that
processes client data outside the region is not a configuration question — it is a red
line, and the fix is removing the name from the frontmatter.

Write-path consequence of rule 12, because a rule that names no enforcer enforces nothing:
the interview's write-back (`apps/runner/src/lib/brain.ts`, ADR-007) is gated on an agent
**slug** and confined to one **configured** company directory. Under a cascade every
project has its own `intelligence/company-interview`, and both halves of that gate are
project-blind — `agentSlug !== INTERVIEW_AGENT_SLUG` compares a `department/slug` that is
identical in every project, and `config.companyFile` is one path. Project two's interview
therefore overwrites project one's brain, and the git commit that follows records the
overwrite as the brain's new history. The gate must key on the **`agent_ref`**
(`{project}/{department}/{slug}`, ADR-014 §2) and write through the **mounted project's**
`companyFile`, and a write to the global tier must be refused outright — the interview is
a client-facing agent and the global tier is not its to edit.

## 8. Operations

Systems of record for deals, delivery, money and content — the names agents should trust
when two sources disagree.

<!-- UNANSWERED: Q19 systems of record -->
<!-- UNANSWERED: Q20 what breaks most often and what it costs -->

## 9. Sources

Documents agents may cite live in `company/sources/`. One line each: what it is, when it
was last true, and whether an agent may quote it to a client.

<!-- UNANSWERED: no sources added yet -->
