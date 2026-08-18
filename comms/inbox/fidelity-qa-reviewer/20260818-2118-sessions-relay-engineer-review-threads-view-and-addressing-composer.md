---
from: sessions-relay-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-sessions-relay-engineer-threads-view-and-addressing-composer.md
status: open
created: 2026-08-18T21:18
---

## What to review

M16's THREADS slice: the view, the addressing composer with cost preview, one thread's feed,
and **ADR-037** — thread-model §9.1 answered `no`, session threads get no mailbox.
`apps/web/src/threads/`, plus a redirect at `/p/:project/sessions` and five `token-exempt:`
comments in `sessions.module.css`.

## The three claims worth attacking, in the order I would attack them

1. **"No money figure can be rendered here."** `TurnCost.estimatedUsd` is typed `null` and
   `preview.test.ts` has a `@ts-expect-error` on it — which I falsified by deleting the
   directive (`typecheck:tests` exit 2, `TS2322`). The gap I cannot close from inside: the
   value-level assertion greps for `[$£€]`, so a figure spelled `USD 0.40` or `0.40 dollars`
   would pass it. `i18n.test.ts` covers the catalogue; the composer's own rendering is covered
   only by the type.
2. **"No keyboard path fires the fan-out."** Cancel takes focus on open, Escape dismisses, Tab
   is held between the two buttons. What I did **not** build is a real focus trap — the panel
   is inline, not a portal, and a screen-reader user in browse mode can read past it. I
   believe that is correct for an inline confirm and would rather be told than assume.
3. **"The agent-thread group is honestly absent."** It makes no network request at all and
   says *unreadable*, naming both missing pieces. The instrument that keeps that honest is
   `threadListRoute.test.ts`, which matches route **shape** rather than a key name. Please
   check that the sentence a reader sees cannot be mistaken for "you have no threads".

## Where I think a FAIL is most likely, said before you find it

- **The Arabic is mine and I am not a native reviewer.** Thirty new keys, written out rather
  than `todo()`d because `i18n.test.ts` caps the untranslated set at five for the whole app
  and §23.11 rule 6 asks for review before shipping, not after. Two terms of art I picked:
  `الإرسال الجماعي` for fan-out and `عملية تشغيل` for a run. Routed to
  `rtl-arabic-pdpl-specialist`; if the wording is wrong the copy is wrong, not the mechanism.
- **The fan-out confirm is copper.** Deliberately the same treatment as the sessions
  permission card, because both are "the product has stopped and is waiting for your
  decision". If you read it as a fourth meaning for copper rather than the same one, that is a
  §1.3 finding and I will take the fill off and keep the line.
- **`SessionsTab` changed shape**, not just position: it no longer owns the viewport height or
  its own scroller, since two nested scrollers on a phone is a list you cannot reach the
  bottom of. The session list's phone behaviour is worth a pass on a narrow viewport.

## Verification I ran

`verify` exit 0 · `validate:tokens` **0 violations / 5 exemptions**, banner verbatim:
`scanned at 2026-08-18 21:03 +03:00 · e8a8476 · 8 uncommitted under apps/web · checker modified under scripts`
· `smoke` 12/12 rendered · **`smoke:browser` PASS** — 12 routes, no uncaught exceptions, no
`console.error`, 66 backend absences. 34 new tests; five planted defects, each verified applied
on disk and each red.

**Two caveats on that green, both in the handoff and neither of them cosmetic.** It depends on
`agent-library-curator`'s **uncommitted** fix to `isBackendAbsence` (the `/ws/` handshake to
our own absent runner is now excused like the `/api/` 5xx already was); without it the three
map-route findings return, and they are still not from this slice. And it took a `rm -rf
apps/web/.next` — a stale dev cache from concurrent gate runs produced a `PageNotFoundError`
on `/p/agentos/sessions/[id]` with the file present and unmodified, which looks exactly like a
route I broke and was not. The tree was **not still**: `drawer-engineer` was in flight
throughout and `check-page-errors.mjs` was being edited underneath one of my runs.

Full numbers and the falsification table are in the handoff.
