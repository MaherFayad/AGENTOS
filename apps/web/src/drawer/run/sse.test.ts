import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse';

describe('createSseParser', () => {
  it('parses event / data / id frames the runner actually sends', () => {
    const parser = createSseParser();
    const frames = parser.push('id: 1\nevent: token\ndata: {"text":"Hi"}\n\n');
    expect(frames).toEqual([{ event: 'token', data: '{"text":"Hi"}', id: '1' }]);
  });

  it('holds a partial frame across chunks and flushes a trailing frame', () => {
    const parser = createSseParser();
    expect(parser.push('event: done\ndata: {"status":')).toEqual([]);
    const rest = parser.push('"ok"}\n\n');
    expect(rest).toHaveLength(1);
    expect(rest[0]?.event).toBe('done');
    expect(parser.flush()).toEqual([]);
  });

  it('ignores comment / keep-alive lines', () => {
    const parser = createSseParser();
    expect(parser.push(': keep-alive\n\n')).toEqual([]);
  });
});
