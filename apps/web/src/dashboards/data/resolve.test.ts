/**
 * The resolution grammar and the two guards.
 *
 * Vitest rather than `node:test` because `resolve.ts` imports across modules and Node's
 * type stripping will not resolve an extensionless TypeScript specifier. The routing half
 * lives in `__tests__/runs.test.mjs`, which stays dependency-free on purpose.
 */

import { describe, expect, it } from 'vitest';
import type { PanelQuery } from '@agnetos/contracts';
import { resolveQuery, stripAttribution, type Entry, type ReadEntry } from './resolve';
import type { Plan } from './endpoints';

const DEPARTMENTS = ['sales', 'deals', 'marketing', 'operations', 'intelligence', 'customer', 'back-office'];

/** A `read` over a fixed URL → body map. An unlisted URL is still loading. */
const reader = (map: Record<string, unknown>): ReadEntry =>
  (url) => (url in map ? ({ state: 'ready', json: map[url] } as Entry) : ({ state: 'loading' } as Entry));

const metricUrl = (params: Record<string, string>): string =>
  `/api/metrics/query?${new URLSearchParams(params).toString()}`;

describe('the empty-state grammar', () => {
  it('renders a count of zero as a number', () => {
    const url = metricUrl({ metric: 'runs', range: '7d' });
    const result = resolveQuery({ source: 'langfuse', metric: 'runs', range: '7d' } as PanelQuery, reader({
      [url]: { metric: 'runs', filter: {}, value: 0, runs: 0, previous: 0, delta: null },
    }));
    expect(result.status).toBe('ok');
    expect(result.data).toBe(0);
  });

  it('renders a statistic over zero runs as empty, never as zero', () => {
    // The median latency of no runs is not a measurement. `0ms` would be a claim the
    // server deliberately refused to make.
    const url = metricUrl({ metric: 'latency_p50', range: '7d' });
    const result = resolveQuery({ source: 'langfuse', metric: 'latency_p50', range: '7d' } as PanelQuery, reader({
      [url]: { metric: 'latency_p50', filter: {}, value: null, runs: 0, previous: null, delta: null },
    }));
    expect(result.status).toBe('empty');
    expect(result.data).toBeUndefined();
  });

  it('takes the delta chip from the server, and stays empty when there is no honest comparison', () => {
    const url = metricUrl({ metric: 'runs', range: '7d' });
    const query = {
      source: 'langfuse',
      metric: 'runs',
      range: '7d',
      compare: 'previous-period',
    } as PanelQuery;

    const real = resolveQuery(query, reader({ [url]: { metric: 'runs', filter: {}, value: 121, previous: 81, delta: 0.494 } }));
    expect(real.status).toBe('ok');
    expect(real.data).toBe(0.494);

    const none = resolveQuery(query, reader({ [url]: { metric: 'runs', filter: {}, value: 121, previous: 0, delta: null } }));
    expect(none.status).toBe('empty');
  });

  it('carries the unpriced caveat on a spend figure that is a floor, not a total', () => {
    const url = metricUrl({ metric: 'cost', range: '7d' });
    const result = resolveQuery({ source: 'langfuse', metric: 'cost', range: '7d' } as PanelQuery, reader({
      [url]: { metric: 'cost', filter: {}, value: 40.22, runs: 121, unpricedRuns: 10, delta: null },
    }));
    expect(result.status).toBe('ok');
    expect(result.message).toBe('10 of 121 unpriced');
  });

  it('is loading, not broken, while a URL has not answered', () => {
    const result = resolveQuery({ source: 'langfuse', metric: 'runs', range: '7d' } as PanelQuery, reader({}));
    expect(result.loading).toBe(true);
  });
});

describe('the receipt check', () => {
  it('withholds a figure the route returned without the filter it was asked for', () => {
    const plan: Plan = {
      kind: 'scalar',
      url: '/x',
      metric: 'runs',
      want: { department: 'sales' },
      delta: false,
    };
    const result = resolveQuery(
      { source: 'langfuse', metric: 'runs', range: '7d' } as PanelQuery,
      reader({ '/x': { metric: 'runs', filter: {}, value: 121 } }),
      {},
      plan,
    );
    expect(result.status).toBe('unavailable');
  });

  it('accepts a figure whose echoed filter matches', () => {
    const plan: Plan = {
      kind: 'scalar',
      url: '/x',
      metric: 'runs',
      want: { department: 'sales' },
      delta: false,
    };
    const result = resolveQuery(
      { source: 'langfuse', metric: 'runs', range: '7d' } as PanelQuery,
      reader({ '/x': { metric: 'runs', filter: { department: 'sales' }, value: 31 } }),
      {},
      plan,
    );
    expect(result.status).toBe('ok');
    expect(result.data).toBe(31);
  });
});

describe('the completeness check on a department split', () => {
  const range = '7d';
  const query = {
    source: 'langfuse',
    metric: 'runs',
    shape: 'list',
    groupBy: 'department',
    range,
  } as PanelQuery;

  const split = (perDepartment: number, total: number): Record<string, unknown> => {
    const map: Record<string, unknown> = {
      [metricUrl({ metric: 'runs', range })]: { metric: 'runs', filter: {}, value: total },
    };
    for (const slug of DEPARTMENTS) {
      map[metricUrl({ metric: 'runs', range, department: slug })] = {
        metric: 'runs',
        filter: { department: slug },
        value: perDepartment,
      };
    }
    return map;
  };

  it('withholds the split when the parts do not sum to the ungrouped total', () => {
    const result = resolveQuery(query, reader(split(10, 121)), {}, undefined, { departments: DEPARTMENTS });
    expect(result.status).toBe('unavailable');
  });

  it('renders the split when every run is accounted for', () => {
    const result = resolveQuery(query, reader(split(10, 70)), {}, undefined, { departments: DEPARTMENTS });
    expect(result.status).toBe('ok');
    expect((result.data as unknown[]).length).toBe(7);
  });

  it('drops a department with no runs but still counts its zero', () => {
    const map = split(10, 60);
    map[metricUrl({ metric: 'runs', range, department: 'deals' })] = {
      metric: 'runs',
      filter: { department: 'deals' },
      value: 0,
    };
    const result = resolveQuery(query, reader(map), {}, undefined, { departments: DEPARTMENTS });
    expect(result.status).toBe('ok');
    expect((result.data as unknown[]).length).toBe(6);
  });
});

describe('shaping', () => {
  it('turns cost_by_agent rows into labelled costs with an unpriced sub-label', () => {
    const url = '/api/metrics/sql/cost_by_agent?days=7';
    const result = resolveQuery(
      { source: 'langfuse', metric: 'cost', shape: 'list', groupBy: 'agent', range: '7d' } as PanelQuery,
      reader({
        [url]: {
          rows: [
            { label: 'sales/account-enrichment', value: 7.97, runs: 20, unpriced: 0 },
            { label: 'customer/support-triage', value: 7.44, runs: 18, unpriced: 2 },
            { label: 'back-office/never-priced', value: null, runs: 3, unpriced: 3 },
          ],
        },
      }),
    );
    expect(result.status).toBe('ok');
    const rows = result.data as { label: string; value: number; sub?: string }[];
    // The all-unpriced agent is dropped rather than printed as $0.00 — it contributes
    // nothing to the total either way, and a free agent is not what it is.
    expect(rows.map((r) => r.label)).toEqual(['Account Enrichment', 'Support Triage']);
    expect(rows[1].sub).toBe('18 runs · 2 unpriced');
  });

  it('does not print the agent name twice in a feed row', () => {
    expect(stripAttribution('12 accounts scored — Database Mining', 'Database Mining')).toBe('12 accounts scored');
    expect(stripAttribution('12 accounts scored', 'Database Mining')).toBe('12 accounts scored');
  });

  it('maps the activity route onto feed rows', () => {
    const url = '/api/metrics/activity?limit=2';
    const result = resolveQuery(
      { source: 'langfuse', metric: 'runs', shape: 'list', limit: 2 } as PanelQuery,
      reader({
        [url]: {
          items: [
            {
              runId: 'demo_1',
              at: '2026-08-16T16:52:20.000Z',
              event: 'Repo audited',
              detail: 'frontmatter gaps written to audit/report.md — Agent Auditor',
              agent: 'operations/agent-auditor',
              agentName: 'Agent Auditor',
              status: 'ok',
            },
          ],
        },
      }),
      {},
      { kind: 'activity', url, limit: 2 },
    );
    expect(result.status).toBe('ok');
    const rows = result.data as { event: string; detail?: string; attribution: string }[];
    expect(rows[0].attribution).toBe('Agent Auditor');
    expect(rows[0].detail).toBe('frontmatter gaps written to audit/report.md');
  });
});

describe('sources other than langfuse', () => {
  it('returns a static literal as-is', () => {
    const result = resolveQuery({ source: 'static', value: 44500, note: 'the cap' } as PanelQuery, reader({}));
    expect(result.status).toBe('ok');
    expect(result.data).toBe(44500);
  });

  it('leaves sql unavailable — phase 1 is langfuse + static', () => {
    const result = resolveQuery({ source: 'sql', name: 'pipeline_value' } as PanelQuery, reader({}));
    expect(result.status).toBe('unavailable');
  });
});
