/**
 * Where the map talks to the runner. Same-origin through Caddy (`/api/*`, `/ws/*`);
 * `NEXT_PUBLIC_API_BASE` when the web app is served without that proxy (local `dev`
 * profile: web :3000, runner :8787).
 *
 * ---
 *
 * **Every path here comes out of `RUNNER_ROUTES`, and that is the repair, not a tidy-up.**
 *
 * M15 moved the graph endpoints under `/api/p/:project` (ADR-015). This file held the two
 * paths as string literals, so nothing broke at build time and nothing failed loudly at
 * run time: `GET /api/graph` began answering **400 `project_scope_missing`**, `useGraph`
 * counted that as one more unavailable primary and quietly fell through to the
 * `/graph.json` artifact, and `/ws/graph` — which the runner no longer registers at all —
 * simply never opened. The galaxy still drew. Live drops stopped arriving and no test,
 * type or screen said so.
 *
 * A literal is what made that possible, so there is no longer one to type: both URLs are
 * built by `projectPath()` from the route table the server itself mounts from. The next
 * time a path moves, this file moves with it or fails to compile.
 *
 * `null` means **do not ask** — never "ask the unscoped one". Same rule, same helper shape
 * and the same reason as `projectApiUrl` in `components/shell/useSearchIndex.ts`: a
 * request that cannot name its project is a client fault with a one-line fix, and
 * answering it with another project's rows is the hazard the whole segment exists to
 * remove.
 */

import { RUNNER_ROUTES, projectPath } from '@agnetos/contracts';

/** `''` (same-origin, Caddy) unless the web app is served without the proxy. */
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE ?? '';
}

/**
 * Fill `:project` in a route template, or `null` when we have no project to fill it with.
 *
 * `projectPath` **throws** on a slug that is not a slug (`packages/contracts`' own
 * predicate), which is the behaviour we want one level down and not the behaviour we want
 * here: a malformed segment in the address bar is a reason to stop asking, not a reason to
 * throw out of a render.
 */
function scopedPath(template: string, project: string | null): string | null {
  if (project === null) return null;
  try {
    return projectPath(template, project);
  } catch {
    return null;
  }
}

/** `GET /api/p/:project/graph` — `null` when the URL names no project. */
export function graphHttpUrl(project: string | null): string | null {
  const path = scopedPath(RUNNER_ROUTES.graph.path, project);
  return path === null ? null : `${apiBase()}${path}`;
}

/**
 * Static build artifact Next serves from `apps/web/public/graph.json` (ADR-003).
 *
 * Deliberately unscoped and deliberately still here: it is the file `npm run graph:build`
 * writes for the one library this coordinator mounts, and it is what makes the map work
 * with no runner at all. It carries no project of its own, so it is only sound while
 * exactly one library is mounted — the limit is written down in
 * `comms/contracts/graph-layout.md` §Artifact, with the trigger that retires it.
 */
export function graphArtifactUrl(): string {
  return '/graph.json';
}

/** `WS /ws/p/:project/graph` — `null` when the URL names no project. */
export function graphSocketUrl(project: string | null): string | null {
  const path = scopedPath(RUNNER_ROUTES.graphSocket.path, project);
  if (path === null) return null;

  const base = apiBase();
  if (base) {
    try {
      const url = new URL(base);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = path;
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      // fall through to same-origin
    }
  }
  if (typeof window === 'undefined') return path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
