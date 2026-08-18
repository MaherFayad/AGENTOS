---
agent: sessions-relay-engineer
milestone: M16
spec: §3.1 · `Plan §12` · `Plan §23.5` · `Plan §23.8` · `Plan §23.11` · `Plan §23.12` P2
created: 2026-08-18T21:15
status: ready-for-review
---

# M16 — the THREADS view, the addressing composer, and §9.1 answered

## What exists now

**The ruling first, because four files cite it.**
`comms/decisions/ADR-037-session-threads-get-no-mailbox.md` — thread-model §9.1 answered
**no**, not "yes, control-only". Row claimed on BOARD before the file. The decisive reason is
not rule 5: **the runner's mailbox drain has no reach into a CLI session**, so an `ops.message`
row addressed to one would be a queue with no reader that still *looks queued* — invariant 7's
silent downgrade arriving through a different door. Rule 5 is the second reason and the first
survives without it. `0008` unchanged, `envelope.ts` untouched, no successor migration.

**The view** — `apps/web/src/threads/`

- `ThreadsView.tsx` — the fourth tab. Two groups: agent threads (honestly unreadable, below)
  and session threads, which mount `SessionsTab` unchanged. **The merge is client-side after
  decryption and can never be anything else** — a server-side list including sessions would
  have to read `encryptedMetadata` to produce one row.
- `AddressComposer.tsx` — `@agent` · `#department` · `@@fan-out` · bare, live preview,
  three interrupt levels, the `@@` confirm. Writes to `POST /api/p/:project/thread`.
- `ThreadView.tsx` — one thread, read-only, from `GET /api/p/:project/thread/:id`.
- `lib/preview.ts` · `lib/roster.ts` · `lib/detail.ts` · `lib/threadListRoute.ts` — all pure,
  all node-loadable, all the judgement. The components decide nothing.
- `threads.module.css` — three exempted copper lines, everything else monochrome.

**Routes.** `/p/:project/threads` and `/threads/:id` are real views; `ThreadsMount.tsx` and its
three catalogue keys are deleted. **`/p/:project/sessions` now redirects to `/threads`**,
forwarding `?new=1`. `/sessions/:id` is not redirected and never will be.

**Also:** the five copper lines in `sessions.module.css` carry `token-exempt:` comments
(`design-system-guardian`'s ask, answered with a measurement); `SessionsTab` lost
`spawnRequested` and its viewport-height/own-scroller layout; `comms/specs/sessions.md` gains
REQ-SES-57…63 and corrects 01 and 48.

## How to use it

```tsx
import { ThreadsView } from '@/threads/ThreadsView';   // ?new=1 → composeRequested
import { ThreadView } from '@/threads/ThreadView';     // threadId = ops.thread uuid
```

`AddressComposer` takes `roster: DepartmentRoster` as a **prop**, from
`rosterFrom(useShell().search.items, indexed)`. It does not read `useShell()` itself, so its
tests render it without the shell around it — `useProjectHref`'s own recorded reason.

## Contracts touched

- `contracts/thread-model.md` — **consumed, not edited.** §9.1's answer is ADR-037 and the
  `## Answer` on the message; moving the section from OPEN to CLOSED is
  `thread-model-engineer`'s edit and I have not made it.
- `api-contracts.md` / `packages/contracts/src/api.ts` — **consumed, not edited.** The missing
  list route is a `decision-request` to `runner-engineer`, not a line I added.
- `contracts/design-tokens.md` §8b.2 — the deny-list entry for `apps/web/src/sessions/` can now
  be deleted; measured, filed to `design-system-guardian`.
- `comms/specs/sessions.md` — mine, updated.

## Deliberately not done

- **No fetch behind the agent-thread group, and no invented route.** `runner-engineer` records
  the plural collection route as deliberately absent, so the group says it is **unreadable**
  and names *both* reasons — no route, and no database that has ever run. It is not drawn as
  an empty list, because empty is a count and this is an absence of a reading. A speculative
  `GET /api/p/:project/threads` was rejected twice over: the browser gate excuses our own
  `/api/` 5xx and explicitly keeps 404 fatal, so it would have installed a permanent excuse
  that only bites the day someone runs the gate *with* a runner up. **The claim expires by
  itself** — `threadListRoute.test.ts` goes red the day any `GET` route ends in `/thread(s)`,
  under any key name, and the failure message names the file to wire.
- **No mailbox composer in `ThreadView`.** `drawer-engineer` is building note/halt-into-a-
  running-thread in the drawer in parallel. Two composers writing to the one message route
  from two files is the shape this board has paid for four times. This view renders the
  mailbox and does not write to it.
- **No fan-out dispatch.** Grammar, parser, preview and confirm ship; the spawn path does not.
  The confirm's positive button says **"Open the thread"** and not "Start 4 runs", because it
  cannot start them — and the panel states *both* the count that would be spent and that
  nothing is spent today, since either fact alone misleads in a different direction.
- **No `steer`.** Rendered, refused, with a stated reason that is true whether or not a run is
  in flight. I did **not** branch on `STEER_DELIVERY.supported`; the refusal comes from the
  type, so the composer will be one commit late rather than start offering the level the
  moment a constant moves. Flagged to `design-system-guardian` as their call to overrule.
- **No client-side address *resolution*.** The composer previews the address **as typed**, not
  as it will resolve. `@slug` with no department costs `'unresolved'`; whether a recipient
  exists is the server's answer and arrives as a refusal, printed verbatim. Building a second
  resolver in the browser is how the parser ends up living in two places.
- **`AddressRefusal.hint` and API `hint` are rendered in English**, outside the catalogue.
  That is the existing house rule for `hint` (`sessions/types.ts`: *"shown verbatim"*), and
  rewriting the parser's sentences here would be a second copy of the contract's wording. If
  `rtl-arabic-pdpl-specialist` wants them catalogued, the strings live in
  `packages/contracts/src/threads.ts` and it is a bigger decision than this slice.
- **No mailbox depth on any row**, agent or session. For a session there is none to render
  (ADR-037); for an agent thread nothing has measured one, and `0` would be a plausible zero.
- **No count on the THREADS tab.** Agreed with `shell-navigation-engineer`. Noted for whoever
  builds the top-right slot: the useful number is the waiting-on-permission **session** count,
  which is only knowable after client-side decryption, so it must be pushed to the shell
  rather than read by it.
- **No 1440px side-by-side.** Still needs reference frames; unchanged by this slice.

## Verification

**The tree was not still and it changed the answer, so the sequence is written out rather than
summarised.** `drawer-engineer` was in flight throughout, and `agent-library-curator` was
editing `scripts/check-page-errors.mjs` *while I was running it* — at one point with a live
`// FALSIFY-PLANT` on disk. **Observed 2026-08-18 21:03–21:30 +03:00.**

- `npm run verify` — **exit 0.**
- `npm run validate:tokens`, provenance verbatim:
  `scanned at 2026-08-18 21:03 +03:00 · e8a8476 · 8 uncommitted under apps/web · checker modified under scripts`
  — **0 violations, 5 exemptions**, three of them the new copper lines in
  `threads.module.css`. Separately, with `apps/web/src/sessions/` temporarily deleted from
  `DATA_INK_DIRS`: **0 violations and all five sessions lines exempt**; `check-tokens.mjs`
  restored, `git diff --stat` clean.
- `npm run validate:coverage` — 753 requirements, 714 implemented, **769 citations resolved**,
  no FAIL in `sessions.md`.
- `npm run smoke` — **12 routes 2xx and rendered**, 120 barrel modules, compile log clean.
  `/p/agentos/sessions` passes through the new redirect and satisfies `>THREADS<`.
- `npm run smoke:browser` — **PASS at 21:30.** `12 routes loaded in a real browser · 2500ms
  settle after load · no uncaught exceptions, no console.error, no browser-level errors · 66
  backend absence(s)`. **Read the caveat, because this green is not entirely mine.** It took
  three runs and two of them were red for reasons worth writing down:
  1. **21:05 — 3 findings, all `ws://…/ws/p/agentos/graph` on the map routes.** Pre-existing,
     not from this slice, and already filed to `agent-library-curator` by `drawer-engineer`:
     the gate excused our own `/api/` 5xx and did not excuse the WebSocket handshake against
     the same absent runner. **They fixed it mid-dispatch and the fix is uncommitted in their
     tree.** If it does not land, those three come back and they are still not mine.
  2. **21:25 — a real red I caused, and it was not a defect in the code.**
     `PageNotFoundError: Cannot find module for page: /(views)/p/[project]/sessions/[id]/page`
     plus a 500 on that route — with the file present and unmodified on disk. It was a **stale
     `apps/web/.next`**, produced by several gate runs racing in one evening; `next.config.mjs`
     already documents that exact failure mode and says it looks like a code bug. `rm -rf
     apps/web/.next` and the run is clean. Recording it because the symptom is indistinguishable
     from a broken route, and the next person to see it will otherwise go looking for one.
- `npm run smoke:browser:falsify` — `uncaught exception detected: YES`,
  `console.error detected: YES`. The instrument can still go red.
- **34 new tests** across four files, all green.

**Falsification — five defects planted, each confirmed applied on disk, each reverted:**

| Planted | Result |
|---|---|
| fan-out with an uncounted roster costs `addressCost(…, 0)` | **red** — 2 tests (unit + DOM) |
| `@@` submits instead of raising the confirm | **red** — 7 tests |
| the confirm takes focus on *Open the thread* instead of *Cancel* | **red** — 1 test |
| `steer` offered as available (`aria-disabled` dropped) | **red** — 3 tests |
| the `@ts-expect-error` on `TurnCost.estimatedUsd` deleted | **red** — `typecheck:tests` exit 2, `TS2322: Type 'null' is not assignable to type 'number'` |

The last one is the answer to *"is the web suite's `@ts-expect-error` live now?"* — measured,
not assumed. Edits were made with exact-string replacement rather than line-based substitution,
because a plant that silently fails to apply is indistinguishable from a gate catching it.

**One finding about the tree rather than the code, filed to `observability-engineer`.** My
`git rm` of `ThreadsMount.tsx` landed inside **`15caa41 fix(comms): three accepted ADRs were
registered nowhere`** — a comms commit that also carries `BOARD.md` and `check-comms.mjs`.
Nothing is lost and I did not re-stage it, but that is BOARD's own *"never `git add -A`"*
happening for the second time, and the cost is not the file: it is that `git log --
ThreadsMount.tsx` now answers a question about the M16 tab slot with a sentence about the ADR
register. `690e472`, landed twenty minutes later by `agent-library-curator`, is the two-path
counter-example.

## Next agent

- **`runner-engineer`** — `comms/inbox/runner-engineer/20260818-2110-…-no-route-to-list-threads.md`.
  One question: is `GET /api/p/:project/threads` intended, or is listing deliberately not v1?
- **`thread-model-engineer`** — §9.1 is answered; the OPEN → CLOSED edit is yours. The `##
  Answer` is on the message you filed, archived under `inbox/_archive/sessions-relay-engineer/`.
- **`shell-navigation-engineer`** — your one-line change is ready: `+ New session` → `+ New`
  at `/p/:project/threads?new=1`.
- **`design-system-guardian`** — delete `apps/web/src/sessions/` from `DATA_INK_DIRS`; the
  measurement is in the answered message.
- **`fidelity-qa-reviewer`** — start with `apps/web/src/threads/lib/preview.ts` and
  `AddressComposer.test.tsx`. The two claims most worth attacking are *"no money figure can be
  rendered"* and *"no keyboard path fires the fan-out"*.
