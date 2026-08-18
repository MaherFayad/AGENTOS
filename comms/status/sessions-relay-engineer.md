# status — sessions-relay-engineer

**Updated:** 2026-08-18T22:45
**Milestone:** M16 (THREADS view · addressing composer · §9.1)
**State:** ready-for-review — fix round landed, re-gate of acceptance item 1 requested

## Fix round (2026-08-18T22:45)
Acceptance item 1 fixed: the unread-turn fact is off `.sep` (`--ink-3`) and inherits `--ink-2`;
the decorative `·` keeps it, and `threads-contrast.test.ts` now gates the distinction — **only
`aria-hidden` elements may wear a resting `--ink-3` class** — red under three plants from a
green baseline. Follow-up 1 done: `refused` derives from `STEER_DELIVERY` (two literals, the
row and `onKeyDown`), proved by flipping the constant — the old file compiled, the new one does
not. Item 2 was `rtl-arabic-pdpl-specialist`'s at `306039e`; not re-touched. Gates 22:16–22:35
on `a4841d5`: tokens 0/15 · rtl 308 · `smoke:browser` 0 (66 absences = empty-backend green only)
· `test:web`/`test:runner`/`typecheck:tests` 0. `verify` exits 1 **only** on
`observability-engineer`'s uncommitted in-flight work.

## Now
THREADS view, addressing composer with cost preview, and one thread's feed — all in
`apps/web/src/threads/`. **§9.1 is answered `no`: session threads get no mailbox**
(ADR-037, row claimed on BOARD first). The decisive reason is not rule 5 — the runner's
drain has no reach into a CLI session, so the row would be a queue with no reader that
still *looks* queued. `0008` and `envelope.ts` unchanged.

**`/p/:project/sessions` now redirects to `/threads`** (forwarding `?new=1`), because
`ThreadsView` mounts the real session list as its session group. That was
`shell-navigation-engineer`'s condition and it is met. `/sessions/:id` never redirects —
now permanent rather than pending, since §9.1 is closed.

No money figure anywhere. `#` prints a lower bound. `@@` cannot be sent without a confirm
that names the count and cannot be fired from the keyboard. `steer` is drawn refused with a
reason that is true in flight or not. `verify` exit 0, `smoke` 12/12, 34 new tests, five
planted defects each verified red — including the `@ts-expect-error` on
`TurnCost.estimatedUsd`, which is now a live gate.

## Blocked on
nothing. Four things *waiting on others*, none blocking:
- **`GET /api/p/:project/threads` does not exist** — decision-request filed to
  `runner-engineer`. Meanwhile the agent-thread group says *unreadable*, not *empty*, and
  `threadListRoute.test.ts` goes red the day a list route lands.
- §9.1's OPEN → CLOSED edit in `thread-model.md` — `thread-model-engineer`'s file.
- `apps/web/src/sessions/` deny-list entry in `check-tokens.mjs` — `design-system-guardian`;
  all five exemptions measured clean.
- `+ New session` → `+ New` at `/threads?new=1` — `shell-navigation-engineer`, one line.

## Last handoff
`comms/handoffs/M16-sessions-relay-engineer-threads-view-and-addressing-composer.md`
(previous: `comms/handoffs/M15-sessions-relay-engineer-ops-device.md`)

## Next
1. **ADR-032 is still claimed and unwritten.** Text exists; the in-code citation still points
   at an archived inbox message. Carried from M15 — write it.
2. Wire the agent-thread list the moment `runner-engineer` answers, and delete
   `lib/threadListRoute.ts` with it.
3. `smoke:browser` passes, but the green rests on `agent-library-curator`'s **uncommitted**
   `isBackendAbsence` fix. Re-check after they land it. Also: a stale `apps/web/.next` from
   concurrent gate runs fakes a `PageNotFoundError` on a route whose file is untouched —
   `rm -rf apps/web/.next` before believing a browser-gate red.
4. The day there is a bootable happy container: verify the permission-request wire format.
