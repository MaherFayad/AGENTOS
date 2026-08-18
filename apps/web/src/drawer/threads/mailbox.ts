/**
 * The mailbox composer's model — `Plan §12` · `§23.12 P2` · `thread-model.md` §4.1–§4.5.
 *
 * Pure. No React, no fetch, and **no sentences**: every user-facing string is a
 * `StringKey` this module returns and the component looks up, so `check-rtl` can see
 * all of it and a translator can reach all of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * M16 SHIPS TWO INTERRUPT LEVELS AND A REFUSAL, AND THE REFUSAL IS A TYPE
 *
 * `note` and `halt` are built. `steer` is **refused** — `interrupt_not_deliverable`
 * (409), whether or not a run is in flight — because `createSdkSession` drives the
 * Agent SDK with a *string* prompt and injecting another user turn needs its
 * streaming-input mode, which has never been exercised here: zero runs have executed,
 * and the first thing that would exercise it is a paid run.
 *
 * So this module does not offer three levels and handle a 409. **It offers two, and
 * the third is untypeable**: `ComposableLevel` excludes `steer` while
 * `STEER_DELIVERY.supported` is `false`, so `postThreadMessage(..., {interrupt:
 * 'steer'})` does not compile and no code path in this app can produce the refusal.
 * A control that errors on submit is a control that was offered; this one is not.
 *
 * The narrowing is **derived, never declared**. `STEER_DELIVERY` is
 * `design-system-guardian`'s mirror of the runner's `MID_RUN_STEER.supported`, tested
 * against `apps/runner/src/lib/mailbox.ts` in both directions — so the day the runner
 * can deliver a steer, `composableLevels()` offers it and `ComposableLevel` widens,
 * in the same commit, with no edit here. A literal `false` written into this file
 * could drift; a derivation cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A QUEUED STEER WOULD BE WORSE THAN A REFUSED ONE
 *
 * `thread-model.md` invariant 7: a human who steered and was silently queued as a
 * note believes they changed course, and nothing did. That is the one behaviour the
 * contract forbids outright, and it is the behaviour a well-meant `catch (409) → send
 * as note` fallback produces. There is no such fallback here and there is nothing for
 * one to catch.
 *
 * A `note` **is** still delivered, and the runner says how: `queued` (the mailbox
 * holds it; the thread's next run reads it through history seeding) or
 * `delivered-to-run` (a run is in flight and it went to that run's drain). Two
 * different facts, two different sentences — `dispositionKey`.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/thread-model.md §4.1–§4.5,
 * comms/contracts/api-contracts.md (thread rows)
 */

import {
  INTERRUPT_LEVELS,
  type InterruptLevel,
  type PostThreadMessageResponse,
  type ThreadState,
} from '@agnetos/contracts';
import type { StringKey } from '@/i18n';
import { STEER_DELIVERY } from '../primitives';

/**
 * The levels a person may actually pick, as a type.
 *
 * `Exclude<InterruptLevel, 'steer'>` today; plain `InterruptLevel` the moment
 * `STEER_DELIVERY.supported` becomes `true`. Nothing in this file has to change for
 * that to happen, which is the point — the widening lands with whatever proves a
 * steer works, and not one commit before.
 */
export type ComposableLevel = typeof STEER_DELIVERY.supported extends true
  ? InterruptLevel
  : Exclude<InterruptLevel, 'steer'>;

const isComposable = (level: InterruptLevel): level is ComposableLevel =>
  level !== 'steer' || STEER_DELIVERY.supported;

/**
 * The levels the composer offers, in escalation order, filtered from the contract's
 * own list rather than typed out here. A level added to `INTERRUPT_LEVELS` appears
 * without this file being edited; a level the runner cannot deliver never appears.
 */
export const composableLevels = (): ComposableLevel[] => INTERRUPT_LEVELS.filter(isComposable);

/**
 * The levels this build presents as **refused**, with a stated reason — not offered,
 * not disabled-but-submittable, not silently absent.
 *
 * Absent from the composer entirely would also be wrong: a reader who knows the three
 * levels exist and sees two would conclude the third is coming, or that they missed
 * it. `thread-model.md` §4.2 lists three and this build honours two, so the third is
 * drawn and the reason is said.
 */
export const refusedLevels = (): InterruptLevel[] =>
  INTERRUPT_LEVELS.filter((level) => !isComposable(level));

/** The level a fresh composer starts on: the cheapest, least disruptive one. */
export const DEFAULT_LEVEL: ComposableLevel = 'note';

/** What the composer hands the route. `interrupt` is narrowed, so a steer cannot be built. */
export interface SendInput {
  body: string;
  interrupt: ComposableLevel;
}

/**
 * How the composer reaches the route, injected rather than imported.
 *
 * It lives in this `.ts` module and not beside the component for two reasons. It is model
 * — the component renders, it does not know about projects or paths — and, second,
 * `check-rtl`'s copy scan reads `=> Promise<T>` inside a `.tsx` file as a JSX text node
 * (the `>text<` shape), so the same declaration there is a false `hardcoded-string`
 * finding on the word "Promise". Reported to `rtl-arabic-pdpl-specialist`; moving the type
 * to where it belonged anyway is not a workaround for it.
 */
export type Sender = (threadId: string, input: SendInput) => Promise<PostThreadMessageResponse>;

/**
 * **Does the run stream say which thread a run is a turn of? It does not.**
 *
 * `POST /api/p/:project/run` opens or continues a thread for every run
 * (`runService.ts` step 0b) — but `SseStartData` carries `runId`, `agent`, `agentRef`,
 * `sourceRef`, `traceUrl`, `startedAt`, `tools` and `approvalRequired`, and **no
 * `threadId`**. So a run on screen cannot say which conversation it belongs to, and
 * the drawer has no address to send a note to while one streams.
 *
 * That is a missing producer, not a missing consumer, so it is not fixed here:
 * `packages/contracts/src/api.ts` is `runner-engineer`'s and a contract has one owner.
 * A `decision-request` is filed.
 *
 * **This constant is a two-way pin, not a note.** `mailbox.test.ts` reads
 * `packages/contracts/src/api.ts` and fails if `SseStartData` ever declares
 * `threadId` while this still says `false` — so the day the producer lands, the
 * wiring that consumes it is a build failure away, rather than a producer nobody
 * connected. M15 shipped `sourceRef` on the runner while this drawer's type dropped
 * it, and the header read SOURCE UNKNOWN for every agent with nothing red anywhere;
 * this is that lesson written as a gate instead of a paragraph.
 */
export const RUN_STREAM_CARRIES_THREAD_ID = false;

/** Where the runner says the message went. `api-contracts.md`, `PostThreadMessageResponse`. */
export type Disposition = 'queued' | 'delivered-to-run';

/**
 * `queued` and `delivered-to-run` are the runner's own words for two different
 * things, and the composer must not blur them into "sent".
 *
 * There is deliberately no third value and no key for one: injecting a turn into a
 * live SDK session is not built, so no response can claim it happened.
 */
export const dispositionKey = (disposition: Disposition): StringKey =>
  disposition === 'queued'
    ? 'threads.mailbox.disposition.queued'
    : 'threads.mailbox.disposition.deliveredToRun';

const APPEND_STATE: Readonly<Record<ThreadState, StringKey>> = {
  open: 'threads.mailbox.appendState.open',
  running: 'threads.mailbox.appendState.running',
  waiting: 'threads.mailbox.appendState.waiting',
  closed: 'threads.mailbox.appendState.closed',
  failed: 'threads.mailbox.appendState.failed',
};

/**
 * The thread's state **as at the append** — read before the message was written and
 * returned unchanged by it.
 *
 * Every sentence in `APPEND_STATE` is in the past tense, and that is the whole
 * correction: `api-contracts.md` used to say a halt moves the thread to `waiting`,
 * and the service returns the state as at the append. The doc was wrong, the code was
 * right, and the composer's author — who has only the contract — is exactly the
 * reader it would have misled. A composer rendering "stopping" or "now waiting" off
 * this field renders a state the runner has not reached.
 */
export const appendStateKey = (state: ThreadState): StringKey => APPEND_STATE[state];

export interface SendOutcome {
  disposition: Disposition;
  threadState: ThreadState;
  /** What the sender declared. Never inferred from context (`thread-model.md` §4.2). */
  interrupt: ComposableLevel;
}

/**
 * What to tell the sender, in order, after a message lands.
 *
 * Three sentences always, four for a halt. The fourth is not decoration: a halt is
 * the one level whose visible effect arrives *later than the response*, so without it
 * a reader sees `running` beside a halt and concludes the halt did not take.
 */
export function outcomeKeys(outcome: SendOutcome): StringKey[] {
  const keys: StringKey[] = [
    dispositionKey(outcome.disposition),
    appendStateKey(outcome.threadState),
    'threads.mailbox.appendStateCaveat',
  ];
  if (outcome.interrupt === 'halt') keys.push('threads.mailbox.haltNotYetMoved');
  return keys;
}

/**
 * Is this body sendable?
 *
 * The only client-side rule, and it is about emptiness rather than content: the body
 * is free text a person typed, which is the highest-PII value in the product
 * (`thread-model.md` §7). Nothing here inspects it, trims it into a preview, or puts
 * it in a message the UI later shows — a body inside an error string leaks past every
 * key-based redactor (BRIEF, the flattening finding).
 */
export const canSend = (body: string): boolean => body.trim().length > 0;
