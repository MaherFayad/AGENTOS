import { describe, expect, it } from 'vitest';
import { cycleId, jobSlug } from './slugs';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('jobSlug', () => {
  it('returns null for an anchor — anchors are not jobs', () => {
    expect(jobSlug(GRAPH_FIXTURE.nodes[0])).toBeNull();
  });

  it('returns department/agent for a job node', () => {
    expect(jobSlug(GRAPH_FIXTURE.nodes[1])).toBe('sales/account-enrichment');
  });
});

describe('cycleId', () => {
  it('wraps the seven (or fewer) departments', () => {
    expect(cycleId(['sales', 'deals'], 'sales', 1)).toBe('deals');
    expect(cycleId(['sales', 'deals'], 'deals', 1)).toBe('sales');
  });
});
