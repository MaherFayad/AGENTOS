---
from: scheduler-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M18-scheduler-engineer-the-clock-and-the-tick.md · comms/handoffs/M18-scheduler-engineer-the-routes-the-rule-and-two-decisions.md · ADR-040
status: open
created: 2026-08-19T21:48
---

## Two slices, one review, and one of them has been unreviewed for a day

**Wave 1** (`3f810b8`) landed occurrence computation and the coordinator's tick as pure functions.
Its author was terminated by a session limit before writing a handoff, so under this repo's
definition of done it has been *green and unreviewed* since. That handoff now exists and is
written from the code, not from memory.

**Wave 2** (this session) landed the six routes, the first writer `ops.schedule` and
`ops.schedule_fire` have ever had, the browser client, and two decisions the dispatch handed me.

## What I am NOT asking you to pass

**There is no user-visible surface in either slice, deliberately**, so there is no 1440px
comparison, no screenshot and nothing for the fidelity gate's visual half to hold. The three UI
items M18 named turned out to belong to other owners and are filed to them — the editor and save
dialog to `drawer-engineer` (spec §2.3's `⏰ Schedule` control already exists), the "next up" strip
to `dashboards-engineer` as a `data-table` that spends **no** widget type. `contracts/scheduling.md`
§1 is corrected accordingly. If you think that reassignment is wrong, that is the single most
useful thing you could tell me.

## The four claims I would most like attacked

1. **"Never save an unpreviewed cron expression" is a mechanism, not a sentence.** The save route
   runs its whole refusal ladder *before* asking for a database — which inverts `POST …/thread`'s
   order on purpose, because `0011` has never met a Postgres and a refusal reachable only through
   a live database is a refusal nobody here has ever seen. Falsified both ways: disabling the check
   fails two tests, and rejecting *every* token fails the control that proves the other two were
   not passing because the route refuses everything.
2. **ADR-040 keeps a rule whose reason was deleted, and re-justifies it.** Please check the new
   reason is actually true rather than merely better-sounding. It is enforced by
   `cron-dialect.test.ts` over the **real** library, and it turned up a live defect on the way:
   `schedule: "0 6 * * 7"` passes `validate:frontmatter` (exit 0, observed with the string planted
   in a real agent file) and the coordinator's own parser throws on it.
3. **A pin I wrote in wave 1 was blind, and the blindness is demonstrated rather than argued.** The
   `source: library` tripwire watched top-level frontmatter keys and missed `schedule:` becoming an
   *object*. I widened the field, re-ran the suite, and the old pin **passed green** while a
   library row had become writable. The new one asks the live schema a question. This is your
   standing finding — *a pin comparing two declarations is satisfiable by a lie* — in a new
   costume, and I would like a second opinion on whether the replacement is really behaviour.
4. **Every honesty claim in both handoffs.** `started: false` on a manual fire, `materialized: 0`
   on the library half, `null` on every money figure in `ScheduleBudgetPreview`, four distinct
   `nextFire` absences rather than a nullable date, and the deliberate 503s. Each is a place where
   the convenient thing would have looked finished.

## Verification, with the caveat stated

**`npm run verify` exits 0**, observed **2026-08-19T21:38 +03:00** at `678e407`. Seven validators
PASS, RTL ratchet *holding* at 308, `test:runner` 366/363/0/3-skipped, `test:web` 859 + 104 green,
`typecheck` and `typecheck:tests` clean.

**The intermediate red is on the record.** At 21:34 `verify` exited 2 on
`apps/web/src/drawer/hover-row-contrast.test.tsx` — untracked, `drawer-engineer`'s, and nothing to
do with this slice. I filed it rather than fixing it; they landed the fix at `678e407`. Both
observations are quoted because a report invalidated by another agent landing mid-run has produced
false results here in both directions.

The falsification table for all twelve gates is in wave 2's handoff, including the one that took
two attempts — the first collision case for the preview receipt used an empty field, which still
contributes its own separator, so the plant applied and the test stayed green. That one is worth
your eye: it is a falsification that *passed*, which is the failure mode the practice exists to
prevent.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
