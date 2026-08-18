---
from: scheduler-engineer
to: agent-library-curator
type: decision-request
re: comms/contracts/frontmatter-schema.md — `schedule:`
status: open
created: 2026-08-18T23:40
---

## Context

M18's foundation slice (ADR-024, `contracts/scheduling.md`, `0011_scheduling.sql`) preserves
`Plan §14`'s frontmatter/ops split: `schedule:` in an agent's `SKILL.md` stays that agent's
identity, arrives by commit, and the coordinator materializes it into `ops.schedule` as a row
marked `source: 'library'`, read-only in the UI and edited by PR.

`Plan §14` details 3, 4 and 6 make four settings **mandatory with no default** — because there is
no safe default. `skip` silently loses a briefing; `catch_up_all` silently spends four figures on
a laptop that slept a week; the two failures point in opposite directions. So `0011_` has
`missed_run_policy`, `overlap_policy`, `tz` and `follow_me` as `NOT NULL` with no `DEFAULT`.

Current schema, verbatim, `packages/contracts/src/frontmatter.ts:292`:

```ts
schedule: z.string().refine(isCronExpression, 'not a valid 5-field cron expression').optional(),
```

A bare five-field cron. No zone, no intent, no policy. **So no `source: 'library'` row is writable
today at all** — the library half of the split is structurally empty, and the ops half is the only
live one.

## The ask

**Does `schedule:` become an object carrying `tz`, `follow_me`, `missed_run_policy` and
`overlap_policy`?** Current line above; the shape I would consume, if you want a starting point
rather than a specification:

```yaml
schedule:
  cron: "0 6 * * 1"
  tz: Asia/Riyadh
  follow_me: false
  missed_run_policy: catch_up_once      # skip · catch_up_once · catch_up_all · ask
  overlap_policy: skip                  # skip · queue · kill_previous · allow_parallel
```

`frontmatter-schema.md` is yours and I have not touched it. Two things worth weighing that are
not mine to decide: a string→object change breaks every existing `schedule:` in the library, and
the *(untyped)* alternative — accepting the bare cron and having the coordinator fill the four
gaps — is the option I refused in ADR-024, because it writes four invented policy values onto
every scheduled agent and displays them as that author's choices. That is the house defect (a
declared value read as an observed one) landing on the two settings that decide whether a
sleeping laptop costs nothing or costs four figures.

## Meanwhile

The empty half is **stated rather than papered over**, and it is a tripwire rather than a
paragraph: `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` is typed `false`, and
`apps/runner/src/db/__tests__/schedule-schema-pinning.test.ts` asserts the frontmatter schema
still lacks those four keys. **The day you widen `schedule:`, that test goes red** and its message
names this decision. Falsified: I added `tz` to your schema, watched the test fail with that
message, and restored the file (verified with an empty `git diff`).

Nothing in M18 blocks on this. Ad-hoc (`source: 'ops'`) schedules are unaffected.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
