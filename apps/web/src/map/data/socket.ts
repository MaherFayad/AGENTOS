/**
 * Where the map talks to the runner. Same-origin through Caddy (`/api/*`, `/ws/*`);
 * `NEXT_PUBLIC_API_BASE` when the web app is served without that proxy (local `dev`
 * profile: web :3000, runner :8787).
 */

export function graphHttpUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
  return `${base}/api/graph`;
}

/** Static build artifact Next serves from `apps/web/public/graph.json` (ADR-003). */
export function graphArtifactUrl(): string {
  return '/graph.json';
}

export function graphSocketUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
  if (base) {
    try {
      const url = new URL(base);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws/graph';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      // fall through to same-origin
    }
  }
  if (typeof window === 'undefined') return '/ws/graph';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/graph`;
}
