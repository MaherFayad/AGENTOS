import { describe, expect, it } from 'vitest';
import { buildMatrix, cellCounts, isEmptyCell, phaseProgress, tierCount } from './matrix';
import { COL_COUNT, PHASE_ORDER, PROGRESS_SEGMENTS, ROW_COUNT, TIER_ORDER } from './taxonomy';
import { emptyDepartmentAgents, designAgents } from './__fixtures__/agents';
import type { ChartAgent } from '../types';

describe('buildMatrix', () => {
  const matrix = buildMatrix(designAgents);

  it('is exactly 3 tiers × 4 phases (REQ-CHT-13)', () => {
    expect(ROW_COUNT).toBe(3);
    expect(COL_COUNT).toBe(4);
    expect(matrix.cells).toHaveLength(3);
    for (const row of matrix.cells) expect(row).toHaveLength(4);
  });

  it('orders rows by autonomy climb and columns by rollout order', () => {
    expect(TIER_ORDER).toEqual(['human-led', 'assisted', 'autonomous']);
    expect(PHASE_ORDER).toEqual(['1-foundation', '2-capture', '3-generate', '4-orchestrate']);
    expect(matrix.cells.map((r) => r[0].tier)).toEqual(TIER_ORDER);
    expect(matrix.cells[0].map((c) => c.phase)).toEqual(PHASE_ORDER);
  });

  it('places every agent in exactly one cell', () => {
    const placed = matrix.cells.flat().flatMap((c) => c.agents.map((a) => a.slug));
    expect(placed).toHaveLength(designAgents.length);
    expect(new Set(placed).size).toBe(designAgents.length);
  });

  it('puts each agent at its own tier × phase', () => {
    for (const cell of matrix.cells.flat()) {
      for (const agent of cell.agents) {
        expect(agent.tier).toBe(cell.tier);
        expect(agent.phase).toBe(cell.phase);
      }
    }
  });

  it('sorts cards inside a cell by name, so the board does not reshuffle per load', () => {
    const reversed = buildMatrix([...designAgents].reverse());
    expect(cellCounts(reversed)).toEqual(cellCounts(matrix));
    const names = (m: typeof matrix) => m.cells.flat().flatMap((c) => c.agents.map((a) => a.name));
    expect(names(reversed)).toEqual(names(matrix));
  });

  it('drops agents whose tier or phase is outside the frontmatter union', () => {
    const rogue = { ...designAgents[0], slug: 'design/rogue', tier: 'wishful' } as unknown as ChartAgent;
    expect(buildMatrix([...designAgents, rogue]).total).toBe(designAgents.length);
  });

  it('derives the row-header job counts (REQ-CHT-15)', () => {
    expect(matrix.tierCounts).toEqual([2, 3, 7]);
    expect(tierCount('autonomous', designAgents)).toBe(7);
    expect(matrix.tierCounts.reduce((a, b) => a + b, 0)).toBe(matrix.total);
  });

  it('leaves the unstaffed tier × phase combinations empty (REQ-CHT-32)', () => {
    const empties = matrix.cells.flat().filter(isEmptyCell);
    expect(empties.map((c) => [c.tier, c.phase])).toEqual([
      ['human-led', '2-capture'],
      ['human-led', '4-orchestrate'],
      ['assisted', '1-foundation'],
      ['assisted', '4-orchestrate'],
    ]);
  });

  it('renders an unstaffed department as a full grid of empty cells, not a fake one', () => {
    const empty = buildMatrix(emptyDepartmentAgents);
    expect(empty.total).toBe(0);
    expect(empty.cells.flat().every(isEmptyCell)).toBe(true);
    expect(empty.cells.flat()).toHaveLength(12);
  });
});

describe('phaseProgress', () => {
  it('derives 4-segment dashes from the autonomy mix of the phase (REQ-CHT-18)', () => {
    const matrix = buildMatrix(designAgents);
    expect(matrix.phaseProgress.map((p) => p.filled)).toEqual([3, 3, 2, 4]);
    expect(matrix.phaseProgress.map((p) => p.jobs)).toEqual([3, 3, 4, 2]);
  });

  it('fills all four segments when every job in the phase is autonomous', () => {
    const all = designAgents.filter((a) => a.phase === '4-orchestrate');
    expect(phaseProgress('4-orchestrate', all).filled).toBe(PROGRESS_SEGMENTS);
  });

  it('fills none when a phase has no jobs — honestly "not started"', () => {
    expect(phaseProgress('1-foundation', [])).toEqual({ phase: '1-foundation', jobs: 0, filled: 0 });
  });

  it('fills none when every job in the phase is still human-led', () => {
    const humanOnly = designAgents
      .filter((a) => a.phase === '1-foundation')
      .map((a) => ({ ...a, tier: 'human-led' as const }));
    expect(phaseProgress('1-foundation', humanOnly).filled).toBe(0);
  });

  it('never exceeds the segment count', () => {
    for (const p of buildMatrix(designAgents).phaseProgress) {
      expect(p.filled).toBeGreaterThanOrEqual(0);
      expect(p.filled).toBeLessThanOrEqual(PROGRESS_SEGMENTS);
    }
  });
});
