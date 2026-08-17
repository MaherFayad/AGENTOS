import { LEGACY_UNSCOPED_PATHS, RUNNER_ROUTES } from '@agnetos/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadUrl, fetchAgent, fetchRunnerStatus, fetchRuns, postApproval, postSchedule } from './client';
import { normalizeRuns } from './normalize';

/**
 * These assert on **the URL that reaches `fetch`**, not on the intent above it.
 *
 * That is the lesson of the M15 miss and it is worth stating once: this file previously
 * asserted `'/api/agents/sales/account-enrichment'` and passed, green, for a day after
 * that path started answering `400 project_scope_missing`. A test that agrees with the
 * literal in the subject is a test of the literal. So every case below either compares
 * against `RUNNER_ROUTES` — the table the server itself mounts from — or asserts the
 * negative: that the URL is never one of the paths the contract lists as refused.
 */

const REFUSED = new Set(LEGACY_UNSCOPED_PATHS.map((route) => route.path));

/** Captures every URL `fetch` is called with, and answers each one 200. */
function capture(body: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return urls;
}

const AGENT_BODY = {
  slug: 'sales/account-enrichment',
  path: 'agents/sales/account-enrichment/SKILL.md',
  frontmatter: { name: 'Account Enrichment', department: 'sales', tier: 'autonomous' },
  body: '',
};

/**
 * The slug is `department/agent-slug` and the slash is part of the PATH, not a character
 * inside a segment (api-contracts.md, Reads). These pin both halves of that: the
 * separator survives, and everything either side of it is escaped.
 */
describe('slug-in-path encoding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the project, then keeps the department separator as a real path segment', async () => {
    const urls = capture(AGENT_BODY);
    await fetchAgent('agentos', 'sales/account-enrichment');
    // Not `%2F` — that would contradict the contract's own example URL.
    expect(urls[0]).toBe('/api/p/agentos/agents/sales/account-enrichment');
  });

  it('escapes characters inside a segment without eating the separator', async () => {
    const urls = capture(AGENT_BODY);
    await fetchAgent('agentos', 'sales/odd name#1');
    expect(urls[0]).toBe('/api/p/agentos/agents/sales/odd%20name%231');
  });

  it('tracks the route table rather than a copy of it', async () => {
    const urls = capture(AGENT_BODY);
    await fetchAgent('agentos', 'sales/account-enrichment');
    expect(urls[0]).toBe(
      RUNNER_ROUTES.agent.path.replace(':project', 'agentos').replace('*', 'sales/account-enrichment'),
    );
  });

  it('encodes the download URL the same way', () => {
    expect(downloadUrl('agentos', 'sales/account-enrichment')).toBe(
      '/api/p/agentos/agents/sales/account-enrichment/download',
    );
  });
});

/**
 * The regression this suite exists for. `/api/agents/*` is still mounted and answers
 * `400 project_scope_missing` — the drawer must never be the client that sends it.
 */
describe('never a path the runner answers 400 project_scope_missing on', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the agent read is not the pre-M15 spelling', async () => {
    const urls = capture(AGENT_BODY);
    await fetchAgent('agentos', 'sales/account-enrichment');
    expect(urls[0]).not.toMatch(/^\/api\/agents\//);
    expect(REFUSED.has('/api/agents/*')).toBe(true);
  });

  it('the schedule write is not /api/schedule', async () => {
    const urls = capture({ ok: true });
    await postSchedule('agentos', 'sales/account-enrichment', '0 6 * * 1');
    expect(urls[0]).toBe(RUNNER_ROUTES.schedule.path.replace(':project', 'agentos'));
    expect(REFUSED.has(urls[0])).toBe(false);
    expect(urls[0]).not.toBe('/api/schedule');
  });

  it('the approval decision is not /api/approvals/:runId', async () => {
    const urls = capture({ ok: true });
    await postApproval('agentos', 'run_1', 'approve');
    expect(urls[0]).toBe('/api/p/agentos/approvals/run_1');
    expect(REFUSED.has('/api/approvals/:runId')).toBe(true);
    expect(urls[0]).not.toMatch(/^\/api\/approvals\//);
  });
});

/**
 * `null` means **do not ask**, never *ask the unscoped one*. The assertion that matters is
 * not the message — it is that `fetch` was never called at all. A fallback to the wide path
 * would have produced a 400 the drawer then explains as something else, which is how this
 * stayed invisible for a day.
 */
describe('no project ⇒ no request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses the agent read and sends nothing', async () => {
    const urls = capture(AGENT_BODY);
    await expect(fetchAgent(null, 'sales/account-enrichment')).rejects.toThrow(/does not name a project/);
    expect(urls).toEqual([]);
  });

  it('refuses LAST RUNS, the schedule write and the approval decision, and sends nothing', async () => {
    const urls = capture({ runs: [] });
    await expect(fetchRuns(null, 'sales/account-enrichment')).rejects.toThrow();
    await expect(postSchedule(null, 'sales/account-enrichment', '0 6 * * 1')).rejects.toThrow();
    await expect(postApproval(null, 'run_1', 'approve')).rejects.toThrow();
    expect(urls).toEqual([]);
  });

  it('has no download address rather than an unscoped one', () => {
    expect(downloadUrl(null, 'sales/account-enrichment')).toBeNull();
  });

  /**
   * A segment that is not a project slug is the same answer, and deliberately not a throw
   * out of a render: `all` and `api` are reserved (`RESERVED_PROJECT_SLUGS`), the third is
   * not kebab-case. A malformed URL is a reason to stop asking.
   */
  it('treats a segment that is not a slug the same way', async () => {
    const urls = capture(AGENT_BODY);
    await expect(fetchAgent('all', 'sales/account-enrichment')).rejects.toThrow();
    await expect(fetchAgent('Not A Slug', 'sales/account-enrichment')).rejects.toThrow();
    expect(urls).toEqual([]);
    expect(downloadUrl('api', 'sales/account-enrichment')).toBeNull();
  });
});

/**
 * `GET /api/status` is `scope: 'coordinator'` — it describes the process, not a project's
 * data (ADR-015). It is unscoped **on purpose**, and this asserts that so nobody migrates
 * it by pattern-matching the rest of the file.
 */
describe('/api/status stays coordinator-scoped', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the unscoped route, from the route table', async () => {
    const urls = capture({ runnerConfigured: false });
    await fetchRunnerStatus();
    expect(urls[0]).toBe(RUNNER_ROUTES.status.path);
    expect(urls[0]).toBe('/api/status');
    expect(RUNNER_ROUTES.status.scope).toBe('coordinator');
    // It is not in the refused list, which is what makes it different from the rest.
    expect(REFUSED.has('/api/status')).toBe(false);
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

  it('asks the project-scoped metrics ledger, never /api/runs and never the unscoped metrics path', async () => {
    const urls = capture({ runs: [] });
    await fetchRuns('agentos', 'sales/account-enrichment', 5);
    expect(urls[0]).toBe('/api/p/agentos/metrics/runs?agent=sales%2Faccount-enrichment&limit=5');
    // The two wrong answers, each spelled out so the regression has a name.
    expect(urls[0]).not.toContain('/api/metrics/runs?');
    expect(urls[0]).not.toBe(RUNNER_ROUTES.runs.path.replace(':project', 'agentos'));
    expect(REFUSED.has('/api/runs')).toBe(true);
  });

  /**
   * The filter is the server's job. If it were ever dropped, this asks for five rows of
   * "every agent" and shows another agent's history under this agent's name — a wrong
   * answer that looks entirely plausible.
   */
  it('sends the agent filter and the limit to the server', async () => {
    const urls = capture({ runs: [] });
    await fetchRuns('agentos', 'customer/support-triage', 3);
    expect(urls[0]).toContain('agent=customer%2Fsupport-triage');
    expect(urls[0]).toContain('limit=3');
  });
});

/**
 * The ledger's row shape, verbatim from `GET /api/p/:project/metrics/runs` against the
 * live database.
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
