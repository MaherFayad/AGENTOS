'use client';

/**
 * The hook that owns a run: start it, stream it, survive a dropped connection, and hold
 * the approval gate open when the runner asks for one (§3.2).
 *
 * Reconnect policy comes from the contract: "reconnect with `Last-Event-ID`; the runner
 * replays from its buffer for 5 minutes". So a retry is not a fresh run — it is the same
 * run, resumed, and the console says so out loud.
 *
 * Owner: drawer-engineer
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { postApproval } from '../data/client';
import {
  consoleReducer,
  decodeRunEvent,
  initialConsoleState,
  isRunActive,
  type ConsoleState,
} from './console-model';
import { fetchRunTransport, TransportError, type RunRequest, type RunTransport } from './transport';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 800;

export interface UseRunStream {
  state: ConsoleState;
  active: boolean;
  start: (request: RunRequest) => void;
  cancel: () => void;
  decide: (decision: 'approve' | 'deny') => Promise<void>;
  reset: () => void;
}

export interface UseRunStreamOptions {
  /** Swap in `mockTransport(...)` in tests. Production always gets the fetch transport. */
  transport?: RunTransport;
  maxRetries?: number;
}

export function useRunStream(options: UseRunStreamOptions = {}): UseRunStream {
  const transport = options.transport ?? fetchRunTransport;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  const [state, dispatch] = useReducer(consoleReducer, initialConsoleState);
  const abortRef = useRef<AbortController | null>(null);
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const runIdRef = useRef<string | undefined>(undefined);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (request: RunRequest, attempt: number): Promise<void> => {
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch(attempt === 0 ? { type: 'connecting' } : { type: 'reconnecting', attempt });

      try {
        await transport(request, {
          lastEventId: lastEventIdRef.current,
          // Present only after `start`: a retry before that is a run that never began, so
          // re-POSTing is correct. After it, this forces the GET re-attach and there is
          // never a second run. See run/transport.ts.
          runId: runIdRef.current,
          signal: controller.signal,
          onFrame: (frame) => {
            if (frame.id) lastEventIdRef.current = frame.id;
            const event = decodeRunEvent(frame);
            if (!event) {
              dispatch({ type: 'unknown-event', name: frame.event });
              return;
            }
            if (event.type === 'start') runIdRef.current = event.runId;
            if (event.type === 'done' || event.type === 'error') finishedRef.current = true;
            dispatch({ type: 'event', event, eventId: frame.id });
          },
        });
        // A stream that ends without `done` and without an approval gate is a drop.
        if (!finishedRef.current && !controller.signal.aborted && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * (attempt + 1)));
          if (!mountedRef.current || controller.signal.aborted) return;
          await run(request, attempt + 1);
        }
      } catch (error) {
        if (controller.signal.aborted || !mountedRef.current) return;
        const retryable = error instanceof TransportError ? error.retryable : true;
        const message =
          error instanceof TransportError
            ? [error.message, error.hint].filter(Boolean).join(' ')
            : 'The run stream failed.';
        if (retryable && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * (attempt + 1)));
          if (!mountedRef.current) return;
          await run(request, attempt + 1);
          return;
        }
        dispatch({ type: 'transport-error', message, retryable });
      }
    },
    [transport, maxRetries],
  );

  const start = useCallback(
    (request: RunRequest) => {
      abortRef.current?.abort();
      lastEventIdRef.current = undefined;
      runIdRef.current = undefined;
      finishedRef.current = false;
      dispatch({ type: 'reset' });
      void run(request, 0);
    },
    [run],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'reset' });
  }, []);

  const decide = useCallback(async (decision: 'approve' | 'deny') => {
    const runId = runIdRef.current;
    if (!runId) return;
    try {
      await postApproval(runId, decision);
      dispatch({ type: 'approval-sent', decision });
    } catch (error) {
      dispatch({
        type: 'transport-error',
        message: error instanceof Error ? error.message : 'The decision could not be sent.',
        retryable: true,
      });
    }
  }, []);

  return { state, active: isRunActive(state), start, cancel, decide, reset };
}
