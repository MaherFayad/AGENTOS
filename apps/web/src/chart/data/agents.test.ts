/**
 * The URL CHART dials for the agent list.
 *
 * This suite exists because of a specific failure, and it is the same one `map/data/
 * socket.test.ts` was written for: M15 moved every project-shaped route under
 * `/api/p/:project` and this module kept `'/api/agents'` as a default parameter. Nothing
 * failed at build time and nothing failed legibly at run time — the old path is still
 * mounted and answers 400 `project_scope_missing`, which `loadChartAgents` reported as
 * *"agent library unavailable"*, blaming the library for the address.
 *
 * So the assertions are on the **value that reaches the boundary**, not on the intent of
 * the code above it: the exact path string, and the negative — that it is never one of the
 * paths the contract itself lists as refused.
 */

import { LEGACY_UNSCOPED_PATHS, RUNNER_ROUTES } from '@agnetos/contracts';
import { describe, expect, it, vi } from 'vitest';
import { agentsIndexUrl, loadChartAgents, toChartAgent } from './agents';

const REFUSED = new Set(LEGACY_UNSCOPED_PATHS.map((r) => r.path));

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('agentsIndexUrl', () => {
  it('names the project in the path', () => {
    expect(agentsIndexUrl('agentos')).toBe('/api/p/agentos/agents');
  });

  it('is never a path the runner answers 400 project_scope_missing on', () => {
    const url = agentsIndexUrl('agentos');
    expect(url).not.toBeNull();
    expect(REFUSED.has(url!)).toBe(false);
    // The literal this file used to hold, spelled out so the regression has a name.
    expect(url).not.toBe('/api/agents');
    expect(REFUSED.has('/api/agents')).toBe(true);
  });

  it('tracks the contract rather than a copy of it', () => {
    expect(agentsIndexUrl('agentos')).toBe(
      RUNNER_ROUTES.agentsIndex.path.replace(':project', 'agentos'),
    );
  });

  it('is null — not an unscoped URL — when there is no project', () => {
    expect(agentsIndexUrl(null)).toBeNull();
  });

  it('is null for a segment that is not a project slug, rather than throwing', () => {
    // `all` and `api` are reserved (`RESERVED_PROJECT_SLUGS`); the third is not kebab-case.
    expect(agentsIndexUrl('all')).toBeNull();
    expect(agentsIndexUrl('api')).toBeNull();
    expect(agentsIndexUrl('Not A Slug')).toBeNull();
  });
});

describe('loadChartAgents', () => {
  it('fetches the scoped path and projects frontmatter onto the matrix', async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse({
        agents: [
          {
            slug: 'marketing/brand-voice',
            frontmatter: {
              name: 'Brand Voice',
              description: 'Keeps the register consistent.',
              department: 'marketing',
              icon: 'megaphone',
              tier: 'assisted',
              phase: '2-capture',
              breaks_into: ['tone-audit'],
            },
          },
        ],
      }),
    );

    const result = await loadChartAgents('agentos', fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/p/agentos/agents');
    expect(result.error).toBeUndefined();
    expect(result.agents.map((a) => a.name)).toEqual(['Brand Voice']);
  });

  it('sends nothing at all when the URL names no project, and says why', async () => {
    const fetchImpl = vi.fn();
    const result = await loadChartAgents(null, fetchImpl as unknown as typeof fetch);

    // The refusal the runner would have given is not worth converting into a shrug: the
    // legacy path is mounted precisely so a stale client gets a named 400.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.agents).toEqual([]);
    expect(result.error).toContain('does not name a project');
  });

  it('reports a refusal instead of an empty rollout', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 400 }) as unknown as Response);
    const result = await loadChartAgents('agentos', fetchImpl as unknown as typeof fetch);
    expect(result.agents).toEqual([]);
    expect(result.error).toContain('400');
  });
});

describe('toChartAgent', () => {
  it('carries only frontmatter fields — CHART invents none of its own', () => {
    const projected = toChartAgent({
      slug: 'sales/account-enrichment',
      frontmatter: {
        name: 'Account Enrichment',
        description: 'Layer firmographics onto target accounts.',
        department: 'sales',
        icon: 'building',
        tier: 'autonomous',
        phase: '2-capture',
      },
    });
    expect(Object.keys(projected).sort()).toEqual(
      ['department', 'description', 'icon', 'name', 'phase', 'skills', 'slug', 'tier'].sort(),
    );
    expect(projected.skills).toEqual([]);
  });
});
