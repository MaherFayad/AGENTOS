/**
 * The console's state machine — SSE frames in, console lines + run state out.
 *
 * It renders exactly the seven events in `comms/contracts/api-contracts.md` (`start`,
 * `token`, `tool`, `plan`, `artifact`, `done`, `error`) and drops anything else with a
 * notice, because a console that silently ignores an event it doesn't know is a console
 * that lies about what the run did.
 *
 * `plan` pauses the run (§3.2 approvals). The reducer moves to `awaiting-approval` and
 * stays there until an approve/deny action arrives — the drawer cannot pretend the run is
 * still streaming while a human gate is open.
 *
 * Pure. No React, no fetch — so the interesting behaviour is testable without a DOM.
 *
 * Owner: drawer-engineer
 */

import type { RunEvent } from '../data/types';
import type { SseFrame } from './sse';

/** Past this, the oldest lines are dropped and counted (§2.3 "virtualize past ~2k lines"). */
export const MAX_LINES = 2000;

export type LineKind = 'token' | 'tool' | 'plan' | 'artifact' | 'done' | 'error' | 'notice';

export interface ConsoleLine {
  id: number;
  kind: LineKind;
  text: string;
  /** Data ink is only permitted where it carries a value (§1.3): run outcome does. */
  tone?: 'ok' | 'error' | 'pending';
  href?: string;
}

export type RunPhase = 'idle' | 'connecting' | 'streaming' | 'awaiting-approval' | 'done' | 'error';

export interface ArtifactRef {
  path: string;
  kind?: string;
  url?: string;
}

/**
 * The four outcomes `done` can carry (contract, §3.2). `denied` and `canceled` are
 * outcomes, not errors — a denied run is data, and the sentence says which happened.
 */
const DONE_TEXT: Record<'ok' | 'error' | 'denied' | 'canceled', string> = {
  ok: 'Run finished.',
  error: 'Run finished with an error.',
  denied: 'Run stopped: the plan was denied.',
  canceled: 'Run canceled.',
};

export interface ConsoleState {
  phase: RunPhase;
  runId?: string;
  /**
   * `department/agent-slug`, from `start`. Held so a consumer can tell *whose* run this
   * state describes — one `useRunStream` serves the drawer for its whole life, and a
   * finished run outlives the drawer that started it.
   */
  agent?: string;
  /**
   * `{layer}:{path}@sha256:…` from `start` — **which file actually won the cascade for this
   * run** (ADR-014 §2; `SseStartData.sourceRef`).
   *
   * Kept because the contract that emits it says the drawer header renders its layer half
   * as the provenance badge, and because *"I ran the wrong code-reviewer"* is a bug class
   * with no error message (`Plan §21.9`). It is provenance of a **run**, never of the agent:
   * `data/provenance.ts` is the only thing that reads it, and it will not attribute it to an
   * agent other than the one named in `agent` above.
   */
  sourceRef?: string;
  /** The terminal outcome from `done`. Absent until the run ends. */
  status?: 'ok' | 'error' | 'denied' | 'canceled';
  /** Present when a human denied the plan and wrote why. */
  denialNote?: string;
  traceUrl?: string;
  /** The plan text that the run is paused on, when `phase === 'awaiting-approval'`. */
  plan?: string;
  lines: ConsoleLine[];
  /** How many lines were dropped off the top. Shown, never hidden. */
  trimmed: number;
  artifacts: ArtifactRef[];
  costUsd?: number;
  durationMs?: number;
  /** Fed back as the `Last-Event-ID` header on reconnect. */
  lastEventId?: string;
  errorMessage?: string;
  retryable?: boolean;
  nextLineId: number;
}

export const initialConsoleState: ConsoleState = {
  phase: 'idle',
  lines: [],
  trimmed: 0,
  artifacts: [],
  nextLineId: 1,
};

export type ConsoleAction =
  | { type: 'reset' }
  | { type: 'connecting' }
  | { type: 'reconnecting'; attempt: number }
  | { type: 'event'; event: RunEvent; eventId?: string }
  | { type: 'unknown-event'; name: string }
  | { type: 'approval-sent'; decision: 'approve' | 'deny' }
  | { type: 'transport-error'; message: string; retryable: boolean };

function append(state: ConsoleState, line: Omit<ConsoleLine, 'id'>): ConsoleState {
  const lines = [...state.lines, { ...line, id: state.nextLineId }];
  let trimmed = state.trimmed;
  if (lines.length > MAX_LINES) {
    trimmed += lines.length - MAX_LINES;
    lines.splice(0, lines.length - MAX_LINES);
  }
  return { ...state, lines, trimmed, nextLineId: state.nextLineId + 1 };
}

/** `token` is a stream of text, not a stream of lines: append to the open token line. */
function appendToken(state: ConsoleState, text: string): ConsoleState {
  let next = state;
  const parts = text.split('\n');
  parts.forEach((part, index) => {
    const last = next.lines[next.lines.length - 1];
    const continues = index === 0 && last && last.kind === 'token';
    if (continues) {
      const lines = next.lines.slice(0, -1).concat({ ...last, text: last.text + part });
      next = { ...next, lines };
    } else if (part !== '' || index < parts.length - 1) {
      next = append(next, { kind: 'token', text: part });
    }
  });
  return next;
}

export function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case 'reset':
      return { ...initialConsoleState };

    case 'connecting':
      return { ...state, phase: 'connecting', errorMessage: undefined };

    case 'reconnecting':
      return append(
        { ...state, phase: 'connecting' },
        {
          kind: 'notice',
          tone: 'pending',
          text: `Connection dropped. Picking the run back up from where it left off (attempt ${action.attempt}).`,
        },
      );

    case 'transport-error':
      return append(
        { ...state, phase: 'error', errorMessage: action.message, retryable: action.retryable },
        { kind: 'error', tone: 'error', text: action.message },
      );

    case 'unknown-event':
      return append(state, {
        kind: 'notice',
        text: `The runner sent an event this console does not know how to render: “${action.name}”.`,
      });

    case 'approval-sent':
      // The decision is *sent*, not yet confirmed by the stream. `deny` is shown as a
      // finished run immediately because the contract says denial aborts cleanly; if the
      // runner disagrees it will say so with its own `done` or `error`, which wins.
      return append(
        {
          ...state,
          phase: action.decision === 'approve' ? 'streaming' : 'done',
          status: action.decision === 'approve' ? state.status : 'denied',
          plan: undefined,
        },
        {
          kind: 'notice',
          tone: action.decision === 'approve' ? 'ok' : 'error',
          text: action.decision === 'approve' ? 'Plan approved. Resuming.' : 'Plan denied. The run was stopped.',
        },
      );

    case 'event': {
      const withId = action.eventId ? { ...state, lastEventId: action.eventId } : state;
      const event = action.event;
      switch (event.type) {
        case 'start': {
          // `tools[]` is the resolved allowlist — exactly `wired_into`, never a superset
          // (§3.2). Printing it makes the security boundary something a person can see
          // rather than something a document claims.
          const started = append(
            {
              ...withId,
              phase: 'streaming',
              runId: event.runId,
              traceUrl: event.traceUrl ?? undefined,
              // Both are read straight off the event and neither is defaulted: an older
              // runner that does not send them leaves the header honestly unknown rather
              // than inheriting whatever the previous run said.
              agent: event.agent,
              sourceRef: event.sourceRef,
            },
            { kind: 'notice', text: `Run ${event.runId} started.` },
          );
          const tools = Array.isArray(event.tools) ? event.tools : [];
          return append(started, {
            kind: 'notice',
            text: tools.length > 0 ? `Allowed to use: ${tools.join(', ')}.` : 'Allowed to use: no tools at all.',
          });
        }
        case 'token':
          return appendToken({ ...withId, phase: withId.phase === 'awaiting-approval' ? 'awaiting-approval' : 'streaming' }, event.text);
        case 'tool': {
          const mark = event.status === 'ok' ? '✓' : event.status === 'error' ? '✕' : '·';
          const tone = event.status === 'ok' ? 'ok' : event.status === 'error' ? 'error' : 'pending';
          return append(withId, { kind: 'tool', tone, text: `${mark} ${event.name}` });
        }
        case 'plan':
          // `awaitingApproval` is the gate, not the presence of a plan: an agent with
          // `approval: none` still announces what it is about to do, and pausing on that
          // would strand every unattended run behind a button nobody is there to press.
          return event.awaitingApproval
            ? append(
                { ...withId, phase: 'awaiting-approval', plan: event.summary },
                { kind: 'plan', tone: 'pending', text: event.summary },
              )
            : append(withId, { kind: 'plan', text: event.summary });
        case 'artifact':
          return append(
            { ...withId, artifacts: [...withId.artifacts, { path: event.path, kind: event.kind, url: event.url }] },
            { kind: 'artifact', text: event.path, href: event.url },
          );
        case 'done':
          return append(
            {
              ...withId,
              phase: 'done',
              status: event.status,
              costUsd: event.costUsd ?? undefined,
              durationMs: event.durationMs,
              traceUrl: event.traceUrl ?? withId.traceUrl,
              denialNote: event.denialNote,
            },
            {
              kind: 'done',
              tone: event.status === 'ok' ? 'ok' : event.status === 'error' ? 'error' : 'pending',
              text: DONE_TEXT[event.status] + (event.denialNote ? ` ${event.denialNote}` : ''),
            },
          );
        case 'error':
          // `hint` is written for a human on a phone, so it is shown verbatim and next to
          // the message rather than folded away behind a details toggle.
          return append(
            { ...withId, phase: 'error', errorMessage: event.message, retryable: event.retryable },
            { kind: 'error', tone: 'error', text: [event.message, event.hint].filter(Boolean).join(' ') },
          );
        default: {
          const _exhaustive: never = event;
          void _exhaustive;
          return withId;
        }
      }
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

/** True while the run owns the console — the drawer keeps it on screen. */
export function isRunActive(state: ConsoleState): boolean {
  return state.phase === 'connecting' || state.phase === 'streaming' || state.phase === 'awaiting-approval';
}

const KNOWN: RunEvent['type'][] = ['start', 'token', 'tool', 'plan', 'artifact', 'done', 'error'];

/**
 * SSE frame -> typed run event. Returns null for a frame we cannot read; the caller turns
 * that into a visible notice rather than dropping it.
 */
export function decodeRunEvent(frame: SseFrame): RunEvent | null {
  if (!KNOWN.includes(frame.event as RunEvent['type'])) return null;
  let payload: unknown = {};
  if (frame.data !== '') {
    try {
      payload = JSON.parse(frame.data);
    } catch {
      // `token` is the one event where a non-JSON body is worth rescuing: it is text.
      if (frame.event === 'token') return { type: 'token', text: frame.data };
      return null;
    }
  }
  if (typeof payload !== 'object' || payload === null) return null;
  return { ...(payload as object), type: frame.event } as RunEvent;
}
