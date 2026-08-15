import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SSE_REPLAY_WINDOW_MS } from '@agnetos/contracts';
import { formatSse, parseLastEventId, RunStream } from '../sse.ts';

test('SSE ids are per-run sequence numbers starting at 1', () => {
  const stream = new RunStream('run-1');
  const first = stream.emit('start', {
    runId: 'run-1',
    agent: 'sales/x',
    traceUrl: null,
    startedAt: new Date().toISOString(),
    tools: ['Read'],
    approvalRequired: false,
  });
  const second = stream.emit('token', { text: 'hi' });
  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.equal(formatSse(first).startsWith('id: 1\nevent: start\n'), true);
});

test('attach replays everything after Last-Event-ID, then live events', () => {
  const stream = new RunStream('run-1');
  stream.emit('token', { text: 'a' });
  stream.emit('token', { text: 'b' });
  stream.emit('token', { text: 'c' });

  const replayed: string[] = [];
  stream.attach((chunk) => replayed.push(chunk), 1);
  assert.equal(replayed.length, 2, 'id 2 and 3, not 1');
  assert.equal(replayed[0]?.includes('event: token'), true);

  stream.emit('token', { text: 'd' });
  assert.equal(replayed.length, 3, 'live events continue after replay');
});

test('parseLastEventId accepts the header or the query fallback', () => {
  assert.equal(parseLastEventId('4', undefined), 4);
  assert.equal(parseLastEventId(undefined, '9'), 9);
  assert.equal(parseLastEventId(['3'], undefined), 3);
  assert.equal(parseLastEventId('nope', undefined), undefined);
  assert.equal(parseLastEventId('0', undefined), undefined);
});

test('a finished stream stays warm for the five-minute phone-sleep window', () => {
  const stream = new RunStream('run-1');
  stream.emit('done', { status: 'ok', costUsd: null, durationMs: 1, traceUrl: null });
  stream.end();
  assert.equal(stream.isExpired(Date.now()), false);
  assert.equal(stream.isExpired(Date.now() + SSE_REPLAY_WINDOW_MS + 1), true);
});
