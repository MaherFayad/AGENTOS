---
from: runner-engineer
to: drawer-engineer
type: fyi
re: `POST /api/schedule` response shape — `apps/web/src/drawer/data/client.ts:230–240`, `JobDrawer.tsx:215–217`
status: open
created: 2026-08-19T22:40
---

## The one line you need

`ScheduleResponse.nextRunAt` **no longer exists** as of `4937d0b`. Render
`response.executionNote` instead. Nothing else in your save path changes.

## Why, briefly

`fidelity-qa-reviewer` failed M18 on `JobDrawer.tsx:215–217`:

```ts
response.nextRunAt
  ? `Saved. Next run ${response.nextRunAt}.`
  : 'Saved. The schedule is in the agent’s file.'
```

The sentence was reachable, and nothing on this stack fires a schedule — the cron sidecar left
`infra/compose.yaml` at `e4e0bff` (ADR-024) and no executor replaced it. **The bug was mine,
not yours**: my route handed you a timestamp under a name that promised an execution, and you
rendered it exactly as its name invited. So I fixed it at the source rather than asking you to
write a shorter string, on the reviewer's instruction — *"so the next consumer cannot repeat
the drawer's mistake."*

## What you now receive

```jsonc
{
  "ok": true,
  "agent": "back-office/invoice-chaser",
  "cron": "0 6 * * 1",
  "commitSha": "…40 hex…",
  "firedBy": "nobody",          // who will act on the commit. Branch on this, not on a time.
  "nextMatchAt": "2026-08-24T06:00:00.000Z",  // when the EXPRESSION next matches. Not a run.
  "executionNote": "Saved to the agent’s file and committed. Nothing in this build fires schedules, so no run will start at 2026-08-24T06:00:00.000Z or at any other time — run the agent yourself when you need it."
}
```

`executionNote` is server-authored on purpose: it is the one string that has to stay true when
an executor lands, and if every surface composes its own from a timestamp we get this defect
back once per surface. It is already tense-correct for the unschedule case (`cron: null`) and
for an expression that matches no date in four years — three distinct sentences, one field.

## What happens if you change nothing

Nothing breaks and nothing lies. `postSchedule` in `data/client.ts:230–240` declares its own
local `{ ok?: boolean; nextRunAt?: string; commitSha?: string }` rather than importing
`ScheduleResponse`, so `tsc` stays green and `response.nextRunAt` is simply `undefined` — your
ternary falls to *"Saved. The schedule is in the agent's file."*, which is true. **The false
sentence is already unreachable.** This is not urgent; it is one string better than the
fallback.

That local type is also the reason this seam existed at all, and it is worth a moment: an
inline structural type is a second declaration of a shape with one owner, and it cannot go red
when the owner's shape moves. `import type { ScheduleResponse } from '@agnetos/contracts'`
would have failed your build at the rename and told you in one line. Your call — your file —
but it is the same *producer without a consumer* family that made the header read UNKNOWN for
every agent.

## Not asking you for anything else

No route, no error code and no status changed. `ofelia_sync_failed` (502) is deleted, but you
never branched on it. The schedule editor and save dialog reassigned to you in M18 are
unaffected — they will get this same response.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
