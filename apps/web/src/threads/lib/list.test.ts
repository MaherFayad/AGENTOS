/**
 * `parseThreadList` — the four states the old "unreadable" notice collapsed, and the one
 * decision this parser exists to keep.
 *
 * REQ-SES-61. The notice this replaced said the list could not be read for two reasons; both
 * ended when `RUNNER_ROUTES.threads` landed and `ops.thread` met a running Postgres. What has
 * to survive the replacement is the reason the route was withheld for a milestone in the first
 * place: `thread-model.md` §9.6 — a thread label is a **view** concern, because deriving one
 * server-side copies the highest-PII value in the database into every list payload.
 *
 * So the load-bearing test here is not a happy path. It is the last one: a payload that
 * carries a message body must not produce a field this app can render.
 */

import { describe, expect, it } from 'vitest';
import { parseThreadList } from './list';

const row = (over: Record<string, unknown> = {}) => ({
  id: '570e7141-ec34-4526-81d7-59acab6f2170',
  kind: 'agent',
  delivery: 'direct',
  addressedTo: 'design/product-designer',
  state: 'open',
  createdBy: 'human:unattributed',
  dueAt: null,
  createdAt: '2026-08-22T10:10:54.248Z',
  messageCount: 1,
  lastActivityAt: '2026-08-22T10:10:54.255Z',
  ...over,
});

describe('parseThreadList', () => {
  it('reads the route’s own payload, shape for shape', () => {
    const parsed = parseThreadList({ threads: [row()], total: 1 });
    expect(parsed).not.toBeNull();
    expect(parsed!.total).toBe(1);
    expect(parsed!.threads[0]).toMatchObject({
      id: '570e7141-ec34-4526-81d7-59acab6f2170',
      addressedTo: 'design/product-designer',
      state: 'open',
      messageCount: 1,
    });
  });

  it('treats a project with no threads as a real zero, not a failure', () => {
    // `unknown` is not `zero` (BOARD rule 9) — and the converse matters just as much.
    // Returning null here would file a legitimate answer in the failure bucket, and the
    // view would print "can't reach the runner" over a working, empty project.
    const parsed = parseThreadList({ threads: [], total: 0 });
    expect(parsed).toEqual({ threads: [], total: 0 });
  });

  it('keeps a zero turn count rather than reading it as absent', () => {
    // The bug this pins is `value || null`: a thread created with no body has
    // messageCount 0, which is falsy and would fail the whole read.
    const parsed = parseThreadList({ threads: [row({ messageCount: 0 })], total: 1 });
    expect(parsed!.threads[0]!.messageCount).toBe(0);
  });

  it('refuses the whole read when one row is malformed, rather than dropping it', () => {
    // A list that silently skips what it could not understand is a list whose length is a
    // lie, and the length is the number a person reads first.
    expect(parseThreadList({ threads: [row(), row({ state: 'banana' })], total: 2 })).toBeNull();
    expect(parseThreadList({ threads: [row({ addressedTo: '' })], total: 1 })).toBeNull();
    expect(parseThreadList({ threads: [row({ messageCount: 1.5 })], total: 1 })).toBeNull();
  });

  it('refuses a body that is not a list at all', () => {
    for (const bad of [null, undefined, 42, 'threads', {}, { threads: {} }, { threads: [] }]) {
      expect(parseThreadList(bad)).toBeNull();
    }
  });

  it('§9.6: a message body in the payload reaches no field this app can render', () => {
    // The regression guard. If someone adds `title`/`body`/`preview` to the wire type and
    // to this parser, the list payload becomes a second copy of the highest-PII value in
    // the database — the exact objection that kept this route unbuilt through M16.
    const leaky = row({
      body: 'the sentence a person actually typed',
      title: 'derived from the first message',
      preview: 'the sentence a person actually typed',
    });
    const parsed = parseThreadList({ threads: [leaky], total: 1 });
    expect(parsed).not.toBeNull();

    const serialised = JSON.stringify(parsed);
    expect(serialised).not.toContain('the sentence a person actually typed');
    expect(serialised).not.toContain('derived from the first message');
    expect(Object.keys(parsed!.threads[0]!).sort()).toEqual([
      'addressedTo',
      'createdAt',
      'delivery',
      'id',
      'kind',
      'lastActivityAt',
      'messageCount',
      'state',
    ]);
  });
});
