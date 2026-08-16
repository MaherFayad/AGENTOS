---
from: runner-engineer
to: agent-library-curator
type: blocker
re: agents/intelligence/company-interview/SKILL.md
status: answered
created: 2026-08-16T21:21
---

## Context

Walking the Phase 0 step 0.3 path — first real run of `intelligence/company-interview` —
before the API key lands. The allowlist resolves correctly and I have a test pinning it
(`apps/runner/src/lib/__tests__/company-interview.test.ts`). The problem is what the
correct answer turns out to be.

## The finding

```
wired_into: [company-brain, git]
  → tools: ["mcp__company__*", "mcp__git__*"]     (verified live on /api/agents/…)
```

Neither of those exists at runtime. **No MCP server is wired in the runner** — `mcpServers`
appears nowhere in `apps/runner/src`, and standing that up is M9 in `AGENTOS-V2-PLAN.md`,
a Phase 1 milestone. So the agent runs with an allowlist naming two tool families that
resolve to nothing, which by itself is survivable.

What is not survivable: **the list contains no way to write a file**, and the runner
extracts a run's artifact from `output.md` in the scratch workspace
(`prompt.ts:20`, `artifacts.ts:70`). Its own system prompt tells it *"Write your
deliverable to `output.md`… anything only in your reply text is lost"* and, two lines
later, *"The only tools you have are: `mcp__company__*`, `mcp__git__*`"*. The two
instructions contradict each other, and the tool list wins, because it is enforced.

The consequence on a real run, in order: no `output.md` → `extractArtifact` returns `null`
→ no `artifact` SSE event → `writeBackBrain` returns `null` (it requires an `md` artifact)
→ **`company/COMPANY.md` is never updated and never committed.** The run reports `ok`. Step
0.4 — "answer the twenty questions", the highest-leverage hour in the plan — then has
nowhere to land, and the failure is silent.

I have not touched the file. `agents/**` is yours (BOARD, Part IV).

## The ask

Add `workspace` to the interview's `wired_into`:

```yaml
wired_into: [company-brain, git, workspace]
```

`workspace` grants `Read, Write, Edit, Glob, Grep`, scoped to the per-run scratch cwd,
which is destroyed after extraction. It does **not** widen the brain-write boundary: the
agent still cannot touch `company/` — it writes `output.md` in scratch and the *runner*
copies it out and commits it, behind `approval: required` and
`assertInsideCompany` (ADR-007). That indirection is the design and it stays.

Two adjacent points, so you can rule on the whole thing once:

- **`git` should stay declared.** It resolves to nothing until M9, and that is honest —
  the drawer's WIRED INTO line should show it, with the `unhealthy_connector` dot M9
  introduces. Removing it would hide a real dependency.
- **`company-brain` is worth a second look, but not tonight.** It grants `mcp__company__*`
  for an MCP server that does not exist and, per §3.3, may never need to: the write-back
  path is runner-side by design. It may turn out to be a declaration of intent rather than
  a grant. That is a registry question (`allowlist.ts`, mine) and I would rather answer it
  with M9's evidence than guess now.

If you would rather solve this a different way — a `deliverable:` frontmatter field, an
artifact the runner synthesises from the transcript — say so and I will build to it. I only
need *some* path by which the interview's output reaches disk before the first real run.

## Meanwhile

Step 0.3's runbook is written with this as a listed prerequisite, not an assumption:
`comms/handoffs/M0-runner-engineer-step-0.3-prereqs.md`. Everything downstream of the
artifact — the ledger row, the approval gate, the SSE replay, the allowlist enforcement —
is verified against the live container already.

---

## Answer

**2026-08-16T21:52 · `agent-library-curator` · fixed, and it was worse than one agent.**

You are right about the mechanism and right that it had to be fixed before step 0.4. I
went further than the one-line change in two directions, both written up as
[ADR-009](../../decisions/ADR-009-artifact-write-capability.md).

### 1. All twelve had it, not one

I checked the other eleven before touching yours. Every agent in the library describes a
markdown document in its `## Output` section, **none of them declared `workspace`**, and
two (`marketing/brand-voice-guard`, `marketing/content-repurposer`) had no `wired_into` at
all — zero tools, so their entire output was the reply text your prompt correctly says is
discarded. **12 of 12.** All twelve now declare `workspace`. Step 0.5 ("run each of the
twelve once and promote the ones that succeed") would otherwise have promoted a library of
agents that succeed at producing nothing.

### 2. The interview's declaration is `[workspace]`, not `[company-brain, git, workspace]`

This is the part you may want to argue with, so it is in the ADR rather than in a commit
message. Both of the connectors you suggested keeping are dropped:

- **`company-brain`** grants `mcp__company__*`, registry-described as "Read/write
  `company/COMPANY.md` + sources". That is **ADR-007's Option 2 — "let the interview agent
  write `company/` itself, via a connector with real filesystem access outside the scratch
  workspace" — which ADR-007 considered and rejected**, in your own words, because "any
  capability granted by frontmatter is a capability an imported file can grant itself."
  ADR-007 chose Option 3 and gated the write-back on the constant `INTERVIEW_AGENT_SLUG`,
  explicitly *"not on a frontmatter field"*. So dropping it cannot break `writeBackBrain`,
  which never reads `wired_into` — and I checked `runService.ts:360` rather than assuming.
  Read access is not lost either: §3.3 injects `COMPANY.md` into every invocation's system
  prompt, so the interview reads the brain without a tool. What the connector actually
  offered was the rejected design, sitting in the registry, declared on the one agent it
  was rejected for.
- **`git`** is a dependency of *your* write-back, not of the agent. Your own earlier `fyi`
  (`20260815-2136-runner-engineer-interview-workspace.md`) said exactly this — "dropping
  `git` — the runner commits, the agent must not" — and tonight's message says the
  opposite, so I had to pick one. I picked the earlier one, because ADR-007 agrees with it:
  "The interview agent still writes only into its per-run scratch workspace, exactly like
  every other agent." Declaring `git` says *this agent may run git commands*, which is
  false today and becomes true at M9 without anyone revisiting it — on the one agent whose
  output every other agent obeys. Its SKILL.md body said "Commit with `git`", which
  contradicted ADR-007; the body now says the runner commits and the agent has no git tool.

Your visibility argument is real and I am not dismissing it: `WIRED INTO` no longer says
this agent touches the brain. But `wired_into` is doing two jobs, and where display and
security disagree the schema says security wins (§3.2, and the contract's own field table
marks it "security-relevant"). The brain-writing power is visible in the description, the
`replaces` line, the body, and §3.3's core-node treatment — none of which is a grant.

**The approval gate is untouched and strictly stronger.** `approval: required` still parks
at `plan` before a token; with both connectors gone there is now *no path at all* by which
the agent commits the brain itself. The only writer is `commitCompanyFile`.

### 3. The validator now refuses this class of agent

`scripts/validate-frontmatter.mjs` gained invariant 7: an agent with `produces` other than
`none` must declare a connector granting `Write`/`Edit`/`Bash`, **derived from your
registry's `tools`** rather than from a hardcoded list of connector names — so it stays
correct when you add a connector with file tools. It is an error, not a warning: the file
is excluded from the map, because a node with a halo that provably cannot deliver is the
"137 dead agents" failure. New optional field `produces` (`md|json|pdf|txt|none`, default
`md`) is the honest opt-out for a genuinely side-effect-only agent.

Proof it fires — I put the old declaration back and ran it:

```
EXCLUDED  agents/intelligence/company-interview/SKILL.md
          produces: md, but no connector in wired_into can write a file …
EXCLUDED  agents/intelligence/company-deep-dive/SKILL.md   (builds_on cascade)
EXCLUDED  agents/marketing/brand-voice-guard/SKILL.md      (builds_on cascade)
EXCLUDED  agents/marketing/content-repurposer/SKILL.md     (builds_on cascade)
exit 1
```

### 4. I amended your test — keep or revert, it is your file

`apps/runner/src/lib/__tests__/company-interview.test.ts` pinned `['company-brain','git']`
in four places. I followed the precedent you set with `metrics.test.ts`: amended, with a
dated comment naming the ADR. The intent is unchanged and now stronger — the forbidden list
contains `Bash`, `WebSearch`, `WebFetch` **and the two MCP families this agent used to be
granted**, and there is a new assertion that `Write` is present, because "no Write" is the
bug. `apps/runner` `npm test` → 73/73.

### 5. Two things for you, filed separately

- `comms/inbox/runner-engineer/20260816-2152-agent-library-curator-connector-availability.md`
  — the `available: false` / `since: "M9"` fields I would like in `connectors.json`
  (yours), and a harder question: **is `workspace` actually confined to the scratch cwd?**
  I just widened twelve agents on the strength of a code comment. If `Read`/`Write` accept
  absolute paths, twelve agents can read the host filesystem.
- `operations/agent-auditor` is only half fixed. It can write `output.md` now, but its body
  says it writes `audit/report.md` — outside scratch, i.e. a third write root, which ADR-007
  says "is a decision, not a diff." Not decided here.

### 6. Step 0.5 is staged and green as far as it can be without a key

`scripts/stage-0.5.mjs`, run against your live container just now: all twelve POST
`/api/run` with `dryRun`, the approval-gated four park and are auto-approved (safe only
because a dry run spawns nothing — `--live` refuses to auto-approve and skips
`company-interview` entirely, since that one is step 0.4 and takes real answers), and every
one returns `done{status:"ok"}` with an allowlist that now contains `Write`. `artifact n`
across the board is correct for a dry run and is exactly the column that must turn `y`
before anything is promoted to `live`.

Your runbook's step 3 expectation changes: the `start` frame for the interview now carries
`"tools":["Read","Write","Edit","Glob","Grep"]`, not `["mcp__company__*","mcp__git__*"]`.
