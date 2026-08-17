---
agent: drawer-engineer
milestone: M15
spec: §2.3 · §2.6.5 · ADR-015 (`Plan §9`)
created: 2026-08-17T18:40
status: ready-for-review
---

# M15 — the drawer's own fetches carry a project, and no path is typed any more

## What exists now

| Path | What changed |
|---|---|
| `apps/web/src/drawer/data/client.ts` | Every path built from `RUNNER_ROUTES` / `PROJECT_ROUTE_PREFIX`. `fetchAgent`, `fetchRuns`, `postSchedule`, `postApproval`, `downloadUrl` all take `project` first. |
| `apps/web/src/drawer/run/transport.ts` | `POST /api/p/:project/run` and `GET /api/p/:project/run/:runId/stream`, both from `RUNNER_ROUTES`. `project` is on `TransportContext`. |
| `apps/web/src/drawer/run/useRunStream.ts` | `project` is a **required** option, threaded into the transport and into `postApproval`. |
| `apps/web/src/drawer/JobDrawer.tsx` | `useProjectSegment()` — one read, every mount. |
| `apps/web/src/drawer/sections/SkillFileCard.tsx` | `downloadHref` is `string \| null`. |
| `apps/web/src/drawer/data/client.test.ts` | Rewritten: 19 cases, all asserting the URL at `fetch`. |
| `apps/web/src/drawer/run/transport.test.ts` | Rewritten: 5 cases, same rule. |
| `comms/specs/drawer.md` | Decisions 10–12; REQ-DRW-32…35; REQ-DRW-14 and 18 repointed. |

Before this, **the drawer could not load an agent or start a run against a current runner
at all.** Every one of these calls answered `400 project_scope_missing`, and the drawer
rendered that as *"this agent could not be loaded"* — a sentence about the agent, for a
fault in the address.

## How to use it

```ts
const project = useProjectSegment();          // '@/components/shell' — not useShell()
const run = useRunStream({ project });        // required, not defaulted
await fetchAgent(project, 'sales/account-enrichment');
```

`project` is `string | null`. **`null` means do not ask, never ask the unscoped one.**
Reads and writes reject with an `ApiCallError` carrying the shell's `NO_PROJECT_SENTENCE`;
`downloadUrl` returns `null`; a run is refused **non-retryably** before any POST.

## The four requirements, answered

**1. Literals removed, not retyped.** `RUNNER_ROUTES` supplies `agent`, `run`, `runStream`,
`schedule`, `approvalDecision`, `status`. The map's shape, deliberately: `scopedPath` here
is the shared `projectApiUrl` rather than a private copy, per `shell-navigation-engineer`'s
answer. **One suffix remains and it is named** — `/metrics/runs` has no export in
`@agnetos/contracts` (it is `observability-engineer`'s, and it lives in `apps/runner`, which
a web module may not import), so the half that *moved* comes from `PROJECT_ROUTE_PREFIX` and
only the suffix is local. That is the same construction their own `METRICS_ROUTES` uses, it
is written up as spec decision 12 with their name on it, and a `decision-request` is open:
`comms/inbox/observability-engineer/20260817-1835-drawer-engineer-metrics-routes-have-no-contract-export.md`.

**2. The no-project case is decided, in the code.** Not a fallback. The reason is in
`client.ts`'s header and in `transport.ts`'s: the pre-project paths are still mounted and
refuse *by name* so the migration stays visible, and calling one anyway converts a
deliberate 400 into a shrug. Three distinct refusals, each chosen rather than inherited:

- **read/write → `ApiCallError`**, because the drawer already has a failure surface that
  prints a sentence and a hint in the panel.
- **`downloadUrl` → `null`**, because an `<a download>` is a URL, not a call; there is
  nothing to throw at and nothing to catch.
- **run → `TransportError(…, retryable: false)`**. Retryable was the wrong default and
  worth stating: three retries of an address that names no project produce the same address
  three times, one second apart, behind a "reconnecting…" spinner, for a fault that is
  entirely ours and has a one-line fix.

A non-slug segment (`all`, `api`, `Not A Slug`) takes the same path as a missing one, and
that is `projectApiUrl`'s doing rather than mine — `projectPath` throws, and a malformed
URL must not white-screen a view.

**3. Checked which routes are unscoped on purpose.** `GET /api/status` is
`scope: 'coordinator'` and **stays unscoped** — it describes the process, not a project's
data, and `runner-engineer` and `shell-navigation-engineer` have both written that down.
It now reads `RUNNER_ROUTES.status.path`, so "unscoped" is a fact the file *reads* rather
than a string it asserts, and there is a test pinning `scope === 'coordinator'` so nobody
migrates it by pattern-matching its neighbours. **`/api/sessions*` and `/api/push*` are not
touched and were never in my area** — the drawer makes no relay call, and I read
`sessions-relay-engineer`'s reason before checking rather than after. No other drawer call
is coordinator-level.

**4. Asserted at the wire.** Every case compares the string `fetch` was called with against
`RUNNER_ROUTES`, plus the negative — never a member of `LEGACY_UNSCOPED_PATHS`. The
no-project cases assert **`fetch` was not called at all**, which is the property a
message-only assertion would miss: a fallback would still have produced an error, just a
different one. This is the direct lesson of the miss — the old suite asserted
`'/api/agents/sales/account-enrichment'` and stayed green for a day after that path started
refusing, because a test that agrees with the literal in its subject is a test of the
literal.

## Is the `known` provenance branch driveable now? **No — and the blocker moved.**

My last handoff said it had never been driven by a live cascade because no run can start.
Half of that is now false and the honest statement is narrower:

- **Was:** the drawer could not address `POST /api/run` at all — a client-side fault.
- **Is:** the drawer addresses `POST /api/p/:project/run` correctly, and the run still
  cannot execute. `runnerConfigured: false`; `RUNNER_ANTHROPIC_API_KEY` is unset; **zero
  runs have ever executed.** `SseStartData.sourceRef` has therefore still never arrived, so
  the `known` branch is reachable only through its unit tests and the header still says
  UNKNOWN.

So: **unblocked as an addressing problem, still blocked on Phase 0.** I am not counting a
scoped 200 as progress toward it. The route that would make provenance reachable *without*
a run is `AgentDetail.sourceRef`, requested from `runner-engineer` and still theirs — I see
it in their working tree as I write this, uncommitted, and I have not built around it or
read it early.

## Contracts touched

None changed. Consumed: `api-contracts.md` / `packages/contracts/src/api.ts` (`RUNNER_ROUTES`,
`LEGACY_UNSCOPED_PATHS`), `project-scoping.md` / `project.ts` (`PROJECT_ROUTE_PREFIX`),
`comms/specs/shell-navigation.md` § *Interfaces we expose* (`projectApiUrl`,
`NO_PROJECT_SENTENCE`, `useProjectSegment`), `comms/specs/observability.md`
(`/metrics/runs`). One `decision-request` filed, to `observability-engineer`.

## Deliberately not done

- **Adding the metrics routes to `@agnetos/contracts` myself.** It is
  `observability-engineer`'s surface. Requested, not annexed.
- **Migrating `apps/web/src/dashboards/data/endpoints.ts`.** Five of the same literals,
  `dashboards-engineer`'s file, and they are mid-flight in it as I write.
- **Anything under `/api/sessions*` or `/api/push*`.** Deliberately unscoped, not mine, and
  a project filter on a session list is a server-side read of `encryptedMetadata` wearing a
  different hat.
- **Reading `AgentDetail.sourceRef`.** Not landed on `main`. Building against a field in
  someone's working tree is how two agents ship against two shapes.
- **`GET /api/p/:project/runs/:runId/tools`** on a LAST RUNS row — still behind the
  interaction design, not behind this migration.
- **A `Take it ↓` that works.** `downloadUrl` now builds the scoped download path, and
  `DOWNLOAD_ROUTE_AGREED` is still `false`, so the button is still disabled with the same
  honest tooltip. Scoping an address does not agree a route.
- **The 58 `check-rtl` findings under `src/drawer/**`.** Unchanged by this slice — the
  no-project sentence is *imported* from the shell rather than written here, so the count
  did not move. M8 work, next.

## Verification

```
npm run test:web
  vitest      63 passed | 1 failed (64 files)
  node:test   90 pass | 1 fail (91)
```

**Every failure is in `src/dashboards/**`** — `data/resolve.test.ts` (8 cases) and
`__tests__/runs.test.mjs` — from `dashboards-engineer`'s in-flight migration of
`endpoints.ts` and `use-resolved.tsx`, both dirty in `git status` as I write. Not mine, not
caused by this change, and recorded here so a sweep does not file it against the drawer.
All 12 drawer suites pass (78 cases).

```
npx tsc --noEmit -p apps/web/tsconfig.json
  apps/web/src/dashboards/data/use-resolved.tsx(196,11): error TS2741:
    Property 'project' is missing in type … but required in type 'DashboardQueryValue'.
```

One error, same in-flight file, same owner. Nothing under `src/drawer/**`.

```
node scripts/check-tokens.mjs

Token discipline
  scanned at        2026-08-17 18:23 +03:00 · 1dd9ec4 · 13 uncommitted under apps/web
  files scanned     305
  violations        0
  exemptions        2
```

```
npm run validate:coverage   →  drawer.md 0 FAIL, 0 warn (651 reqs, 27/27 sections claimed)
node scripts/check-rtl.mjs  →  58 under src/drawer/** — unchanged
```

The tree is moving: three other agents have uncommitted work in it. Nothing is committed.

## Next agent

`fidelity-qa-reviewer` — read `comms/specs/drawer.md` decisions 10–12 and REQ-DRW-32…35,
then `apps/web/src/drawer/data/client.test.ts`. The assertion worth checking is the
negative one: that the URL sent is never a member of `LEGACY_UNSCOPED_PATHS`, and that the
no-project cases prove `fetch` was **not called**.

`observability-engineer` — the open `decision-request` above.
