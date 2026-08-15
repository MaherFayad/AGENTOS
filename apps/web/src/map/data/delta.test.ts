import { describe, expect, it } from 'vitest';
import { applyBrainCompleteness, applyGraphDelta } from './delta';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('applyGraphDelta', () => {
  it('freezes existing coordinates when a node is changed', () => {
    const next = applyGraphDelta(GRAPH_FIXTURE, {
      version: 'sha256:next',
      added: [],
      removed: [],
      changed: [
        {
          ...GRAPH_FIXTURE.nodes[1],
          x: 999,
          y: 999,
          status: 'failing',
        },
      ],
    });
    const job = next.nodes.find((n) => n.id === 'sales/account-enrichment');
    expect(job?.x).toBe(12);
    expect(job?.y).toBe(-320);
    expect(job?.status).toBe('failing');
    expect(next.version).toBe('sha256:next');
  });

  it('inserts added nodes at the positions the engine already solved', () => {
    const added = {
      id: 'sales/new-job',
      kind: 'job' as const,
      label: 'New Job',
      department: 'sales',
      cluster: null,
      icon: null,
      status: 'draft' as const,
      scheduled: false,
      approvalPending: false,
      depth: 2,
      x: 40,
      y: -360,
      r: 14,
    };
    const next = applyGraphDelta(GRAPH_FIXTURE, {
      version: 'sha256:add',
      added: [added],
      removed: [],
      changed: [],
    });
    expect(next.nodes.find((n) => n.id === 'sales/new-job')).toEqual(added);
    expect(next.nodes.find((n) => n.id === 'sales/_anchor')?.x).toBe(0);
  });

  it('drops removed ids', () => {
    const next = applyGraphDelta(GRAPH_FIXTURE, {
      version: 'sha256:rm',
      added: [],
      removed: ['sales/account-enrichment'],
      changed: [],
    });
    expect(next.nodes.some((n) => n.id === 'sales/account-enrichment')).toBe(false);
  });
});

describe('applyBrainCompleteness', () => {
  it('overlays the hello-frame number without moving nodes', () => {
    const next = applyBrainCompleteness(GRAPH_FIXTURE, 0.62);
    expect(next.core.brainCompleteness).toBe(0.62);
    expect(next.nodes).toBe(GRAPH_FIXTURE.nodes);
  });
});
