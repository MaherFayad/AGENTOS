/**
 * A mock runner, built against the contract rather than against a guess.
 *
 * `runner-engineer` is building `POST /api/run` right now. This exists so the console can
 * be developed and tested against the exact SSE event union in
 * `comms/contracts/api-contracts.md` — and so a reviewer can watch the approval gate work
 * before the gate exists.
 *
 * IT IS NEVER THE DEFAULT TRANSPORT. It has to be passed in explicitly (tests do; the
 * drawer does not), because a fake run that looks real is precisely the "plausible fake"
 * Part VII.3 forbids.
 *
 * Owner: drawer-engineer
 */

import type { RunTransport } from './transport';
import type { SseFrame } from './sse';

export interface MockScript {
  frames: SseFrame[];
  /** Delay between frames. 0 in tests. */
  gapMs?: number;
  /** Fail the stream after this many frames, to exercise reconnect. */
  cutAfter?: number;
}

export function frame(event: string, data: unknown, id?: string): SseFrame {
  return { event, data: JSON.stringify(data), ...(id ? { id } : {}) };
}

/** A short, honest run: start -> tokens -> tool -> artifact -> done. */
export function happyPathScript(agent: string, runId = 'run_mock_1'): MockScript {
  return {
    gapMs: 0,
    frames: [
      frame('start', { runId, agent, traceUrl: 'http://langfuse.local/trace/mock' }, '1'),
      frame('token', { text: 'Reading the brief…\n' }, '2'),
      frame('tool', { name: 'exa', status: 'start' }, '3'),
      frame('tool', { name: 'exa', status: 'ok' }, '4'),
      frame('token', { text: 'Writing the summary.' }, '5'),
      frame('artifact', { path: 'out/summary.md', kind: 'md', url: '/artifacts/mock/summary.md' }, '6'),
      frame('done', { status: 'ok', costUsd: 0.42, durationMs: 18400, traceUrl: 'http://langfuse.local/trace/mock' }, '7'),
    ],
  };
}

/** `approval: required` — the run pauses at `plan` and goes no further on its own (§3.2). */
export function approvalScript(agent: string, runId = 'run_mock_2'): MockScript {
  return {
    gapMs: 0,
    frames: [
      frame('start', { runId, agent }, '1'),
      frame('token', { text: 'Drafting a plan…\n' }, '2'),
      frame('plan', { summary: 'Re-enrich 42 accounts and write the changed ones back to the CRM.' }, '3'),
    ],
  };
}

/**
 * Builds a transport from a script. Honours `signal`, and on replay uses `Last-Event-ID`
 * the way the runner promises to — frames already delivered are skipped.
 */
export function mockTransport(script: MockScript): RunTransport {
  return async (_request, { lastEventId, signal, onFrame }) => {
    const startIndex = lastEventId ? script.frames.findIndex((f) => f.id === lastEventId) + 1 : 0;
    let delivered = 0;
    for (let i = Math.max(0, startIndex); i < script.frames.length; i += 1) {
      if (signal.aborted) return;
      if (script.gapMs) await new Promise((resolve) => setTimeout(resolve, script.gapMs));
      onFrame(script.frames[i]);
      delivered += 1;
      if (script.cutAfter !== undefined && delivered >= script.cutAfter) {
        throw new Error('mock stream cut');
      }
    }
  };
}
