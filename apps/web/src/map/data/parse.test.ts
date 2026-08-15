import { describe, expect, it } from 'vitest';
import { parseGraphPayload } from './parse';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('parseGraphPayload', () => {
  it('returns null for garbage rather than inventing a map', () => {
    expect(parseGraphPayload(null)).toBeNull();
    expect(parseGraphPayload({})).toBeNull();
    expect(parseGraphPayload({ version: 'x' })).toBeNull();
  });

  it('round-trips a real payload and keeps the stored counts', () => {
    const parsed = parseGraphPayload(GRAPH_FIXTURE);
    expect(parsed).not.toBeNull();
    expect(parsed?.nodes).toHaveLength(GRAPH_FIXTURE.nodes.length);
    expect(parsed?.departments[0]?.liveCount).toBe(1);
    expect(parsed?.departments[0]?.totalCount).toBe(1);
    expect(parsed?.core.brainCompleteness).toBe(0);
  });

  it('clamps brainCompleteness to 0…1', () => {
    const parsed = parseGraphPayload({
      ...GRAPH_FIXTURE,
      core: { x: 0, y: 0, brainCompleteness: 4 },
    });
    expect(parsed?.core.brainCompleteness).toBe(1);
  });
});
