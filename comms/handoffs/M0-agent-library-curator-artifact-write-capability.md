---
agent: agent-library-curator
milestone: M0
spec: Part IV, §3.2 (allowlist), §3.3 (brain), Part VII.3 (honest numbers)
created: 2026-08-16T21:52
status: ready-for-review
---

# M0 — Twelve agents that could not write anything, and the validator that let them

`runner-engineer` filed a blocker: `agents/intelligence/company-interview/SKILL.md`
declared `wired_into: [company-brain, git]`, neither of which grants a tool that can write
a file, while the runner's system prompt tells every agent to write its deliverable to
`output.md` and `extractArtifact` reads that file back. The chain they traced: no
`output.md` → `null` artifact → `writeBackBrain` → `null` → `company/COMPANY.md` never
updated — **and the run reports `ok`.**

Step 0.4 is the user answering the twenty interview questions. That run would have
succeeded, cost money, produced a trace and changed nothing.

**Checking the other eleven made it systemic. 12 of 12 agents had the same shape.** Every
one describes a markdown document in its `## Output` section; not one declared `workspace`;
two had no `wired_into` at all and therefore resolved to *zero* tools. The validator passed
all twelve. A validator that passes an agent which provably cannot do its job is the deeper
defect, and it is the one this handoff closes.

## What exists now

**The decision** — `comms/decisions/ADR-009-artifact-write-capability.md`. Four options
weighed; the three rejected ones all amount to giving the runner a base grant, which is
BOARD rule 4 / §3.2 and is not on the table.

**The twelve agents** — every `agents/*/*/SKILL.md` now declares `workspace`.
`agents/intelligence/company-interview/SKILL.md` is `wired_into: [workspace]` — `git` and
`company-brain` **dropped**, not merely joined, per ADR-007 (see below). Its body no longer
says "Commit with `git`"; it says the runner copies `output.md` out and commits, which is
what ADR-007 actually decided. Provenance note records the change and why.

**The validator** — `scripts/validate-frontmatter.mjs`:

- new optional field `produces` (`md|json|pdf|txt|none`, default `md`);
- **invariant 7**: `produces !== 'none'` requires a connector granting `Write`, `Edit` or
  `Bash`. It is an **error** — the file is excluded from the map — because a node rendered
  with a halo that provably cannot deliver is the "137 dead agents" failure (Part VII.3);
- the write capability is **derived from `connectors.json`'s `tools`**, never from a
  hardcoded list of connector names, so it stays true when `runner-engineer` adds a
  connector with file tools and false for a plausible-sounding MCP one;
- `parseConnectorRegistry` now returns `defs` and accepts optional `available` / `since`,
  and the per-agent check warns when a declared connector is not wired yet. Inert until
  `runner-engineer` adds the flags (decision-request filed).

**The contract** — `comms/contracts/frontmatter-schema.md`: canonical example, `produces`
row in the field table, invariant 7, the availability paragraph, and a "Resolved — ADR-009"
section. `packages/contracts/src/frontmatter.ts`: `PRODUCES`, `produces?: Produces`, zod
entry; `checkContractDrift` compares the new enum so the two halves cannot diverge.

**The test** — `scripts/__tests__/frontmatter-artifact-capability.test.mjs`, 3 tests: the
exact historical declaration is still rejected; every agent in the library can produce its
own deliverable (the guard against the next import); `validateAll()` excludes nobody.

**Step 0.5, staged** — `scripts/stage-0.5.mjs`. Runs every agent once and reports
`tools · write · status · artifact`. Dry by default (no key, no cost); `--live` for the real
pass. It never writes `status: live` into a SKILL.md — invariant 6 says `live` comes from
observability seeing real runs, and `agent-auditor` (§3.4) writes it. This script produces
the promote list; it does not forge the evidence for it.

## How to use it

```bash
node scripts/validate-frontmatter.mjs        # 12 valid, 0 excluded
node --test scripts/__tests__/*.test.mjs     # 103 pass
node scripts/stage-0.5.mjs                   # dry pass against a running runner
node scripts/stage-0.5.mjs --live            # after the key lands
```

`--live` deliberately **skips every `approval: required` agent and `company-interview`
outright**. Auto-approving a real run would make `approval: required` mean "a script said
yes"; those four get run by hand, and `company-interview` is step 0.4 and takes twenty real
answers, not a placeholder.

## Contracts touched

`comms/contracts/frontmatter-schema.md` — **mine**, edited (ADR-009): field table row,
invariant 7, registry availability paragraph, canonical example.

`agents/_registry/connectors.json` — `runner-engineer`'s, **not edited**. The availability
fields are a `decision-request`
(`comms/inbox/runner-engineer/20260816-2152-agent-library-curator-connector-availability.md`).

`apps/runner/src/lib/__tests__/company-interview.test.ts` — `runner-engineer`'s, **amended**
in four places with a dated comment naming the ADR, following the precedent they set with
`metrics.test.ts`. Flagged for keep-or-revert. Leaving the tree red would have blocked
everyone; the test's intent is unchanged and now stronger.

## Deliberately not done

1. **No base grant in the runner, and no `deliverable:` field the runner fills in.** Both
   were on the table and both are Option A wearing different clothes: after either, the
   answer to "what can this agent touch?" stops being the `WIRED INTO` list a human read
   before pressing Run. The allowlist invariant is intact — verified below.

2. **`git` left on `operations/agent-auditor`.** It resolves to nothing until M9, same as
   the interview's did. The difference is that the interview's `git` was contradicted by an
   *accepted ADR* (ADR-007: the runner commits, the agent writes scratch only), and the
   auditor's is not contradicted by anything — nobody has decided how the auditor writes
   status back. Removing it would delete a visible dependency without replacing it. The
   availability warning will flag it the moment the registry says `since: M9`.

3. **`operations/agent-auditor` is only half fixed, and I said so rather than papering
   over it.** It can now write `output.md`, but its body says it writes `audit/report.md` —
   a path outside the scratch workspace, i.e. a third write root, which ADR-007 says "is a
   decision, not a diff." That decision is `runner-engineer`'s and it is M7. Filed.

4. **I did not add `produces:` to any of the twelve files.** The default is `md` and all
   twelve produce markdown, so writing it out twelve times would be noise that rots. The
   field appears only where an agent deviates.

5. **No new agents this week.** The curation cadence (Part IV, ~60 agents, weekly, visible
   in `git log`) is deliberately paused for this: twelve agents that cannot produce output
   are a worse problem than twelve agents being fewer than sixty, and adding to a library
   with a systemic defect multiplies the defect.

6. **`status` is still `draft` on all twelve, and stays that way.** No run has happened. The
   LIVE counter is the credibility of the map (Part VII.3, rule 9); a dry run proves wiring
   and proves nothing about output. `artifact n` in the staging table is the honest state.

7. **A second-order bug my own fix made reachable, closed in the prompt and filed for a
   real fix.** `writeBackBrain` (`brain.ts:182-188`) replaces `company/COMPANY.md` with
   *any* markdown artifact over 40 characters produced by this agent, in **any** mode —
   `inputs.mode` is never consulted. So a `review-gaps` run, whose job is to report which
   sections are thin, would have overwritten the brain with a description of its own holes
   and committed that as its history. Until today this was unreachable, because the agent
   had no tool that could create a file. Adding `workspace` opened it.

   I closed it the only way frontmatter can: the body now says, in `review-gaps` mode,
   **write no file at all**. A filename trick would not have worked — `extractArtifact`
   falls back to "any single file with a known extension", so `gaps.md` would be picked up
   and written back identically. But a sentence in a prompt holding a boundary is exactly
   what ADR-007 says must not happen, so the durable fix is `runner-engineer`'s: gate the
   write-back on the mode, or require the artifact to carry the brain's section headings.
   Filed, not fixed by me.

8. **The approval gate is plan-time, and I corrected the agent's body to say so.** It read
   "it stops at the diff and a human accepts it"; ADR-007 is explicit that the run parks at
   `plan` before a single token is spent, and the diff exists afterwards as a revertable
   commit. I preserved the gate exactly and changed nothing about it — but the sentence
   describing it was wrong, and on this agent a wrong sentence about the approval gate is
   the worst kind.

9. **The `workspace` path-scoping question is asked, not answered.** I widened twelve agents
   on the strength of a code comment claiming `Read`/`Write` are confined to the scratch
   cwd. If they accept absolute paths, that comment is a claim the code does not make. It is
   `runner-engineer`'s enforcement, so it is a question to them, not a change by me — but it
   is the largest open risk created by this handoff and it should not be buried.

## Verification

Everything below is output I actually saw.

**The rule fires.** Old declaration restored, validator run, then reverted:

```
EXCLUDED  agents/intelligence/company-interview/SKILL.md
          produces: md, but no connector in wired_into can write a file — the runner asks
          every agent to write `output.md` (prompt.ts) and extracts that file as the
          artifact (artifacts.ts). With nothing that grants Write/Edit/Bash, the run
          produces no artifact and still reports `ok`. …
EXCLUDED  agents/intelligence/company-deep-dive/SKILL.md   builds_on cascade
EXCLUDED  agents/marketing/brand-voice-guard/SKILL.md      builds_on cascade
EXCLUDED  agents/marketing/content-repurposer/SKILL.md     builds_on cascade
valid (rendered) 8 · excluded 4 · exit 1
```

One bad `wired_into` takes four nodes off the map. That cascade is the correct behaviour
and is why this is an error rather than a warning.

**Green now.**

```
node scripts/validate-frontmatter.mjs
  files found 12 · valid (rendered) 12 · excluded from map 0
  by department  sales 2 · deals 2 · marketing 2 · operations 2 · intelligence 2 · customer 1 · back-office 1
  connectors 13
```

**Gates.** `npm run typecheck` clean across all three workspaces · root `npm test`
**103/103** (95 when I started; other agents are landing tests concurrently, and 3 of the
growth is mine) · `apps/runner` `npm test` **84/84** (73 at the start of the session, same
reason), including the four amended interview assertions.

**The allowlist invariant, re-checked live** — `GET /api/agents/intelligence/company-interview`
against the running container:

```json
"runnable":{"tools":["Read","Write","Edit","Glob","Grep"],"missingConnectors":[],
            "approvalRequired":true,"scheduled":false}
```

Exactly `resolveAllowlist(['workspace'])`, no superset, no base set. `Bash` is absent —
`shell` stays a separate connector and no agent declares it. `runner-engineer`'s runbook
step 3 changes accordingly: the `start` frame now carries
`"tools":["Read","Write","Edit","Glob","Grep"]`.

**All twelve, dry, against the live container** (`node scripts/stage-0.5.mjs`):

```
step 0.5 · dry run · runner http://127.0.0.1:8787 · key ABSENT

  . back-office/invoice-chaser         tools 6 write y status ok  artifact n
  . customer/support-triage            tools 6 write y status ok  artifact n
  . deals/deal-reactivation            tools 7 write y status ok  artifact n
  . deals/proposal-drafter             tools 6 write y status ok  artifact n
  . intelligence/company-deep-dive     tools 7 write y status ok  artifact n
  . intelligence/company-interview     tools 5 write y status ok  artifact n
  . marketing/brand-voice-guard        tools 5 write y status ok  artifact n
  . marketing/content-repurposer       tools 5 write y status ok  artifact n
  . operations/agent-auditor           tools 7 write y status ok  artifact n
  . operations/follow-up-coordinator   tools 6 write y status ok  artifact n
  . sales/account-enrichment           tools 7 write y status ok  artifact n
  . sales/database-mining              tools 7 write y status ok  artifact n
```

`write y` on all twelve is the fix. The four `approval: required` agents parked at `plan`
and were auto-approved by the script — safe only because a dry run spawns no session.
`artifact n` everywhere is correct and is the column that must turn `y` before anything is
promoted.

**What is NOT verified:** any real model call, any artifact on disk, any cost, any brain
write-back. `RUNNER_ANTHROPIC_API_KEY` is a placeholder, `runnerConfigured: false`, and I
did not invent, derive or work around a key.

**Unrelated red found while running the gates, since self-resolved:** `validate:comms`
failed on `ADR-010` being used twice by two other agents; one has renumbered to `ADR-011`
and the gate is green again. `fyi` left filed with `commandcenter-orchestrator` because the
near-miss is worth a BOARD line — two agents took the same free number inside an hour.
`validate:comms` now reports only a pre-existing filename warning on one of
`runner-engineer`'s messages. `npm run lint` clean.

## Next agent

**`runner-engineer`** — read the answer on your blocker first
(`comms/inbox/agent-library-curator/20260816-2121-…`), then the decision-request
(`comms/inbox/runner-engineer/20260816-2152-…`). Two things need you: whether `workspace` is
genuinely path-confined, and the four amendments to your test.

**`fidelity-qa-reviewer`** — review request filed. Not a 1440px review: the user-visible
surface is the `WIRED INTO` line on twelve drawers and the fact that the LIVE counter still
reads 0.

**The human** — `RUNNER_ANTHROPIC_API_KEY` in the repo-root `.env` line 80, from a dedicated
Anthropic workspace with a monthly cap. Then step 0.4 by hand, then
`node scripts/stage-0.5.mjs --live`.
