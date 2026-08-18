# ADR-038 — Data egress: the three ways client words leave the tailnet, and what may be sent

**Date:** 2026-08-18 · **Author:** rtl-arabic-pdpl-specialist · **Status:** proposed
**Affects:** `company/COMPANY.md` rules 10–11 · `contracts/agent-frontmatter.md` (`deliver:`) ·
`0007_projects.sql` `library_remote_needs_egress_adr` · `apps/runner/src/lib/prompt.ts` ·
ADR-036 (which excludes this question by name)

## Context

Rule 7 of this repo is *"traces and Postgres volumes stay local, PII redacted at
instrumentation"*, and it is true. It is also **an answer about one plane**, and it has been
doing the work of an answer about all of them. This ADR is where that stops.

Three paths carry client words off the tailnet. The first two were known and blocked; the
third was found on 2026-08-18 and is larger than both.

**(a) `deliver:` — Slack and email.** Six agent SKILL.md files already declare one
(`{slack: "#sales-ops"}`, `{slack: "#delivery", email: "ops@agnetos.internal"}`).
`validate-frontmatter.mjs` accepts exactly `slack` and `email` and validates the shape; it
does not, and cannot, say what may be *in* the message. Nothing delivers today — zero runs
have executed — so this is a decision taken before the first send rather than after it.

**(b) `library_remote` — fetching agent definitions from outside.** Already refused in the
schema: `0007` carries `CONSTRAINT library_remote_needs_egress_adr CHECK (library_remote IS
NULL)`. That constraint names this ADR and is waiting for it. This is the one path where an
enforcer already exists and only the ruling is missing.

**(c) The model endpoint — and this is the one that changes the shape of the question.**
`apps/runner/src/lib/prompt.ts` renders a thread's history into the user turn:

```ts
...history.map((turn) => `- ${turn.author} (${turn.kind}): ${turn.body}`),
```

Verbatim bodies. That is correct and it is the point — an agent that cannot see the
conversation cannot continue it. But `ops.message.body` is the highest-PII value in this
product (§7.1, ADR-036 tier 3), and **this repo asserts no processing region for that
endpoint**: there is no region setting, no base-URL configuration and no data-residency claim
anywhere in it. So the largest, most sensitive and most continuous egress path in the system
is the one with the least written about it, and COMPANY.md rule 11 — *"if a connector's
region is unclear, it does not belong in `wired_into`"* — currently has an unwritten
exception, because the model is not in anyone's `wired_into` and every run uses it.

**The constraint that makes the obvious option not obvious.** The obvious option is to write
the rule an agent must follow. This repo's standing finding says that is worth very little:
*a comment is not a mechanism*, and `workspace` confinement was a docstring until a run
overwrote `.env`. But (c) genuinely cannot be mechanised away — refusing to send the history
is refusing to have the product. So (c) is not a rule an agent follows and not a gate a
checker runs; it is **a contract with a processor**, and contracts are the human's to sign.

## Options

| Option | For | Against |
|---|---|---|
| **A — One rule: nothing leaves the tailnet** | Trivially safe, trivially checkable | Deletes (c), i.e. deletes the product. Also makes the rule obviously unfollowable, which is how rules get ignored where they *were* followable |
| **B — Rule (a) and (b) here; leave (c) to a future ADR** | Ships the two answerable halves now | This is what has already happened twice, and it is why (c) went a whole milestone with no owner. A question with no ADR is a question with no owner, and (c) is the one where that costs most |
| **C — One ADR, three targets, with (a) and (b) DECIDED and (c) stated as a question carrying the human's name** *(chosen)* | Each of the three gets exactly the treatment its evidence supports. (a) and (b) are ours to rule on; (c) is a processing agreement and a residency fact, neither of which an agent may invent | Ships with one open item that cannot be closed by anyone in this repo — which is the correct discomfort, and is the same shape ADR-036 chose for retention |
| **D — Assert a region for the model endpoint from the SDK's documented behaviour** | The gap closes today and the paperwork reads complete | **Refused outright.** It would be the house defect on the highest-stakes line in the product: a declared value read as an observed one. This repo has no observation of where that endpoint processes, and inventing one is indistinguishable from the `"tailscale": "online"` on a host with none |

## Decision

**We rule on (a) and (b) now, and we file (c) as the human's question with its consequences
named rather than closing it.**

**(a) `deliver:`** — a `deliver:` target outside the tailnet may carry **only what
COMPANY.md rule 5 already permits a committed artefact to carry**: file names, slugs,
companies, counts and links back to the tailnet. It may **never** carry a message body, an
agent summary of a message, a transcript excerpt, an individual's name, or a trace payload —
not truncated, not "just the first line". The §9.3 ruling refuses truncation by name and it
governs here for the same reason: forty characters of a sentence a person typed is forty
characters of a sentence a person typed. A delivery that would be useless under this rule is
a delivery that should be a **link**, and the link is inside the tailnet.

**(b) `library_remote`** — stays `NULL`, and its constraint stays. Fetching an agent
definition from a remote library is an **inbound** fetch that carries our project slug and
our fetch pattern outbound, and neither is worth the loss of the property that this system
has no outbound dependency to be offline against. It is unblocked by a named, self-hosted
mirror inside the tailnet — not by a public registry.

**(c) The model endpoint** — this ADR **does not settle it** and no agent in this repo may.
What it settles is the record: the path exists, it is continuous, it carries verbatim client
words, and this repo asserts no processing region for it. Two things are needed from the
human and neither can be derived: whether a data-processing agreement exists for the account
the runner's key belongs to, and what processing region it names. Until both are written
down, **the correct sentence in front of a client is not *"our data stays local"***; it is
*"our observability and storage are self-hosted in-region; model inference is a third-party
processor and its region is not yet asserted."*

## Consequences

**Easy.** `deliver:` can be built, because its content rule now exists before its first send
rather than after. `library_remote` has a ruling to point at instead of a constraint whose
comment names an ADR that did not exist.

**Hard, deliberately.** Every `deliver:` payload now has to be composed of references. That
is the same minimisation ADR-036 made load-bearing for tier 3, arriving at a second surface,
and it will feel like a restriction on usefulness because it is one.

**Open, and it carries the human's name.** (c). It is on BOARD and in COMPANY.md rule 10.
The failure mode if it stays open silently is not a leak — the path is not secret and the
words are already flowing. It is a **claim**: an agent, or a person quoting one, telling a
client that our data stays local, on the strength of a rule that answers for the
observability plane. That sentence is the deliverable of leaving this open, and it is why
rule 10 says so in the file every run inherits.

**If we reverse this later**, (a) is the expensive half: a `deliver:` that has been sending
bodies for a month cannot be un-sent from a Slack workspace, and Slack is a US processor.
Which is the argument for ruling on it now, at zero sends.

## Contract edits

- `company/COMPANY.md` — rule 10 already states the model is a processor and that no
  processing region is asserted; it now cites this ADR as where that is settled. Rule 11's
  exception is named rather than left in the gap between two rules. **No softening**: the
  block is standing policy and this ADR only narrows it.
- `contracts/agent-frontmatter.md` — `deliver:` gains the content rule above. Owner is
  `agent-library-curator`; filed to them as a `decision-request`, not edited here.
- `0007_projects.sql` — no edit. `library_remote_needs_egress_adr` stays exactly as written;
  this ADR is the document its name was waiting for.
- `apps/runner/src/lib/prompt.ts` — no edit. It is correct; what was missing was the record
  of what it means.
