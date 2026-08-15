# ADR-007 — The Second Brain write-back is a second, equally narrow write boundary

**Status:** accepted
**Owner:** `runner-engineer`
**Date:** 2026-08-15
**Spec:** §3.3 (Second Brain), §3.2 (run pipeline) · **Amends:** [ADR-002](ADR-002-repo-shape.md)

## Context

ADR-002 fixes the runner's write boundary:

> The runner's git writes (§3.2 schedule commits) touch `agents/` only — a path check in
> the runner enforces that, so a prompt-injected agent cannot commit to `apps/`.

§3.3 then requires something that boundary forbids. The Second Brain is
`company/COMPANY.md`, the interview agent rewrites it, and "git history is brain
versioning" — so the file must be committed by something. `company/` is not under
`agents/`, so as written, either §3.3 is unimplementable or ADR-002 is violated.

Three ways out were on the table:

1. **Widen the check to the repo root.** One line, and it deletes the property ADR-002
   exists for: after it, "what can the runner write?" is answered by "anything", and the
   prompt-injection story is over.
2. **Let the interview agent write `company/` itself**, via a connector with real
   filesystem access outside the scratch workspace. This moves the decision into a prompt.
   A SKILL.md is a file — and Part IV explicitly anticipates importing SKILL.md files from
   outside — so any capability granted by frontmatter is a capability an imported file can
   grant itself.
3. **A second named boundary in the runner**, reachable from one code path.

## Decision

**Option 3.** The runner has exactly two write roots, each with its own assertion, its own
commit function, and exactly one caller:

| Root | Assertion | Commit fn | Reached from |
|---|---|---|---|
| `agents/**` | `assertInsideAgents` | `commitAgentFile` | `setSchedule` (`POST /api/schedule`) |
| `company/**` | `assertInsideCompany` | `commitCompanyFile` | `writeBackBrain`, gated on the agent slug |

There is no general "write a file" or "commit a path" helper exported from the runner.
`commitPath` is private and unreachable except through one of the two checked wrappers.

The brain write-back is gated on the **constant** `INTERVIEW_AGENT_SLUG =
'intelligence/company-interview'`, not on a frontmatter field. The interview agent still
writes only into its per-run scratch workspace, exactly like every other agent; the runner
copies `output.md` out and commits it. And because that agent's frontmatter says
`approval: required`, a human sees the plan before a single token is spent.

## Consequences

- Two doors instead of one, but both are narrow, named and greppable. `grep -r
  commitCompanyFile apps/runner/src` returns the complete answer to "what can rewrite the
  brain?" — one call site.
- A third root is a decision, not a diff. Adding one means editing this table, which means
  writing down why.
- An empty or near-empty interview artifact is refused rather than committed, so a failed
  interview cannot erase the brain *and* enshrine the erasure in its version history.
- `company/sources/*` is read-only to the runner. Adding source material is a human's
  `git add`, which keeps provenance attached to a person.

## Deliberately not done

- **No rollback route.** Reverting the brain is `git revert`, which is the whole point of
  storing it in git. A UI button would be a worse version of a tool that already exists.
- **No merge of an interview against the current file.** The interview agent produces a
  whole COMPANY.md and the runner replaces the file wholesale. Section-level merging is
  `mode: update-section` inside the agent's own prompt, where the model can see both
  texts — doing it in the runner would mean a text-merge heuristic with no understanding
  of the content.
- **`company/sources/` is not writable by the runner**, even though the interview agent
  might reasonably want to file an attachment there. Until there is a real need, one file
  is a smaller boundary than a directory tree.
