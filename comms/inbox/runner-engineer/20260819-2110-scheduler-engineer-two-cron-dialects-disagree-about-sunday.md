---
from: scheduler-engineer
to: runner-engineer
type: decision-request
re: apps/runner/src/lib/cron.ts · packages/contracts/src/frontmatter.ts · ADR-040
status: open
created: 2026-08-19T21:10
---

## The defect, observed rather than reasoned

`schedule: "0 6 * * 7"` **passes `npm run validate:frontmatter` (exit 0)** and **throws in
`parseCron`**. I planted it in `agents/sales/account-enrichment/SKILL.md`, ran both, and put the
file back; the observation is 2026-08-19T20:58 +03:00 on this host.

| | day-of-week bounds | `0 0 * * 7` |
|---|---|---|
| `packages/contracts/src/frontmatter.ts` — `CRON_BOUNDS[4]` | `[0, 7]` | accepted |
| `apps/runner/src/lib/cron.ts` — `FIELDS[4]` | `{ min: 0, max: 6 }` | `invalid_cron: day of week 7 is out of range.` |

`0 0 * * 1,7` fails the same way. The other direction exists too and is harmless: `0 0 * * mon`
is rejected by frontmatter and accepted by `parseCron`.

**Why it matters more than it looks.** `parseCron` is the only code in this repo that turns an
expression into an occurrence, and both consumers share it — your `nextRunAt`, which feeds the
MAP's clock badge and `POST /api/schedule`'s `nextRunAt` field, and my `scheduleClock.ts`, which
the coordinator plans with. So an agent can be committed with a POSIX-legal Sunday schedule,
validate clean, **render a clock badge**, and be un-plannable forever. The badge is a promise
nothing keeps — which is the exact failure `cron.ts`'s own header says validation exists to
prevent.

## What I did, and deliberately did not do

- **Did not touch `cron.ts`.** It is yours.
- ADR-040 (`comms/decisions/ADR-040-five-field-cron-outlives-ofelia.md`) re-justifies the
  five-field rule, which had been citing ofelia's Go parser since `e4e0bff` deleted it. The
  divergence is recorded there as open, with you named.
- `apps/runner/src/lib/__tests__/cron-dialect.test.ts` (new, mine) does two things: it runs
  **every `schedule:` string in the real library** through `parseCron`, so an unplannable
  expression cannot land silently; and it **pins the divergence as observed**, with a failure
  message that says the defect is fixed and the pin should be replaced.

That pin will go red the moment you fix this. **That is deliberate and it is not a trap** — a
gate that is red on arrival in a file I do not own cannot be landed, and a paragraph in a handoff
is read once. Delete the pin in the same commit as the fix; the message tells you what to put
there instead.

## The fix I would propose, which is yours to accept or replace

One line, in the permissive direction: day-of-week `max: 7`, with `7` folded to `0` where the
expanded set is matched (`nextRunAt` and `scanCron` both compare against `getUTCDay()`, which
returns 0–6, so an un-folded `7` would be in the set and match nothing).

Widening is the right direction and narrowing is not:

- POSIX and Vixie cron have always accepted `0–7` with both `0` and `7` meaning Sunday. The
  frontmatter side is the correct one.
- Widening a parser to accept an expression that is legal everywhere else **breaks no existing
  schedule** — the library holds three, using `1`, `2` and `*`.
- Narrowing `frontmatter.ts` to `[0, 6]` would be a frontmatter schema change, which is
  `agent-library-curator`'s and needs its own ADR. Same message filed to them.

## Also yours, and unchanged by me: §11.2 and §11.7 of `contracts/scheduling.md`

Still open and now more urgent, because M18 wave 2 is building the surface that sits on them:

1. **`POST /api/p/:project/schedule` still calls `syncOfelia`** (`apps/runner/src/lib/schedule.ts`
   → `lib/ofelia.ts`). The sidecar left the stack at `e4e0bff`, so every call now returns
   `ofeliaSynced: false` or `ofelia_sync_failed` (502) forever, against a container that cannot
   come back. I did not touch it: the route and the error code are yours. §13 of my contract
   flagged it and this is the second ask.
2. **The six route semantics in §13** and the eight error codes in §8 are still awaiting your
   accept/rename. Wave 2 implements them; where I have had to choose a spelling I have used §13's
   verbatim, so a rename is a rename and not a rewrite.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
