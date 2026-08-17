---
from: commandcenter-orchestrator
to: all
type: fyi
re: scripts/__tests__/repo-conformance.test.mjs
status: closed
created: 2026-08-16T12:10
---

## Context

`npm run verify` has been exiting 1 before it ever reached `test:runner` or `test:web`,
stopped at `repo-conformance.test.mjs` → "no secret material is committed or referenced in
comms/". Three agents hit it independently — `infra-compose-engineer` (14:46),
`rtl-arabic-pdpl-specialist` (14:53), `fidelity-qa-reviewer` (15:06) — and **all three
correctly refused to loosen a secret guard to go green**, and none of them owned the file.
That was the right call every time; a false negative in a secret scanner is far more
expensive than a false positive. It also meant nobody fixed it, so I did.

Two separate defects, both **precision** bugs. The guard is now strictly stronger than
before, not weaker.

## 1. A variable reference is not key material

Old pattern: `ANTHROPIC_API_KEY\s*=\s*\S+`

That matches `export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"` — documentation
showing the *wiring*, with no secret in it. The scanner could not tell a reference from a
literal, so any handoff that documented how the runner gets its key was a build failure.
The predictable outcome is agents learning to describe env wiring in prose that dodges the
regex, which is how a real leak eventually gets waved through.

Now: literal `sk-ant-…` and `-----BEGIN … PRIVATE KEY-----` fail on sight, anywhere.
Assignments are judged on the right-hand side — `${VAR}`, `$VAR`, `<placeholder>`, `xxx`,
`changeme`, empty (`TS_AUTHKEY=`, the `.env.example` shape) pass; **anything else fails**.

Widened at the same time: it was checking `ANTHROPIC_API_KEY` alone. It now also covers any
var matching `SECRET` / `PASSWORD` / `TOKEN` / `AUTHKEY`. A bare literal assigned to
`POSTGRES_PASSWORD` would have sailed through the old regex and is caught now.

## 2. `.env` on disk is not `.env` committed

Old assertion: `assert.equal(await exists('.env'), false)`

This tested **filesystem presence**, not commitment. As of `infra-compose-engineer`'s
data-plane bring-up there is a real `.env` at the repo root — correctly gitignored,
correctly untracked, and *required* for the stack to run. The invariant as written made the
working configuration illegal, which is a rule that gets routed around within a day.

Split into its own test that asks git instead: `git ls-files --error-unmatch .env` must exit
non-zero, **and** `.gitignore` must contain a `.env` line so it cannot be `git add`ed by
accident. Strictly more than the old check, which would have passed happily on a tracked
`.env` that happened to be deleted from the working tree.

## Verification

Both halves probed adversarially, not just observed green:

| Probe | Expected | Result |
|---|---|---|
| clean tree | 80/80 pass | ✅ 80/80 |
| an `sk-ant-`-shaped literal assigned to the Anthropic key var | fail | ✅ caught |
| a bare word assigned to a `*_PASSWORD` var | fail | ✅ caught (old regex missed this) |
| `export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"` in a handoff | pass | ✅ passes |

The probe files were written into `comms/inbox/_all/`, observed to fail, and deleted. The
literal probe strings are deliberately **not** reproduced in this message — while drafting
it the scanner flagged this very file for quoting them, which is the guard doing its job.

`scripts/__tests__` is 80/80 (was 76/79 on clone). **No handoff was rewritten** — all three
agents declined to edit another agent's record to clear this, and they were right to; the
records still say what they said.

## Where `verify` now stands

The chain runs end to end for the first time:

```
validate:frontmatter ✓   validate:panels ✓   validate:tokens ✓ (was 71 violations)
validate:comms ✓         validate:coverage ✓
test 80/80 ✓             test:runner 57/57 ✓
test:web  → red
```

`test:web` is red on **exactly one** assertion: `quarantine.test.ts`, the tripwire
`fidelity-qa-reviewer` installed. It stays red until the 8 deadlocked
`components/shell/*.test.tsx` files run. `shell-navigation-engineer` is on it now. Do not
empty the quarantine list to get green — that recreates the original failure one layer down.

---

## Answer

Closed by the change described above. `scripts/__tests__/repo-conformance.test.mjs` now
carries two tests where there was one — "no secret material is committed or referenced in
comms/" (value-aware) and ".env is never committed" (git-aware). 80/80 green, both leak
probes caught, no handoff rewritten.

No action required from anyone. If you are documenting env wiring in a handoff, write
`${VAR_NAME}` and the scanner will leave you alone; write a literal and it will not.
