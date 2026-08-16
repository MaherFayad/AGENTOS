# ADR-009 — An agent that produces a deliverable must declare a connector that can write one

**Date:** 2026-08-16 · **Author:** `agent-library-curator` · **Status:** accepted
**Affects:** `comms/contracts/frontmatter-schema.md` (invariant 7, new `produces` field) ·
`scripts/validate-frontmatter.mjs` · `packages/contracts/src/frontmatter.ts` ·
all 12 agents in `agents/**` · Phase 0 steps 0.4 and 0.5

## Context

`runner-engineer` filed a blocker
(`comms/inbox/agent-library-curator/20260816-2121-runner-engineer-interview-cannot-write-its-artifact.md`)
against `agents/intelligence/company-interview/SKILL.md`:

```yaml
wired_into: [company-brain, git]      # → ["mcp__company__*", "mcp__git__*"]
```

Neither MCP family is wired in the runner (M9), and — the part that matters — **neither can
write a file**. The runner's universal system prompt (`apps/runner/src/lib/prompt.ts:60`)
tells every agent *"Write your deliverable to `output.md`… anything only in your reply text
is lost"*, and `extractArtifact` (`artifacts.ts:70`) reads that file out of the scratch dir.
With no write tool the chain is: no `output.md` → `extractArtifact` → `null` → no `artifact`
event → `writeBackBrain` → `null` → `company/COMPANY.md` never updated — **and the run
reports `ok`.**

Step 0.4 is the user answering the twenty interview questions. As it stood, that run would
have succeeded, cost money, produced a trace, and changed nothing. A visible failure would
have been strictly better than the honest-looking `ok`.

Checking the other eleven turned a single-agent bug into a systemic one: **12 of 12 agents
have this shape.** Every agent's `## Output` section describes a markdown document; not one
of them declared `workspace`; two (`marketing/brand-voice-guard`,
`marketing/content-repurposer`) had no `wired_into` at all and therefore resolved to *zero*
tools. The validator passed all twelve. **A validator that passes an agent which provably
cannot do its job is the deeper defect**, and it is what this ADR closes.

The constraint that makes the fix non-obvious is BOARD rule 4 / §3.2: the runner's tool
allowlist is **exactly** `wired_into`, never a superset. `runner-engineer` verified that
invariant holds live. So the fix cannot be "give every run a base ability to write."

## Options

| Option | For | Against |
|---|---|---|
| A — a base grant of `Write` under every run | one line in the runner; nobody has to declare anything | It is a superset. After it, "what can this agent touch?" is no longer the `WIRED INTO` list a human read before pressing Run, and the drawer is decoration. Kills BOARD rule 4. |
| B — the runner synthesises the artifact from the transcript when no file exists | no frontmatter change; nothing can silently produce nothing | Makes the deliverable independent of the allowlist, so an agent with no tools appears to have worked. Two artifact paths, one of which is invisible in `wired_into`. Rewards under-declaration. |
| C — a new `deliverable:` field the runner writes on the agent's behalf | explicit | Same as B with more ceremony: it is Option A wearing a frontmatter field. |
| **D — declare `workspace`, and make the validator refuse an agent that cannot write its own deliverable** | uses the connector that already exists and already means exactly this; the grant stays visible in `WIRED INTO`; the defect becomes impossible to reintroduce, in all twelve files and every future import | twelve files change; one new optional frontmatter field to keep the rule honest |

## Decision

**Option D.**

**1. Every agent that produces an artifact declares a connector that grants a file-writing
tool.** In practice that is `workspace` (`Read, Write, Edit, Glob, Grep`, scoped to the
per-run scratch cwd, which is destroyed after extraction). All twelve agents in the library
now declare it. This is the connector the registry already describes for exactly this
purpose — no new grant was invented to unblock anything.

`workspace` grants four tools beyond `Write`. That is not a widening in practice: the
directory is created empty for the run, the agent is the only thing that puts anything in
it, and it stops existing when the run ends. `shell` (`Bash`) stays deliberately separate
and no agent declares it.

**2. The validator refuses an agent that cannot produce its own deliverable.** Not a
warning — an *error*, so the file is excluded from the map. A node rendered with a live
halo that provably cannot deliver anything is exactly the "137 dead agents" failure Part
VII.3 says we are not repeating.

The write capability is **derived from the connector registry**, not hardcoded per
connector name: a connector can write an artifact iff its `tools` include `Write`, `Edit`
or `Bash`. This stays correct when `runner-engineer` adds a connector that grants file
tools, and it needs no field in a file I do not own.

**3. New optional frontmatter field `produces`,** enum `md | json | pdf | txt | none`,
default `md`. `produces: none` is the escape hatch for an agent whose deliverable is
genuinely a side effect — `artifacts.ts` explicitly anticipates one ("a legitimate outcome
for an agent whose job is to post to Slack"). Without an escape hatch the first such agent
gets "fixed" by adding `workspace` to silence the validator, which is precisely the
under-thought widening this ADR exists to prevent. No agent declares it today; the default
keeps all twelve files unchanged in this respect.

**4. The interview's own declaration becomes `wired_into: [workspace]`.** `company-brain`
and `git` are dropped, and this is the part `runner-engineer` may want to argue with, so it
is written down rather than done quietly:

- **`company-brain`** grants `mcp__company__*`, described in the registry as "Read/write
  `company/COMPANY.md` + sources." That is **[ADR-007](ADR-007-brain-write-back.md)'s
  Option 2 — "let the interview agent write `company/` itself, via a connector with real
  filesystem access outside the scratch workspace" — which ADR-007 considered and
  rejected**, because "this moves the decision into a prompt… any capability granted by
  frontmatter is a capability an imported file can grant itself." ADR-007 chose Option 3:
  the runner copies `output.md` out and commits it through `commitCompanyFile`, gated on
  the constant `INTERVIEW_AGENT_SLUG`, **not on a frontmatter field**. So the connector is
  the rejected design, sitting in the registry, declared on the one agent it was rejected
  for. Dropping it changes nothing about the write-back, which does not read `wired_into`.
  Read access is not lost either: §3.3 injects `COMPANY.md` into the system prompt of
  *every* invocation, so the interview reads the brain without a tool.
- **`git`** is a dependency of the *runner's* write-back, not of the agent. ADR-007: "The
  interview agent still writes only into its per-run scratch workspace, exactly like every
  other agent." Declaring `git` here says "this agent may run git commands", which is not
  true today and becomes dangerously true at M9 without anyone revisiting it — on the one
  agent whose output every other agent obeys. The SKILL.md body said "Commit with `git`",
  which contradicted ADR-007; the body is corrected in the same commit.

The approval gate is untouched and is strictly stronger afterwards: `approval: required`
still parks the run at `plan` before a token is spent, and with `company-brain` and `git`
gone there is now **no path at all** by which the agent commits the brain itself. The only
writer is `commitCompanyFile`, behind that gate, with `git revert` as the undo.

**5. Connector availability is a warning, not an error.** A connector may carry optional
`available: false` / `since: "M9"` in `agents/_registry/connectors.json`; the validator
warns per agent that declares one. It is a warning because decision 2 already errors on the
fatal case — an agent whose only connectors are unbuilt MCP families cannot write, and is
excluded on that ground. The registry is `runner-engineer`'s file: the validator reads the
fields defensively and the check is inert until they are added
(`comms/inbox/runner-engineer/20260816-2138-agent-library-curator-connector-availability.md`).

## Consequences

- **Easy:** step 0.5 becomes meaningful. "Run each of the twelve once and promote the ones
  that succeed to `status: live`" now cannot be satisfied by an agent that succeeds at
  producing nothing.
- **Easy:** every future import from `gtmagents/gtm-agents` or `wshobson/agents` is caught
  at CI time rather than at 2am on a run that reports `ok`.
- **Hard:** an agent that genuinely has no artifact must say so with `produces: none`. That
  is the intended friction — it is a sentence in a file, and it makes "this agent produces
  nothing" a claim someone made rather than an accident.
- **Reversing this** means deleting invariant 7 and the `produces` field and re-auditing
  twelve `wired_into` lines by hand. The ADR is the record of why not to.
- **`operations/agent-auditor` is only half fixed.** It can now write `output.md`, but its
  body says it writes `audit/report.md` — a path outside scratch, i.e. a third write root,
  which ADR-007 says "is a decision, not a diff." Filed to `runner-engineer`; not decided
  here.

## Contract edits

`comms/contracts/frontmatter-schema.md` (mine):

1. Canonical example gains `produces: md` and `workspace` in `wired_into`.
2. Field table gains a `produces` row.
3. **New invariant 7** — "An agent with `produces` other than `none` must declare at least
   one connector granting a file-writing tool (`Write`, `Edit` or `Bash`)."
4. Invariant 5's paragraph gains the availability note.

`packages/contracts/src/frontmatter.ts` — `PRODUCES` enum, `produces?: Produces` on
`AgentFrontmatter`, `produces` on the zod schema. `checkContractDrift` compares the new
enum, so the two halves cannot diverge silently.

`agents/_registry/connectors.json` — **not edited.** It is `runner-engineer`'s; decision 5
is a `decision-request`, not a diff.
