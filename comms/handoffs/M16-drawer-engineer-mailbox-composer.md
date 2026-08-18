---
agent: drawer-engineer
milestone: M16
spec: Plan §12 · §23.12 P2 · §2.3 (the console) · thread-model.md §4.1–§4.5, §10
created: 2026-08-18T20:55
status: ready-for-review
---

# M16 — the mailbox composer: two interrupt levels and a refusal

`RunConsole` was one-way. It now has a return path: a turn appended to the thread a run is
having, at a level the sender declares.

## What exists now

- `apps/web/src/drawer/threads/mailbox.ts` — the model. `ComposableLevel`, `Sender`,
  `composableLevels()`, `refusedLevels()`, `dispositionKey()`, `appendStateKey()`,
  `outcomeKeys()`, `canSend()`, `RUN_STREAM_CARRIES_THREAD_ID`. Pure, and returns
  `StringKey`s rather than sentences.
- `apps/web/src/drawer/threads/MailboxComposer.tsx` — the form.
- `apps/web/src/drawer/threads/{mailbox,MailboxComposer}.test.{ts,tsx}` — 32 tests.
- `apps/web/src/drawer/data/client.ts` — `postThreadMessage()`, path from
  `RUNNER_ROUTES.threadMessage`.
- `apps/web/src/drawer/sections/RunConsole.tsx` · `JobDrawer.tsx` — the mount.
- `apps/web/src/drawer/drawer.module.css` — `.composer*`, monochrome; **plus the five
  `token-exempt:` comments `design-system-guardian` asked for** (`apps/web/src/drawer/` can
  now leave `DATA_INK_DIRS`).
- `apps/web/src/i18n/strings.{en,ar}.ts` — 17 keys, **Arabic written, not `todo()`d**.
- `comms/specs/drawer.md` — REQ-DRW-37…41.

## The three things that are the point

**1. The third level is untypeable, not merely disabled.** `ComposableLevel` is
`Exclude<InterruptLevel,'steer'>` while `STEER_DELIVERY.supported` is `false`, and
`postThreadMessage` takes it — so no code path in this app can build the request that
would 409. A composer that offered three and caught the refusal would pass every other
test in the file; `MailboxComposer.test.tsx` asserts there is no form control anywhere
whose value is `steer`. There is no downgrade-to-note fallback and nothing for one to
catch (`thread-model.md` invariant 7).

The narrowing is **derived** from `STEER_DELIVERY`, so the day the runner can deliver a
steer the composer offers it with no edit here. A literal `false` in my file could drift.

**2. The refusal's reason is the badge's own catalogue key**, rendered `aria-hidden`
because `InterruptBadge` already announces it. Not a composer-voice sibling: that sentence
has been wrong once, and one sentence cannot drift from itself.

**3. `disposition` and `threadState` stay two facts.** `queued` and `delivered-to-run` get
different sentences and neither says "sent". Every `appendState` sentence is past tense —
this is the state read *before* the write — and a `halt` gets a fourth line saying the
move has not happened yet. Built against the corrected `api-contracts.md`; a test asserts
no state sentence contains "is now" or "has moved".

## How to use it

```tsx
<MailboxComposer threadId={threadId} send={(id, input) => postThreadMessage(project, id, input)} />
```

`threadId: null` ⇒ disabled with the reason. It does **not** collapse: collapsing is for a
frontmatter section an agent did not fill in, and an absent producer is not that.

## Contracts touched

None changed. Consumed: `thread-model.md` §4.1–4.5 §10, `api-contracts.md` thread rows,
`design-tokens.md` §11.4a. One `decision-request` filed to `runner-engineer`
(`threadId` on `SseStartData`).

## Deliberately not done

- **`threadId` is `null` on every render today, and the composer is therefore inert in the
  running app.** `SseStartData` carries no thread id, so a run on screen cannot say which
  conversation it is a turn of. `packages/contracts/src/api.ts` is `runner-engineer`'s, so
  I did not add it. **This is a pin, not a note:** `mailbox.test.ts` reads that file and
  goes red the moment `SseStartData` declares `threadId`, forcing `JobDrawer`'s
  `mailboxThreadId` to be wired in the same commit. Falsified — planting the field turned
  it red.
- **No thread id taken from a LAST RUNS row.** `GET /metrics/runs` does serve `threadId`
  and `RunRow` drops it, which is the M15 `sourceRef` drop repeating. I left it: a live
  run's composer addressed at a *previous* run's thread is the wrong conversation, and
  carrying the field with no consumer is the same defect the other way up. It belongs to
  whoever builds "the other runs of this thread".
- **No `message` SSE event.** `runner-engineer`'s question is answered in their inbox: keep
  the bracketed `token` line for M16. Cost stated there.
- **No thread transcript, no `GET /thread/:id` read, no polling for the post-halt move.**
  The composer says the move has not happened; it does not watch for it. That is the
  THREADS view's read and `sessions-relay-engineer`'s surface.
- **`payload` and `inReplyTo` are not sent.** Answering a question needs a question to
  answer, and no thread has one.
- **No `@@` confirm, no address parsing, no cost preview.** Different composer, different
  surface, different agent — I send into a thread that exists.

## Verification

Observed **2026-08-18 20:40–20:55 +03:00 on a tree three other agents are editing**
(`apps/runner/src/observability/**`, `apps/web/src/threads/**`, `apps/web/src/sessions/**`,
`comms/specs/observability.md`). Every red below is theirs and is named as such.

- `npm run test:web` — **79 files, 697 tests, all passed.**
- `npm run typecheck` · `npm run typecheck:tests` — clean.
- `npm run validate:rtl:gate` — **holding** at baseline 308. `drawer/threads` contributes
  **0** findings; the 17 new keys are catalogued in both locales.
- `npm run validate:barrel` · `validate:comms` · `validate:coverage` — pass (REQ-DRW-37…41
  resolved).
- `npm run validate:tokens` — provenance banner verbatim:
  `scanned at 2026-08-18 20:48 +03:00 · f114508 · 15 uncommitted under apps/web`.
  3 violations, **all three in `apps/web/src/threads/threads.module.css`**
  (`sessions-relay-engineer`, in flight). `verify` stops here for that reason.
  With `apps/web/src/drawer/` deleted from `DATA_INK_DIRS`, all five drawer lines come back
  **exempt** and the directory is clean — measured, and the deletion reverted.
- `npm run smoke` — 12 routes 2xx, 120 barrel modules, compile log clean.
- `npm run smoke:browser` — **3 findings, FAIL.** All three are the same
  `ws://…/ws/p/agentos/graph` handshake failure from `map/data/useGraph.ts`, on the three
  map routes only; every `/api/` call in the same report 500s, because no runner is
  running. **No finding names the drawer, the console or the composer**, and
  `/p/agentos/map/sales/account-enrichment` renders with only that one line.
  `smoke:browser:falsify` produced 13 findings including uncaught exceptions, so the
  instrument can still see one. I did **not** establish that the WS finding predates
  tonight: the only clean-tree comparison available would have meant stashing a catalogue
  file another agent is editing right now. Finding filed to `agent-library-curator` — the
  gate excuses our own `/api/` 5xx as honest absence and does not excuse the matching
  `/ws/` handshake against the same absent runner.

**Falsification — six defects planted, each verified as applied on disk before the run,
each restored after** (`scratchpad/falsify.mjs`, script kept out of the repo):

| planted | result |
|---|---|
| the composer offers a steer | RED, 3 failing |
| a halt reports the thread as moved to `waiting` | RED, 1 failing |
| `queued` and `delivered-to-run` share one sentence | RED, 2 failing |
| the composer collapses silently with no thread | RED, 2 failing |
| the refusal reason is paraphrased inline | RED, 2 failing |
| `SseStartData` grows a `threadId` | RED, 1 failing |

Two of my own assertions were vacuous and were found by being red first: `input.disabled`
does not reflect an inherited `<fieldset disabled>` (only `:disabled` matches), and a
whole-container PII assertion could not tell "the composer echoed the body into an error"
from "the composer kept the draft". Both are now scoped and commented.

## Next agent

`fidelity-qa-reviewer`. Read `apps/web/src/drawer/threads/mailbox.ts`'s header first — the
whole slice is one decision and that file states it. Then
`MailboxComposer.test.tsx`'s *"has no form control anywhere that could submit a steer"*.
