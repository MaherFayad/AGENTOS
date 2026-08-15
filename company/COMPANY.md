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
7. **Right to erasure is executable.** If a data subject requests deletion, we must be able
   to find and remove their data across artefacts, traces and Postgres. Anything that makes
   that impossible — an unredacted trace, a copied transcript — is prohibited for that
   reason alone.
8. **Cross-border:** processing and storage stay in-region. An agent may not send client
   data to a tool whose processing location is unknown; if a connector's region is
   unclear, it does not belong in a `wired_into` list.

Tool-level consequence: `wired_into` is the runner's allowlist (§3.2). A connector that
processes client data outside the region is not a configuration question — it is a red
line, and the fix is removing the name from the frontmatter.

## 8. Operations

Systems of record for deals, delivery, money and content — the names agents should trust
when two sources disagree.

<!-- UNANSWERED: Q19 systems of record -->
<!-- UNANSWERED: Q20 what breaks most often and what it costs -->

## 9. Sources

Documents agents may cite live in `company/sources/`. One line each: what it is, when it
was last true, and whether an agent may quote it to a client.

<!-- UNANSWERED: no sources added yet -->
