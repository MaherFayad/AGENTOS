import { describe, expect, it } from 'vitest';
import { consoleReducer, decodeRunEvent, initialConsoleState, isRunActive } from './console-model';
import { frame } from './mock';

describe('consoleReducer', () => {
  it('renders the seven contract events and nothing else as a silent drop', () => {
    let state = initialConsoleState;
    state = consoleReducer(state, { type: 'connecting' });
    state = consoleReducer(state, {
      type: 'event',
      event: {
        type: 'start',
        runId: 'r1',
        agent: 'sales/account-enrichment',
        // `agentRef`/`sourceRef` became required on `SseStartData` during M15's provenance
        // work, and the test 40 lines below this one was written against the new shape while
        // this one was not. Nothing caught it: `apps/web/tsconfig.json` excluded the suite
        // and vitest does not typecheck, so this object had been failing to be a `RunEvent`
        // in silence. Surfaced the first time `tsconfig.test.json` ran.
        agentRef: 'agentos/sales/account-enrichment',
        sourceRef: `global:agents/sales/account-enrichment/SKILL.md@sha256:${'a'.repeat(64)}`,
        traceUrl: null,
        startedAt: '2026-08-15T21:00:00Z',
        tools: ['exa'],
        approvalRequired: false,
      },
      eventId: '1',
    });
    state = consoleReducer(state, { type: 'event', event: { type: 'token', text: 'Hello' }, eventId: '2' });
    state = consoleReducer(state, {
      type: 'event',
      event: { type: 'plan', summary: 'Do the work.', awaitingApproval: true },
      eventId: '3',
    });
    expect(state.phase).toBe('awaiting-approval');
    expect(isRunActive(state)).toBe(true);
    expect(state.lastEventId).toBe('3');
    expect(state.lines.some((l) => l.kind === 'notice' && l.text.includes('exa'))).toBe(true);
  });

  it('turns an unknown SSE event into a visible notice', () => {
    const state = consoleReducer(initialConsoleState, { type: 'unknown-event', name: 'whisper' });
    expect(state.lines[0]?.text).toMatch(/whisper/);
  });

  /**
   * `Plan §23.6` — the header's provenance comes off this event and nowhere else.
   *
   * `sourceRef` is the one field on `start` that says *which file actually ran*, and
   * `Plan §21.9` names the bug it exists for: running the global code-reviewer when you
   * meant the fork is a class of bug with no error message. Dropping it here would make the
   * header's answer unobtainable while looking like nothing was lost.
   */
  it('keeps which agent ran and which file won, so the header can say so', () => {
    const state = consoleReducer(initialConsoleState, {
      type: 'event',
      event: {
        type: 'start',
        runId: 'r1',
        agent: 'sales/database-mining',
        agentRef: 'agentos/sales/database-mining',
        sourceRef: `override:agents/_overrides/sales/database-mining/SKILL.md@sha256:${'c'.repeat(64)}`,
        traceUrl: null,
        startedAt: '2026-08-17T01:00:00Z',
        tools: [],
        approvalRequired: false,
      },
      eventId: '1',
    });
    expect(state.agent).toBe('sales/database-mining');
    expect(state.sourceRef).toContain('override:');

    // A reset clears it. Provenance is not something the console remembers past its run —
    // the next run resolves the cascade again and may land on a different layer.
    expect(consoleReducer(state, { type: 'reset' }).sourceRef).toBeUndefined();
  });

  it('decodes a token frame even when the body is not JSON', () => {
    expect(decodeRunEvent(frame('token', { text: 'Hi' }))).toEqual({ type: 'token', text: 'Hi' });
    expect(decodeRunEvent({ event: 'token', data: 'plain' })).toEqual({ type: 'token', text: 'plain' });
    expect(decodeRunEvent({ event: 'mystery', data: '{}' })).toBeNull();
  });
});
