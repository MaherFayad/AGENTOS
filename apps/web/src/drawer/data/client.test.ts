import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadUrl, fetchAgent, fetchRuns } from './client';
import { normalizeRuns } from './normalize';

/**
 * The slug is `department/agent-slug` and the slash is part of the PATH, not a character
 * inside a segment (api-contracts.md, Reads). These pin both halves of that: the
 * separator survives, and everything either side of it is escaped.
 */
describe('slug-in-path encoding', () => {
  afterEach(() => vi.unstubAllGlobals());

  const capture = (): string[] => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify({ slug: 'sales/account-enrichment', path: 'agents/sales/account-enrichment/SKILL.md', frontmatter: { name: 'Account Enrichment', department: 'sales', tier: 'autonomous' }, body: '' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    return urls;
  };

  it('keeps the department separator as a real path segment', async () => {
    const urls = capture();
    await fetchAgent('sales/account-enrichment');
    // Not `%2F` — that would contradict the contract's own example URL.
    expect(urls[0]).toBe('/api/agents/sales/account-enrichment');
  });

  it('escapes characters inside a segment without eating the separator', async () => {
    const urls = capture();
    await fetchAgent('sales/odd name#1');
    expect(urls[0]).toBe('/api/agents/sales/odd%20name%231');
  });

  it('encodes the download URL the same way', () => {
    expect(downloadUrl('sales/account-enrichment')).toBe('/api/agents/sales/account-enrichment/download');
  });
});

/**
 * LAST RUNS reads the **durable** ledger, not the runner's in-memory queue view.
 * `/api/runs` holds only what the current runner process executed and empties on every
 * restart, so binding LAST RUNS to it meant the section could never show history. This
 * pins the route so the regression cannot come back quietly.
 */
describe('LAST RUNS reads the durable ledger', () => {
  afterEach(() => vi.unstubAllGlobals());

  const captureRuns = (): string[] => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify({ runs: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    return urls;
  };

  it('asks /api/metrics/runs, never /api/runs', async () => {
    const urls = captureRuns();
    await fetchRuns('sales/account-enrichment', 5);
    expect(urls[0]).toBe('/api/metrics/runs?agent=sales%2Faccount-enrichment&limit=5');
  });

  /**
   * The filter is the server's job. If it were ever dropped, this asks for five rows of
   * "every agent" and shows another agent's history under this agent's name — a wrong
   * answer that looks entirely plausible.
   */
  it('sends the agent filter and the limit to the server', async () => {
    const urls = captureRuns();
    await fetchRuns('customer/support-triage', 3);
    expect(urls[0]).toContain('agent=customer%2Fsupport-triage');
    expect(urls[0]).toContain('limit=3');
  });
});

/**
 * The ledger's row shape, verbatim from `GET /api/metrics/runs` against the live database.
 */
describe('normalizeRuns over the ledger shape', () => {
  const ledgerRow = {
    runId: 'demo_00208',
    agent: 'operations/agent-auditor',
    agentName: 'Agent Auditor',
    startedAt: '2026-08-16T16:52:20.000Z',
    status: 'ok',
    durationMs: 46481,
    costUsd: 0.473381,
    costSource: 'derived',
    traceUrl: 'http://127.0.0.1:3001/project/demo/traces/demo_trace_00208',
  };

  it('keeps every field LAST RUNS renders — including traceUrl (§2.3: the row opens the trace)', () => {
    const [row] = normalizeRuns({ runs: [ledgerRow] });
    expect(row).toEqual({
      runId: 'demo_00208',
      startedAt: '2026-08-16T16:52:20.000Z',
      status: 'ok',
      costUsd: 0.473381,
      costSource: 'derived',
      durationMs: 46481,
      traceUrl: 'http://127.0.0.1:3001/project/demo/traces/demo_trace_00208',
    });
  });

  /**
   * `costSource: 'unpriced'` is tied to `cost_usd IS NULL` by a CHECK constraint. The row
   * must survive with the *reason* intact, so the cell can say "unpriced" rather than
   * rendering `$0.00` (a free run, which it was not) or `NaN`.
   */
  it('keeps an unpriced run and keeps the reason it has no cost', () => {
    const [row] = normalizeRuns({ runs: [{ ...ledgerRow, costUsd: null, costSource: 'unpriced' }] });
    expect(row.costUsd).toBeUndefined();
    expect(row.costSource).toBe('unpriced');
  });

  it('never invents a costSource for a row that did not send one', () => {
    const { costSource: _drop, ...noSource } = ledgerRow;
    const [row] = normalizeRuns({ runs: [noSource] });
    expect(row.costSource).toBeUndefined();
  });

  /**
   * The ledger's CHECK spells this `cancelled`; the SSE contract spells it `canceled`.
   * Without the alias the row is dropped as an unknown status and a cancelled run
   * disappears from its own history.
   */
  it('accepts the ledger spelling of cancelled', () => {
    const [row] = normalizeRuns({ runs: [{ ...ledgerRow, status: 'cancelled' }] });
    expect(row.status).toBe('canceled');
  });

  it('still drops a status it does not recognise rather than guessing', () => {
    expect(normalizeRuns({ runs: [{ ...ledgerRow, status: 'finished-ish' }] })).toEqual([]);
  });
});
