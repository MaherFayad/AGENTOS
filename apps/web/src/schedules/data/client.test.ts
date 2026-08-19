/**
 * The scheduling client — URLs from the contract, and refusals that arrive as data.
 *
 * **What this instrument cannot see:** whether the runner is there. Every request below is
 * answered by a stub. That is the honest limit and it is the same one `endpoints.test.ts` has —
 * what it *can* see is the failure that actually happened in M15, where five hardcoded paths
 * silently began answering `project_scope_missing` and every widget blamed the tailnet.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RUNNER_ROUTES } from '@agnetos/contracts';
import { fireNow, previewSchedule, saveSchedule, scheduleUrls } from './client';

const stub = (status: number, body: unknown) =>
  vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the URLs come from the contract', () => {
  it('carries the project segment on every one of the six', () => {
    const urls = scheduleUrls('agentos');
    const built = [urls.preview, urls.create, urls.list, urls.update('s1'), urls.fires('s1'), urls.fireNow('s1')];
    for (const url of built) {
      expect(url.startsWith('/api/p/agentos/')).toBe(true);
      expect(url).not.toContain(':project');
      expect(url).not.toContain(':id');
    }
  });

  /**
   * Asserted against `RUNNER_ROUTES` rather than against strings typed here — a test that
   * hardcodes the path it is checking proves the two literals match each other and nothing else.
   */
  it('is exactly the route table with the segments filled', () => {
    const urls = scheduleUrls('agentos');
    expect(urls.preview).toBe(RUNNER_ROUTES.schedulePreview.path.replace(':project', 'agentos'));
    expect(urls.create).toBe(RUNNER_ROUTES.scheduleCreate.path.replace(':project', 'agentos'));
    expect(urls.fires('abc')).toBe(
      RUNNER_ROUTES.scheduleFires.path.replace(':project', 'agentos').replace(':id', 'abc'),
    );
  });

  it('escapes an id rather than letting it add a path segment', () => {
    expect(scheduleUrls('agentos').fires('a/b')).toContain('a%2Fb');
  });

  /**
   * The create route is a different path from the frontmatter one, and a client that called
   * `RUNNER_ROUTES.schedule` would write a cron into an agent's SKILL.md instead of creating an
   * `ops` row. Two authorities, two paths (ADR-024).
   */
  it('does not point at the frontmatter-writing route', () => {
    expect(scheduleUrls('agentos').create).not.toBe(
      RUNNER_ROUTES.schedule.path.replace(':project', 'agentos'),
    );
  });
});

describe('a refusal arrives as data', () => {
  it('keeps the code and the hint a person is meant to read', async () => {
    vi.stubGlobal(
      'fetch',
      stub(409, {
        error: {
          code: 'schedule_preview_stale',
          message: 'The times this schedule would fire are not the ones that were confirmed.',
          hint: 'It now fires 2026-09-01T06:00 and onwards, in Asia/Riyadh.',
        },
      }),
    );
    const result = await saveSchedule('agentos', {
      line: '@sales/digest',
      trigger: { kind: 'cron', spec: { expression: '0 6 1 * *' } },
      tz: 'Asia/Riyadh',
      followMe: false,
      jitterSeconds: 0,
      missedRunPolicy: 'skip',
      overlapPolicy: 'skip',
      enabled: true,
      autoDisableAfter: 3,
      reviewAt: '2026-11-19T00:00:00.000Z',
      previewToken: 'pv1_stale000',
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('schedule_preview_stale');
    // The hint carries the *new* times. "Your preview is stale" without them sends a person back
    // to a dialog with nothing new to look at.
    expect(result.ok === false && result.hint).toContain('Asia/Riyadh');
    expect(result.ok === false && result.status).toBe(409);
  });

  /**
   * A network fault is not a refusal, and labelling it with the server's vocabulary is how "the
   * runner said no" ends up in a report about a laptop that was asleep. `status: null` is the
   * checkable form of *nothing answered*.
   */
  it('does not dress an unreachable runner as a scheduling error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch);
    const result = await previewSchedule('agentos', {
      trigger: { kind: 'cron', spec: { expression: '0 6 * * 1' } },
      tz: 'UTC',
      followMe: false,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe('unreachable');
    expect(result.ok === false && result.status).toBeNull();
    // And it invents no sentence. A data client that authors English has put a string where
    // nobody can translate it — `check-rtl` caught two of these on this module's first run, both
    // written by its author. The surface supplies the copy, keyed off `code`.
    expect(result.ok === false && result.message).toBeNull();
  });

  it('survives a non-JSON failure without inventing a scheduling code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch);
    const result = await previewSchedule('agentos', {
      trigger: { kind: 'cron', spec: { expression: '0 6 * * 1' } },
      tz: 'UTC',
      followMe: false,
    });
    expect(result.ok === false && result.code).toBe('internal');
    expect(result.ok === false && result.status).toBe(502);
    expect(result.ok === false && result.message).toBeNull();
  });
});

describe('what a manual fire actually returns', () => {
  /**
   * `started: false` is a value the surface has to render, not an absence it may ignore. There is
   * no executor: the row is recorded and nothing reads it. A control that showed "fired" here
   * would be the house defect on the surface where believing it costs money.
   */
  it('carries the reason nothing started, alongside the recorded row', async () => {
    vi.stubGlobal(
      'fetch',
      stub(200, {
        fireId: 'f1',
        occurrenceTime: '2026-08-19T21:00:00.000Z',
        recorded: true,
        started: false,
        startedBecause: 'no-executor',
      }),
    );
    const result = await fireNow('agentos', 's1');
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value.started).toBe(false);
    // A code, not a sentence: the surface says it in the reader's language.
    expect(result.ok === true && result.value.startedBecause).toBe('no-executor');
  });
});
