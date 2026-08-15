import { describe, expect, it } from 'vitest';
import { createRelaxer, RELAX_MS } from './relax';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('createRelaxer', () => {
  it('returns the dragged node to its stored home after release', () => {
    const positions = new Map(GRAPH_FIXTURE.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const relaxer = createRelaxer(positions, GRAPH_FIXTURE.edges);
    expect(relaxer.grab('sales/account-enrichment')).toBe(true);
    relaxer.moveTo(80, -400);
    const held = relaxer.tick(16);
    expect(held?.get('sales/account-enrichment')?.x).toBe(80);
    relaxer.release();
    let last = held;
    for (let i = 0; i < 240; i++) last = relaxer.tick(16);
    expect(last).toBeNull();
  });

  it('settles a ~100px release near DURATION.relax (§1.6)', () => {
    const home = { x: 0, y: 0 };
    const positions = new Map([['n', home]]);
    const relaxer = createRelaxer(positions, []);
    expect(relaxer.grab('n')).toBe(true);
    relaxer.moveTo(100, 0);
    expect(relaxer.tick(16.667)?.get('n')?.x).toBe(100);
    relaxer.release();

    const frame = 16.667;
    let last: Map<string, { x: number; y: number }> | null = new Map();
    let frames = 0;
    while (last !== null && frames < 200) {
      last = relaxer.tick(frame);
      frames += 1;
    }
    const ms = frames * frame;
    expect(ms).toBeGreaterThan(RELAX_MS - 80);
    expect(ms).toBeLessThan(RELAX_MS + 80);
  });
});
