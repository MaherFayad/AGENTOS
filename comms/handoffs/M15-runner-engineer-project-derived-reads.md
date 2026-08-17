---
agent: runner-engineer
milestone: M15
spec: §3.2 · §3.3 · PART V · Plan §9 · Plan §10 · ADR-014 · ADR-015
created: 2026-08-17T18:34
status: ready-for-review
---

# M15 — the read path: project-derived, cascade-resolved, and a bind that is safe by default

Four findings landed against me inside an hour, all inside M15's remaining gap. All four are
done. This is the third M15 handoff and it continues
`M15-runner-engineer-project-axis-and-billing.md`.

The one sentence that connects three of them: **the runner had two ways to read the library —
project-derived at dispatch, coordinator-derived on every read — and they agreed only because
one library is mounted.** Fixing the read path fixed `rtl-arabic-pdpl-specialist`'s five
routes, `drawer-engineer`'s missing `sourceRef` and `agent-library-curator`'s "there is no
resolver outside dispatch", which were three views of one defect.

## What exists now

**The bind address (`shell-navigation-engineer`'s finding)**

- `apps/runner/src/lib/bind.ts` — `RUNNER_HOST` defaults to **`127.0.0.1`**. A wide bind is
  now the case that has to be declared, and `infra/compose.yaml:135` and
  `infra/runner.Dockerfile:31` both already declare it, so the container is byte-identical.
- `apps/runner/src/index.ts` — calls `bindHost()`. It was a `??` expression inside the one
  module tests cannot import, which is why the most security-relevant value in the process had
  no test.
- `apps/runner/src/lib/__tests__/bind.test.ts` — 4 cases, including two that read
  `infra/` and assert the container still declares the wide bind and the published port still
  pins `${DEV_BIND_ADDR:-127.0.0.1}`.

**Project-derived library reads (`rtl-arabic-pdpl-specialist`'s finding)**

- `apps/runner/src/lib/project.ts` — `MountedProject` gains `graphFile`, and carries the
  header comment stating the rule: every library read takes the project, never `RunnerConfig`.
- `apps/runner/src/lib/graph.ts` · `apps/runner/src/lib/panels.ts` — take `MountedProject`
  and **no longer import `RunnerConfig` at all**, so a handler that reaches for the
  coordinator's paths is a compile error rather than a review comment.
- `apps/runner/src/routes/api.ts` — `graph`, `agentsIndex`, `agent`, `panels`, `panel` all
  pass the resolved project.

**The agent reads resolve through the cascade (`drawer-engineer`'s + `agent-library-curator`'s)**

- `apps/runner/src/lib/cascade.ts` — new `listResolvedAgents(config, project, onSkip)`: the
  union of `(department, slug)` across all three roots, each resolved and ceiling-checked.
- `apps/runner/src/lib/agents.ts` — `toAgentDetail(record, sourceRef)`; the second argument is
  **required and never derived here**.
- `packages/contracts/src/api.ts` — `AgentDetail.sourceRef: string` (required), and a new
  error code `brain_write_refused` (403).
- `apps/runner/src/lib/brain.ts` — the global-tier refusal throws `brain_write_refused`
  instead of `git_write_refused`.

**Tests** — `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` (9 cases) and
`apps/runner/src/lib/__tests__/bind.test.ts` (4). `one-door.test.ts` and `brain.test.ts`
updated where the change was deliberate.

## How to use it

```
GET /api/p/agentos/agents/sales/account-enrichment
→ { slug, path, sourceRef: "project:agents/sales/…/SKILL.md@sha256:…", frontmatter, body, runnable }

GET /api/p/agentos/agents      → the resolved set; `skipped[]` names every exclusion and why
GET /api/p/agentos/panels      → that project's panels/. No panels/ ⇒ { panels: [] }
GET /api/p/agentos/graph       → that project's artifact. Absent ⇒ 503 graph_not_built, naming it

RUNNER_HOST unset  → 127.0.0.1     RUNNER_HOST=0.0.0.0 → every interface, as compose sets it
```

## Contracts touched

| Contract | Change | Owner |
|---|---|---|
| `api-contracts.md` | new section *"A route that resolves a project reads that project's library"*; `AgentDetail.sourceRef` and its subsection; `brain_write_refused` in the error table; the brain write-back tier row | **mine** |
| `project-scoping.md` | §4 amendment (the mount is what a read derives from); §5.1 Q8 rewritten with a built/not-built table; **§5.1 Q8a added and answered** | **mine, in trust** |
| `agent-cascade.md` | **not edited.** §11's two rows are now partly built; the source material is filed to `agent-library-curator` as an `fyi` rather than written into their file | `agent-library-curator` |
| `graph-layout.md` | **not edited.** A `core.project` field is requested, not invented | `map-galaxy-engineer` |
| `comms/specs/runner.md` | Decisions 7–10; REQ-RUN-33…39, **all seven with a real verification**; REQ-RUN-19 and 23 gained one; six new *Deliberately not done* entries | mine |

No ADR. Nothing here decides something ADR-014 or ADR-015 left open, except **Q8a**, which is
recorded in the contract that asked it, with its own reasoning rather than ADR-014's.

## Deliberately not done

- **The web app's panel loader.** `apps/web/src/dashboards/data/load.ts` still walks a fixed
  candidate list and takes no project; both dashboard routes still discard `:project`. It is
  `dashboards-engineer`'s file, the resolver they asked for is a route
  (`GET /api/p/:project/panels`), and Q8 now names it as unbuilt rather than implying it was
  done. **Six Command Centers still render identically in every project** — true of exactly
  one project today.
- **A project field in `graph.json`.** A *missing* artifact is a refusal; a *misplaced* one is
  undetectable, because nothing in the payload names a project. Filed to
  `map-galaxy-engineer`; ADR-003 fixes one producer and I will not invent a field in their
  contract.
- **MAP still cannot see `agents/_overrides/**`.** `scripts/build-graph.mjs` enumerates the
  project layer and skips `_`-prefixed folders, so CHART and the drawer would show a winning
  override that MAP would not. Latent — no `_overrides/` exists in any project — and the fix
  is `agent-cascade.md` §11's *"one resolver, N callers"* row, which is not mine.
- **`POST /api/schedule` still uses the single-layer loader.** It needs the project layer's
  file path, and ADR-014 §3.2's rule (refuse when the layer written to is not the winner) is
  specified and unbuilt. It is now the **only** shipped caller of `loadAgent`, asserted
  exhaustively in `one-door.test.ts`, so the list cannot grow quietly.
- **Pass-2 validation on the resolved agent.** I enforce the capability ceiling and refuse what
  would make a *run* wrong. `agent-cascade.md` §7.2's other invariants — Class A match,
  `deliver` at L0, `status` from the ledger — are still unbuilt and still
  `agent-library-curator`'s.
- **`apps/web`'s own dev-server bind.** Same shape as the runner's, probably a script flag
  rather than code, and it is `infra-compose-engineer`'s plus `shell-navigation-engineer`'s.
  Filed, not taken.
- **Validating `RUNNER_HOST`.** `0.0.0.0` stays a legitimate value and `bindHost` does not
  second-guess it. A checker that refused it would break the container and would be enforcing
  a deployment policy from inside the process.
- **Anything requiring a run.** Unchanged and unchangeable here: the cascade picking the agent
  a human *meant* has no error message and needs `RUNNER_ANTHROPIC_API_KEY`
  (`project-scoping.md` §6). Nothing was written into `spend.json`.

## Verification

Scanned 2026-08-17 18:33 +03:00 · `1dd9ec4` · 55 uncommitted (nothing committed by me).

```
npm run test:runner        156 tests · 153 pass · 0 fail · 3 skipped   (was 143 · 140 · 0 · 3)
npm test                   142 tests · 141 pass · 0 fail
npx tsc --noEmit -p apps/runner/tsconfig.json     clean
npm run typecheck --workspace=apps/web            clean
npm run validate:coverage  0 FAIL · 669 requirements · runner warnings 11 → 9
```

**One honest note on flakiness.** On one full-suite run, two timing-sensitive tests failed —
`ledgerConnection.test.ts` ("expected retries, saw 2 attempt(s)") and one
`company-interview.test.ts` case. Both pass in isolation and both passed on the immediate
re-run; the failures are load-related, not caused by this change, and they are recorded here
rather than left for a reviewer to hit and misattribute. `ledgerConnection.ts` is mine; a
wall-clock assertion in a parallel suite is a real weakness and it is on my list, not fixed
tonight.

**What the new tests actually prove, stated narrowly.** The behavioural half of
`project-derived-reads.test.ts` hands the readers a `MountedProject` whose library is *not*
the coordinator's — the only construction in which derivation and coincidence give different
answers, because one mounted project makes that state unreachable over HTTP. The structural
half asserts the two reader modules cannot import `RunnerConfig`, because a behavioural test
cannot see a *future* handler that reaches for it.

## Next agent

- **`drawer-engineer`** — `AgentDetail.sourceRef` is live and required. Read the answer in
  `comms/inbox/runner-engineer/20260817-1802-drawer-engineer-agentdetail-needs-sourceref.md`
  first, in particular the limit: every agent in this repo resolves `project:`, so the badge
  renders `▣` universally and that is true rather than a stub.
- **`dashboards-engineer`** — Q8a is answered (**nothing**, no fallthrough) and the runner half
  is built. Your half and its route are in the answer on your `fyi`.
- **`agent-library-curator`** — `agent-cascade.md` §11 rows 1 and 7 are now *partial*; source
  material in your inbox, your file to edit.
- **`fidelity-qa-reviewer`** — `review-request` filed. This is an API surface: no pixels, and
  the fidelity bar's screenshot gap does not apply to it.
