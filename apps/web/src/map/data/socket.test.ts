/**
 * The URLs the map dials.
 *
 * This suite exists because of a specific failure: M15 moved the graph endpoints under
 * `/api/p/:project` and this file's subject kept two string literals pointing at the old
 * ones. Nothing failed loudly — the HTTP call took a 400 that `useGraph` counted as "not
 * built" and the socket connected to a route the runner no longer registers. So the
 * assertions below are on the **value that reaches the boundary**, not on the intent above
 * it: the exact path string, and the negative — that it is never one of the paths the
 * contract itself lists as refused.
 */

import { LEGACY_UNSCOPED_PATHS, RUNNER_ROUTES } from '@agnetos/contracts';
import { describe, expect, it } from 'vitest';
import { graphArtifactUrl, graphHttpUrl, graphSocketUrl } from './socket';

const REFUSED = new Set(LEGACY_UNSCOPED_PATHS.map((r) => r.path));

describe('graphHttpUrl', () => {
  it('names the project in the path', () => {
    expect(graphHttpUrl('agentos')).toBe('/api/p/agentos/graph');
  });

  it('is never a path the runner answers 400 project_scope_missing on', () => {
    const url = graphHttpUrl('agentos');
    expect(url).not.toBeNull();
    expect(REFUSED.has(url!)).toBe(false);
    // The literal this file used to hold, spelled out so the regression has a name.
    expect(url).not.toBe('/api/graph');
    expect(REFUSED.has('/api/graph')).toBe(true);
  });

  it('tracks the contract rather than a copy of it', () => {
    expect(graphHttpUrl('agentos')).toBe(RUNNER_ROUTES.graph.path.replace(':project', 'agentos'));
  });

  it('is null — not an unscoped URL — when there is no project', () => {
    expect(graphHttpUrl(null)).toBeNull();
  });

  it('is null for a segment that is not a project slug, rather than throwing', () => {
    // `all` and `api` are reserved (`RESERVED_PROJECT_SLUGS`); the third is not kebab-case.
    expect(graphHttpUrl('all')).toBeNull();
    expect(graphHttpUrl('api')).toBeNull();
    expect(graphHttpUrl('Not A Slug')).toBeNull();
  });
});

describe('graphSocketUrl', () => {
  it('names the project in the path and speaks ws over the page origin', () => {
    const url = graphSocketUrl('agentos');
    expect(url).toBe(`ws://${window.location.host}/ws/p/agentos/graph`);
  });

  it('is not the pre-M15 socket path, which the runner does not register at all', () => {
    expect(graphSocketUrl('agentos')).not.toContain('/ws/graph');
    expect(graphSocketUrl('agentos')).toContain(RUNNER_ROUTES.graphSocket.path.replace(':project', 'agentos'));
  });

  it('is null when there is no project, so no socket is opened', () => {
    expect(graphSocketUrl(null)).toBeNull();
    expect(graphSocketUrl('all')).toBeNull();
  });
});

describe('graphArtifactUrl', () => {
  it('is the ADR-003 static artifact and stays unscoped on purpose', () => {
    expect(graphArtifactUrl()).toBe('/graph.json');
  });
});
