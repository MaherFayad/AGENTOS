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

  it('decodes a token frame even when the body is not JSON', () => {
    expect(decodeRunEvent(frame('token', { text: 'Hi' }))).toEqual({ type: 'token', text: 'Hi' });
    expect(decodeRunEvent({ event: 'token', data: 'plain' })).toEqual({ type: 'token', text: 'plain' });
    expect(decodeRunEvent({ event: 'mystery', data: '{}' })).toBeNull();
  });
});
