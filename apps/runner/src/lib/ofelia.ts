/**
 * ofelia sync (§3.2: "writes `schedule: cron` into frontmatter → ofelia sync regenerates
 * cron jobs").
 *
 * The ordering here is the whole point. Frontmatter is committed **first**, then ofelia is
 * asked to reload from it. A job that exists in ofelia but not in frontmatter is a bug
 * (contract), so ofelia is never told about a schedule that is not already in the file —
 * which means a failed sync leaves the system stale, never wrong.
 *
 * The sync mechanism itself is `infra-compose-engineer`'s (ofelia's config generation and
 * reload). The runner only pokes it, and reports honestly when the poke failed.
 */
import type { RunnerConfig } from './config';

export interface SyncResult {
  synced: boolean;
  /** Present when the sync failed — surfaced in logs, not in the response body. */
  reason?: string;
}

export async function syncOfelia(config: RunnerConfig): Promise<SyncResult> {
  if (!config.ofeliaSyncUrl) {
    // Not configured. Say so rather than reporting a success that did not happen — the
    // schedule is still true in frontmatter, which is the source of truth either way.
    return { synced: false, reason: 'OFELIA_SYNC_URL is not set' };
  }

  try {
    const response = await fetch(config.ofeliaSyncUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'runner', at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { synced: false, reason: `sync returned ${response.status}` };
    return { synced: true };
  } catch (err) {
    return { synced: false, reason: err instanceof Error ? err.message : 'sync request failed' };
  }
}
