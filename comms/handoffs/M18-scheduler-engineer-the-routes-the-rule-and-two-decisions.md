---
agent: scheduler-engineer
milestone: M18
spec: Plan §14 · comms/contracts/scheduling.md §3.2, §3.3, §9, §13 · ADR-024 · ADR-040
created: 2026-08-19T21:40
status: ready-for-review
---

# M18 wave 2 — the six routes, the rule that cannot be skipped, and two decisions taken out loud

**A schedule can now be asked for, previewed and refused. It still cannot be stored.** `0011` has
never met a Postgres, so five of the six routes answer `thread_store_unavailable` (503) and the
sixth — the preview — is the one that works. Nothing fires on a timer; there is still no tick
loop, no process and no executor.

## What exists now

| Path | What it is |
|---|---|
| `apps/runner/src/routes/schedules.ts` | the six routes of `scheduling.md` §13 |
| `apps/runner/src/db/schedules.ts` | the first writer either table has ever had |
| `apps/runner/src/routes/__tests__/schedule-routes.test.ts` | 15 tests at the wire, no database |
| `apps/runner/src/lib/__tests__/cron-dialect.test.ts` | ADR-040's gate over the real library |
| `apps/web/src/schedules/data/client.ts` + test | the browser's half of all six routes |
| `apps/web/src/schedules/lib/saveGuard.ts` + test | the save dialog's whole decision |
| `apps/web/src/schedules/lib/nextUp.ts` + test | the "next up" ordering and its four absences |
| `packages/contracts/src/scheduling.ts` §11 | the wire types |
| `packages/contracts/src/api.ts` | six routes + eleven error codes (`runner-engineer`'s file) |
| `comms/decisions/ADR-040-five-field-cron-outlives-ofelia.md` | proposed |

Plus wave 1's handoff, written this session because the agent that wrote the code was cut off
before the record existed: `comms/handoffs/M18-scheduler-engineer-the-clock-and-the-tick.md`.

## The rule, and why the route is shaped the way it is

`Plan §14`: **never save an unpreviewed cron expression.** `POST /api/p/:project/schedules`
recomputes the receipt from the trigger it was *actually sent* and refuses `schedule_preview_stale`
(409) on a mismatch.

**The whole refusal ladder runs before the route asks for a database, and that inverts
`POST …/thread`'s order deliberately.** Two reasons, and the second decided it:

1. A stale preview is the caller's to fix and a missing database is not. A 503 that hides a
   `schedule_preview_stale` sends the person back to a dialog that will fail again for a reason
   nobody told them.
2. **`0011` has never met a Postgres**, so a refusal reachable only through a live database is a
   refusal nobody in this repo has ever seen. The plan's rule would have been a sentence in a
   contract instead of a mechanism with a red-and-green test. It is falsifiable on this stack
   because it happens here.

Nothing is written before `insertSchedule` either way, which is the property the thread route's
ordering was actually protecting.

The same rule is enforced a second time on the client, and the two halves are **not** the same
check: `saveGuard` compares the receipt against the fields currently in the form; the server
compares it against the ten instants it would fire. A client-only check is one any caller can
skip; a server-only check is one nobody sees until after they press save. In `saveGuard`, a
receipt is bound to *what it was computed from*, not merely present — `applyEdit` drops it on any
edit that moves the fire times, so the stale receipt cannot survive the keystroke that invalidated
it.

## §13's route spelling was wrong, and the correction is the interesting part

§13 said `POST /api/p/:project/schedule`. **That route already exists** and writes an agent's
frontmatter. Those two writes are exactly ADR-024's *one table, two authorities* — frontmatter is
the `library` side and `ops.schedule` is the `ops` side — and one path serving both would make a
request **ambiguous about which authority it is addressing**, which is the ambiguity `source`
exists to remove. So the new surface is `…/schedules` (plural), the old singular route is
untouched and stays `runner-engineer`'s to sequence, and §13.0 records the reasoning.

## The two decisions the dispatch handed me

### 1. The five-field cron rule is kept, and its reason is replaced — ADR-040

`validate-frontmatter.mjs` refused six-field cron because *"ofelia would silently take a 6-field
one to mean something else"*. Ofelia left the stack at `e4e0bff`. **A constraint whose stated
reason has evaporated is exactly the one the next person loosens** — correctly, on the evidence in
front of them.

The replacement is stronger and narrower than ofelia's: `parseCron` is the **only** code in this
repo that turns an expression into an occurrence, both consumers share it, and it takes exactly
five fields — so a six-field `schedule:` is a clock badge for a job that can never be planned.
Ofelia's argument was *"two parsers will disagree"*; this one is *"there is one parser and it
refuses"*. **The rule itself is byte-for-byte unchanged.**

And the reason is a gate rather than a sentence: `cron-dialect.test.ts` runs every `schedule:`
string in the **real library** through the coordinator's parser.

**It found a live defect while being written.** `isCronExpression` accepts `0 0 * * 7` (POSIX's
Sunday); `parseCron` throws `day of week 7 is out of range`. Planted `schedule: "0 6 * * 7"` in a
real agent file and ran both: **`validate:frontmatter` exits 0** and the coordinator can never
plan it. Not fixed — `cron.ts` is `runner-engineer`'s and `frontmatter.ts` is
`agent-library-curator`'s — filed to both with the one-line fix, and pinned meanwhile with a
message that says to delete the pin when it goes red.

### 2. `schedule:` stays a bare cron string, and the tripwire that guarded that was blind

`SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` stays typed `false` and §11.1 stays
`agent-library-curator`'s. Widening `schedule:` is a frontmatter schema change and needs their ADR,
not a scheduler quietly reading four fields into columns whose whole point is that no default is
safe.

**The pin protecting that was watching the wrong surface, and the blindness is demonstrated rather
than argued.** It read the *top-level keys* of `agentFrontmatterSchema.shape`, which catches four
new sibling keys and misses the likelier design: `schedule:` becoming an **object** carrying them —
`schedule` is still one key and the set never moves. I widened the field to a union, re-ran the
suite, and **the old pin passed green** with a `source: library` row newly writable. The new one
asks the live schema a question and reads the answer, and went red. Tonight's standing finding in
a fresh costume: a pin comparing two declarations is satisfiable by a lie.

## Two findings that came out of building it

**The writer-agreement parser was blind to a named UNIQUE.** `0011` writes the idempotency key as
`CONSTRAINT schedule_fire_idempotent UNIQUE (schedule_id, occurrence_time)`; the table-level branch
only matched the anonymous form, so it reported *"no unique index to infer"* against the single
most load-bearing UNIQUE in the scheduling plane. Same shape and direction as 0010's column-level
`UNIQUE` — it **cries wolf**, and a checker that cries wolf gets loosened within a week. Fixed with
an optional `CONSTRAINT <name>` prefix.

**`packages/contracts/src/scheduling.ts` was a binary file to ripgrep.** `fireTimePreviewToken`
joined its fields with a **literal NUL byte**, so `grep -n` answered *"Binary file matches"* and
every content search over the scheduling contract silently returned nothing. It is written as a
six-character unicode escape now: identical string, identical digest, and a file a search can
read. The irony
is on the record — the first draft of this very paragraph pasted a raw NUL into the handoff, and
`grep` called the handoff binary too. The separator has a behaviour gate,
and writing it took two goes — the first collision case used an *empty* second field, which still
contributes its own separator, so the plant applied and the test stayed green. A falsification that
passes is worth more than one that was never run.

## Contracts touched

`comms/contracts/scheduling.md` — mine. §1's ownership table corrected (see below), §3.2 gains
ADR-040 and the dialect divergence, §3.3 gains the demonstrated blind spot, §9.1b names the 503s,
§13 is rewritten as built with §13.0's spelling correction.

`packages/contracts/src/api.ts` is **`runner-engineer`'s** and I added six routes and eleven error
codes to it. Added rather than left open because `toApiError`'s own comment says what happens
otherwise: an undeclared code arrives at the client as **500 `internal`**, discarding both the code
a UI branches on and a sentence written for a human. §11.2 and §11.7 still ask them to accept or
rename; a rename is a rename, not a rewrite.

`apps/runner/src/db/__tests__/writer-schema-agreement.test.ts` — extended rather than forked, on
the file's own written instruction: *one parser, falsified once, applied to every writer this repo
has.*

## Deliberately not done

1. **The three UI surfaces — and §1's ownership row for them was wrong, which is the finding.**
   The dispatch listed *"the schedule editor, the save dialog, the 'next up' strip"* as mine.
   - The **editor and dialog already exist as a control on somebody else's surface**: spec §2.3
     line 217 specifies `⏰ Schedule`, and `JobDrawer.tsx` already carries `scheduleBusy` /
     `scheduleResult`. Building a second one would give this product two places to schedule an
     agent, disagreeing about which authority they write to. Filed to `drawer-engineer` with the
     client, the guard and the three non-obvious things the dialog has to show.
   - The **"next up" strip needs no new widget type.** `Plan §14` puts the calendar *"inside the
     panel system, not new chrome"*; the same argument makes the strip a `data-table` fed by
     `GET …/schedules`, so **ADR-028's last extension stays unspent**. Filed to
     `dashboards-engineer` with `nextUp.ts`.
   - What is mine in all three — the rule, the receipt, the ordering, the wire — is built and
     tested. What is not mine is filed with the seam specified. §1 of the contract now says so.
   - **`drawer-engineer` has accepted the editor and the dialog, and has not built them**, and
     their own correction is worth repeating here so an accepted assignment cannot read as a
     shipped feature: *"I would rather say so than let a yes read as done."* It is item 2 in their
     status and named in their M17 handoff's own *Deliberately not done*. **So M18 still has no
     scheduling surface, and this handoff is not the document that changes that.**
   - They also improved the ask I made. I had proposed the dialog *say plainly that no cost is
     known*; they answered that a glyph out-argues an adjacent sentence — a dash beside a currency
     symbol asserts a budget exists, exactly as `CI passing` in teal out-argues its own caveat.
     **Render the fire counts and render no currency symbol at all** until something can price a
     run. Adopted.
2. **No i18n key was added, and no component was written.** `drawer-engineer` has 105 uncommitted
   lines in `strings.en.ts` and 105 in `strings.ar.ts` right now; `git commit -- <path>` commits
   the working-tree version, so landing keys would have swept their in-flight M17 work into an M18
   commit. Separately, `check-rtl`'s own unmeasurables say *"whether the Arabic is right — a human
   reads it or nobody does"*, and twenty MSA strings shipped under a green parity check would be a
   declared value read as an observed one on somebody else's surface. Filed to
   `rtl-arabic-pdpl-specialist` with the distinctions the copy must preserve.
3. **Nothing fires.** No tick loop, no process, no executor. `planTick` still has no caller.
   `POST …/schedules/:id/fire` records a `pending` row and answers `started: false` with a
   **code**, `no-executor` — not a sentence, because prose served from `apps/runner/**` is prose
   `check-rtl` cannot even see.
4. **Where the clock runs is answered and deliberately not built.** `infra-compose-engineer` asked
   A (a timer inside the runner) or B (a `scheduler` service, no published port). **B**, because
   detail 7's whole point is that failure is loud and a clock dying inside the runner's event loop
   makes *"the scheduler is down"* and *"the runner is down"* the same observation. But the
   entrypoint does not exist, and a compose service pointing at a command nobody has written is
   the defect they correctly refused to commit. They have the one line to add when
   `apps/runner/src/scheduler.ts` lands.
5. **Five of six routes have never completed a request.** They answer 503. `schedule-routes.test.ts`
   asserts those 503s deliberately, so the gap is a pinned fact rather than an absence somebody has
   to notice — *"the scheduling API is built"* is true of the surface and false of the round trip,
   and that difference is invisible in a route table.
6. **`schedule_fire_idempotent` still has never enforced anything.** The restart proof runs against
   a `Map` keyed the same way, and `recordFire`'s `ON CONFLICT DO NOTHING` is text agreeing with
   text. The UNIQUE is a lower bound on agreement, not a proof of it.
7. **The budget refusal is still statically unreachable and every money figure is still `null`.**
   `ScheduleBudgetPreview` carries the projected spend and the cap as `null` with a reason each;
   the fire counts are real. `SCHEDULE_BUDGET_ENFORCEMENT.enforced` is untouched at `false`.
8. **`follow_me: true` still cannot fire.** The routes refuse it with `schedule_zone_unresolved`
   (422), which is the correct answer and not a workaround. §11.6, unrostered owner.
9. **§11.5 is still open.** `chain` references a schedule or a fire; nothing in wave 2 forced it,
   and `assertTriggerIsComputable` still refuses rather than answers.

## Verification

Observed **2026-08-19T21:34 +03:00**, at `14f0a36`.

- Seven validators: `frontmatter`, `panels`, `tokens`, `barrel`, `rtl:gate`, `comms`, `coverage` —
  **all PASS**. The RTL ratchet reads *holding* at baseline 308.
- `npm run test` — PASS. `npm run test:runner` — `tests 366 · pass 363 · fail 0 · skipped 3` (the
  three that need a live Postgres, which have never run). `npm run test:web` — 859 vitest + 104
  node:test, both green.
- `npm run typecheck` — clean across workspaces.
- **`npm run verify` exits 0**, observed **2026-08-19T21:38 +03:00** at `678e407`.

  **The intermediate red is kept on the record rather than tidied away.** At 21:34, `verify`
  exited 2: `typecheck:tests` failed with two errors in
  `apps/web/src/drawer/hover-row-contrast.test.tsx` — untracked, `drawer-engineer`'s, created
  after their last commit (`costUsd: null` and `traceUrl: null` against a `RunRow` declaring
  `number | undefined` and `string | undefined`). I filed it to them rather than fixing it, they
  landed it at `678e407`, and the next run was clean. Both observations are stated because a
  report invalidated by another agent landing mid-run is a known way this repo has produced false
  results in **both** directions, and a green quoted without its timestamp is the same class of
  claim as a number quoted without where it was observed.

**Falsification record.** Every plant was verified applied before the run.

| Gate | Plant | Result |
|---|---|---|
| library cron gate | corpus dir renamed | red — *"reading the wrong tree"* |
| library cron gate | `schedule: "0 6 * * 7"` in a real SKILL.md | red, naming the file |
| six-field assertion | five-field subject | red |
| dialect pin | a day-of-week both accept | red |
| library materialization | `schedule:` widened to a union | new pin red, **old pin green** |
| writer agreement | `overlap_policy` dropped from the insert | red, naming the column |
| preview rule | check disabled | 2 red |
| preview rule | every token rejected | control red |
| save guard | staleness ignored | 4 red |
| next up | three absences merged | 3 red |
| client URLs | one path hardcoded | 2 red |
| preview receipt | separator changed to a space | red *(second attempt — the first case was satisfiable by the plant)* |

No screenshot and no 1440px frame: this slice produced no user-visible surface, deliberately, and
item 1 above says why.

## Next agent

Three, in parallel, and none of them is me:

- `drawer-engineer` — the editor and the save dialog. Read
  `comms/inbox/drawer-engineer/20260819-2230-…` first; it names the three things the dialog has to
  show that are not obvious.
- `dashboards-engineer` — the "next up" strip as a `data-table`. Read
  `comms/inbox/dashboards-engineer/20260819-2234-…`.
- `runner-engineer` — §11.2 and §11.7 (accept or rename eleven codes and six routes), the
  `syncOfelia` call that now pokes a removed container, and the day-of-week fix in `cron.ts`.

Mine, next: `apps/runner/src/scheduler.ts` — the tick loop that finally calls `planTick`, and the
compose line that follows it.
