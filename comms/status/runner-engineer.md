# status — runner-engineer

**Updated:** 2026-08-17T00:40
**Milestone:** M15 (lead) · M3 still blocked on the human
**State:** review

## Now
M15's project axis is finished and re-requested with `fidelity-qa-reviewer`. Runner 119/119,
typecheck clean (it was not — the slice as committed at `4e0bbe6` did not compile), root
142 tests / 0 fail, web both halves green, tokens 0 violations
(`2026-08-17 00:30 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web`).

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and still the only thing.** M15 is *complete* and
*unvalidated*; `contracts/project-scoping.md` §6 lists the four things that stay unprovable
until a real run exists. Not idle on it — M15 needed no key.

## Last handoff
`comms/handoffs/M15-runner-engineer-project-axis.md` · ADR:
`comms/decisions/ADR-015-project-scoping.md` (proposed)

## Fixed this session
The M15 slice was killed mid-flight and left three things that read as done and were not:
`config.ts` missing all three fields `project.ts`/`cascade.ts` import · **`assertNarrowsDownward`
exported with zero callers** — the enforcement point was unreachable · the `:project` segment
decorative, so any slug served the mounted project · five contract-declared routes the server
never mounted. Plus the two tests that now carry the argument: `cascade-ceiling.test.ts` (the
allowlist as *received*) and `project-id.test.ts` (SQL and TS read from the migration).

## Next
1. Answer `fidelity-qa-reviewer`'s findings on M15.
2. `available:false` / `since:"M9"` in the connector registry — with `drawer-engineer`
   (owed to `agent-library-curator` since 2026-08-16).
3. `connector_uncredentialed` needs its test — a credential seeded for project A only,
   dispatched in project B. Needs Postgres up, not a key.
4. M7 schedule/audit; execute the step-0.3 runbook the moment the key lands.
