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

  it('keeps the brain count that makes the fraction auditable', () => {
    const parsed = parseGraphPayload({
      ...GRAPH_FIXTURE,
      core: { x: 0, y: 0, brainCompleteness: 0.15, brainAnswered: 3, brainTotal: 20 },
    });
    expect(parsed?.core.brainAnswered).toBe(3);
    expect(parsed?.core.brainTotal).toBe(20);
  });

  it('drops a count that cannot be true rather than repeating it in words', () => {
    const noDenominator = parseGraphPayload({
      ...GRAPH_FIXTURE,
      core: { x: 0, y: 0, brainCompleteness: 0, brainAnswered: 9 },
    });
    expect(noDenominator?.core.brainAnswered).toBeNull();
    expect(noDenominator?.core.brainTotal).toBeNull();

    const impossible = parseGraphPayload({
      ...GRAPH_FIXTURE,
      core: { x: 0, y: 0, brainCompleteness: 1, brainAnswered: 40, brainTotal: 20 },
    });
    expect(impossible?.core.brainAnswered).toBeNull();
    expect(impossible?.core.brainTotal).toBe(20);
  });
});
