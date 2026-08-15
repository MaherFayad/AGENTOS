import { describe, expect, it } from 'vitest';
import { DORMANT_OPACITY, presentation } from './geometry';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('node presentation', () => {
  it('dims draft nodes to 45%', () => {
    const look = presentation(GRAPH_FIXTURE.nodes[0]);
    expect(look.opacity).toBe(DORMANT_OPACITY);
    expect(look.ring).toBe(false);
  });

  it('gives live jobs a copper ring', () => {
    const look = presentation(GRAPH_FIXTURE.nodes[1]);
    expect(look.ring).toBe(true);
    expect(look.opacity).toBe(1);
  });
});
