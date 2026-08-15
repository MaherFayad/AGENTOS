/**
 * ofelia sync (§3.2: "writes `schedule: cron` into frontmatter → ofelia sync regenerates
 * cron jobs").
 *
 * The ordering here is the whole point. Frontmatter is committed **first**, then ofelia is
 * asked to reload from it. A job that exists in ofelia but not in frontmatter is a bug
 * (contract), so ofelia is never told about a schedule that is not already in the file —
 * which means a failed sync leaves the system stale, never wrong.
 *
 * Two steps, both honest about failure:
 *   1. Run `scripts/sync-ofelia.mjs` to rewrite `infra/ofelia/config.ini` from frontmatter.
 *   2. Poke a reload (`OFELIA_SYNC_URL`, or `OFELIA_HUP_COMMAND`) so the running daemon
 *      picks the new file up. The runner image has no docker.sock, so without one of those
 *      the file is current and `ofeliaSynced` is false — stale, not wrong.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import type { RunnerConfig } from './config';

const exec = promisify(execFile);

export interface SyncResult {
  synced: boolean;
  /** Present when the sync failed — surfaced in logs, not in the response body. */
  reason?: string;
}

async function regenerateConfig(config: RunnerConfig): Promise<SyncResult> {
  const script = join(config.repoRoot, 'scripts', 'sync-ofelia.mjs');
  try {
    await access(script);
  } catch {
    return { synced: false, reason: 'scripts/sync-ofelia.mjs is not in this checkout' };
  }

  try {
    await exec('node', [script], {
      cwd: config.repoRoot,
      windowsHide: true,
      timeout: 15_000,
    });
    return { synced: true };
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim();
    return {
      synced: false,
      reason: stderr || (err instanceof Error ? err.message : 'ofelia config regenerate failed'),
    };
  }
}

async function pokeReload(config: RunnerConfig): Promise<SyncResult> {
  const command = process.env.OFELIA_HUP_COMMAND;
  if (command && command.trim() !== '') {
    try {
      // Operator-supplied. Split on spaces rather than going through a shell so a
      // prompt-injected schedule cannot smuggle `&& rm -rf`.
      const parts = command.trim().split(/\s+/);
      const [bin, ...args] = parts;
      if (!bin) return { synced: false, reason: 'OFELIA_HUP_COMMAND is empty' };
      await exec(bin, args, { cwd: config.repoRoot, windowsHide: true, timeout: 15_000 });
      return { synced: true };
    } catch (err) {
      return { synced: false, reason: err instanceof Error ? err.message : 'HUP command failed' };
    }
  }

  if (!config.ofeliaSyncUrl) {
    return { synced: false, reason: 'OFELIA_SYNC_URL is not set and OFELIA_HUP_COMMAND is empty' };
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

export async function syncOfelia(config: RunnerConfig): Promise<SyncResult> {
  const generated = await regenerateConfig(config);
  if (!generated.synced) return generated;

  const reloaded = await pokeReload(config);
  if (!reloaded.synced) {
    return {
      synced: false,
      reason: `config regenerated; reload did not: ${reloaded.reason}`,
    };
  }
  return { synced: true };
}
