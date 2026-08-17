# status — runner-engineer

**Updated:** 2026-08-17T20:23
**Milestone:** M15 (lead) · M3 still blocked on the human
**State:** review

## Now
Swept the isolation sign-off's *Deliberately not done* section — **eight entries, each now
fixed / filed with an owner / deliberately not done**, and a BOARD table so none of them is
"in an artifact but not on the board" again. The live one is fixed: **artefacts are
`<artifactsRoot>/<project>/<runId>/`**, derived from `MountedProject`, and `artifacts.ts`
cannot import `RunnerConfig` — a filesystem has no constraint that can refuse a write, so
derivation is the only instrument. Download refuses bytes outside the project's directory:
new code `artifact_unattributed` (500), **nothing deleted**, path named. *Migration decided:
nothing to move (zero runs), and an old-layout directory is refused, never adopted.*
Also: `ProjectSummary`'s four unread fields typed shut, so ADR-015 Q6 cannot leak silently;
`writer-schema-agreement` raised to catch **NOT NULL by omission** and an undeclared
`ON CONFLICT` target; and the `plan`/`approval-requested` spans now carry `inputKeys`, not
`buildPlanSummary`'s prose — flattening defeated the redactor's key pass
(`observability-engineer`'s finding, answered same session). All falsified. Runner
179 / 176 / 0 fail / 3 skip; root 162 / 161 / 0; typecheck clean ×3; `validate:coverage`
0 FAILs, runner warns 10 → **8**. Nothing committed.

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and still the only thing.** M15 stays *complete*
and *unvalidated*; `project-scoping.md` §6 unchanged. No figure written into `spend.json`.

## Last handoff
`comms/handoffs/M15-runner-engineer-artefacts-carry-the-project.md` (continues
`M15-runner-engineer-cross-project-payload.md`) · ADR: `ADR-015-project-scoping.md` (proposed)

## Next
1. **Apply migrations 0005–0007 to a real Postgres.** Unchanged as the top unblocked item.
   The DB-free test now buys the *column*, *required-column* and *conflict-target* classes —
   not types, not `CHECK`, not an index made by hand. The three skipped tests stay owed.
2. `ProjectSummary` narrowing — waiting on `shell-navigation-engineer` (their harness, their
   `ProjectSwitcher` is mid-review). Filed with a BOARD line; the type holds meanwhile.
3. `connector_uncredentialed`'s test — credential seeded for A, dispatched in B. Needs (1).
4. `ledgerConnection.test.ts` wall-clock flake under the parallel suite. My file.
5. M7 schedule/audit — ADR-014 §3.2's "refuse a write to a layer that is not the winner".
