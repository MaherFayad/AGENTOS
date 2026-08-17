# status — runner-engineer

**Updated:** 2026-08-17T18:35
**Milestone:** M15 (lead) · M3 still blocked on the human
**State:** review

## Now
Four findings filed against me inside an hour, all four done: the runner's default bind
address, five library reads that discarded the project, panels per project, and
`AgentDetail.sourceRef`. The last three were **one defect** — the runner had two ways to read
the library, project-derived at dispatch and coordinator-derived on every read, agreeing only
because one library is mounted. Both agent reads now resolve through `resolveForDispatch`, so
what the drawer and CHART show is the file that would run. Runner 156 tests / 153 pass / 0
fail / 3 skipped; root 142 / 141 / 0 fail; `tsc --noEmit` clean on runner and web;
`validate:coverage` **0 FAILs**, runner warnings 11 → 9 (`2026-08-17 18:33 +03:00 · 1dd9ec4 ·
55 uncommitted`). Nothing committed.

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and still the only thing.** M15 stays *complete* and
*unvalidated*; `project-scoping.md` §6 is unchanged. Not idle on it, and no figure was written
into `spend.json`.

## Last handoff
`comms/handoffs/M15-runner-engineer-project-derived-reads.md` (continues
`M15-runner-engineer-project-axis-and-billing.md`) · ADR: `ADR-015-project-scoping.md` (proposed)

## Found and fixed this session
**`npm start` put an unauthenticated API on the LAN**, because `RUNNER_HOST` defaulted to
`0.0.0.0` — right in the container, wrong on a host, and untestable where it lived. The default
is now loopback and the wide bind is declared by compose and the Dockerfile, which a test
reads. The general form is worth keeping: *a default that is safe only because the host is on a
trusted network is the same defect shape as a route that is safe only because auth exists.*
Also: `agents/_overrides/**` was invisible to every enumerator here — an override would have
won a run and shown up nowhere. Closed for `/api/agents` before the first one exists.

## Next
1. **Apply migrations 0005–0007 to a real Postgres.** Never done, by anyone. Needs the compose
   stack, not a key — still the highest-value unblocked item I have.
2. `connector_uncredentialed`'s test — credential seeded for project A, dispatched in project
   B. Needs (1). Owed to `agent-library-curator` since 2026-08-16.
3. `ledgerConnection.test.ts` flakes under the full parallel suite (wall-clock assertion). My
   file, my weakness, not caused by today's change.
4. Answer `fidelity-qa-reviewer`'s findings on M15.
5. M7 schedule/audit — including ADR-014 §3.2's "refuse a write to a layer that is not the
   winner", now the last thing `loadAgent` is used for.
