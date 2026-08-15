/**
 * The repo watcher (Part V, `contracts/api-contracts.md` § WebSocket `/ws/graph`).
 *
 *   chokidar on the read-only `/agents` mount → re-parse frontmatter → layout engine →
 *   push layout **deltas**
 *
 * Deltas, not full payloads. `graph-layout.md`: "The client re-seeds the simulation with
 * existing positions frozen and lets only new nodes settle — so a weekly agent drop
 * animates in without the whole map jumping. This is a feature, not an optimization; do
 * not replace it with a full refetch."
 *
 * The layout engine is `scripts/lib/layout.mjs` — `map-galaxy-engineer`'s, imported and
 * never reimplemented (ADR-003). It is loaded dynamically because the runner runs in a
 * container where `scripts/` may not be mounted; when it is missing the watcher pushes
 * `{type:"stale"}` and stops there. That is the honest failure: the client refetches
 * `/api/graph` and gets the stored artifact, rather than receiving a delta this process
 * guessed at.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GraphSocketMessage } from '@agnetos/contracts';
import type { RunnerConfig } from './config';
import { computeBrainCompleteness, writeBrainSnapshot } from './brain';

/** Debounce window. A `git pull` touches many files; the map should settle once. */
const SETTLE_MS = 300;

export interface WatcherLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

export interface GraphWatcherDeps {
  broadcast: (message: GraphSocketMessage) => void;
  logger: WatcherLogger;
}

export interface GraphWatcher {
  /** Latest known layout version, for the `hello` frame. */
  version(): string;
  brainCompleteness(): number;
  /** Recompute now. Exposed so tests drive it directly instead of racing the filesystem. */
  refresh(): Promise<void>;
  close(): Promise<void>;
}

type LayoutNode = { id: string; [key: string]: unknown };
type LayoutPayload = { version: string; nodes: LayoutNode[]; [key: string]: unknown };

type LayoutEngine = {
  computeLayout: (agents: unknown[], previous: unknown, options: unknown) => LayoutPayload;
  loadDepartments: (root: string, warn?: (m: string) => void) => unknown;
  loadClusters: (root: string) => unknown;
  parseFrontmatter: (text: string) => Record<string, unknown> | null;
};

async function loadLayoutEngine(config: RunnerConfig): Promise<LayoutEngine | null> {
  const url = (file: string) =>
    pathToFileURL(join(config.repoRoot, 'scripts', 'lib', file)).href;
  try {
    const [layout, departments, frontmatter] = await Promise.all([
      import(url('layout.mjs')),
      import(url('departments.mjs')),
      import(url('frontmatter.mjs')),
    ]);
    return {
      computeLayout: layout.computeLayout,
      loadDepartments: departments.loadDepartments,
      loadClusters: departments.loadClusters,
      parseFrontmatter: frontmatter.parseFrontmatter,
    };
  } catch {
    return null;
  }
}

/**
 * Collect agents in the shape the layout engine expects — the same walk
 * `scripts/build-graph.mjs` does, using the same parser, so the watcher's layout and a
 * `npm run graph:build` layout are the same computation on the same inputs. Two different
 * readers of `agents/` would eventually produce two different maps.
 */
async function collectAgents(config: RunnerConfig, engine: LayoutEngine): Promise<unknown[]> {
  const agents: unknown[] = [];
  let departments: string[];
  try {
    const entries = await readdir(config.agentsDir, { withFileTypes: true });
    departments = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    return agents;
  }

  for (const department of departments) {
    let folders: string[];
    try {
      const entries = await readdir(join(config.agentsDir, department), { withFileTypes: true });
      folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      continue;
    }
    for (const folder of folders) {
      try {
        const text = await readFile(join(config.agentsDir, department, folder, 'SKILL.md'), 'utf8');
        const fm = engine.parseFrontmatter(text);
        if (!fm) continue;
        agents.push({ ...fm, slug: folder, department });
      } catch {
        // Unreadable or frontmatter-less files are excluded from the map, exactly as the
        // schema contract requires. They are not pushed as a removal either — the next
        // full build decides that, and a transient read error is not a deletion.
      }
    }
  }
  return agents;
}

/** Stable comparison of a node's renderable fields. Ignores key order. */
function fingerprint(node: LayoutNode): string {
  return JSON.stringify(Object.keys(node).sort().map((k) => [k, node[k]]));
}

export async function createGraphWatcher(
  config: RunnerConfig,
  deps: GraphWatcherDeps,
): Promise<GraphWatcher> {
  const engine = await loadLayoutEngine(config);
  let previousNodes = new Map<string, LayoutNode>();
  let version = '';
  let brain = 0;
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  let watcherClose: (() => Promise<void>) | null = null;

  // Seed from the stored artifact so the first delta after a restart is relative to what
  // a connected client already has, not to an empty map.
  try {
    const stored = JSON.parse(await readFile(config.graphFile, 'utf8')) as LayoutPayload;
    version = String(stored.version ?? '');
    for (const node of stored.nodes ?? []) previousNodes.set(String(node.id), node);
  } catch {
    // No artifact yet. `/api/graph` answers `graph_not_built`; the first refresh fills in.
  }

  async function refresh(): Promise<void> {
    if (closed) return;

    // §3.3 — recompute honestly and publish the snapshot `build-graph.mjs` reads, so the
    // stored artifact's `core.brainCompleteness` and this process's number have one
    // producer. Never a constant, and never nudged upward.
    const completeness = await computeBrainCompleteness(config);
    brain = completeness.value;
    await writeBrainSnapshot(config, completeness);

    if (!engine) {
      deps.broadcast({
        type: 'stale',
        reason: 'The layout engine (scripts/lib/layout.mjs) is not reachable from the runner, so no delta could be computed. Refetch /api/graph.',
      });
      return;
    }

    let payload: LayoutPayload;
    try {
      const agents = await collectAgents(config, engine);
      const stored = JSON.parse(
        await readFile(join(config.agentsDir, '_registry', 'positions.json'), 'utf8').catch(() => '{}'),
      ) as { positions?: Record<string, { x: number; y: number }> };
      payload = engine.computeLayout(agents, stored.positions ?? {}, {
        departments: engine.loadDepartments(config.repoRoot),
        clusters: engine.loadClusters(config.repoRoot),
        brainCompleteness: completeness.value,
        now: new Date().toISOString(),
      });
    } catch (err) {
      deps.broadcast({
        type: 'stale',
        reason: err instanceof Error ? err.message : 'The layout could not be recomputed.',
      });
      return;
    }

    const nextNodes = new Map<string, LayoutNode>();
    for (const node of payload.nodes ?? []) nextNodes.set(String(node.id), node);

    const added: LayoutNode[] = [];
    const changed: LayoutNode[] = [];
    for (const [id, node] of nextNodes) {
      const before = previousNodes.get(id);
      if (!before) added.push(node);
      else if (fingerprint(before) !== fingerprint(node)) changed.push(node);
    }
    const removed = [...previousNodes.keys()].filter((id) => !nextNodes.has(id));

    previousNodes = nextNodes;
    version = String(payload.version ?? version);

    if (added.length === 0 && changed.length === 0 && removed.length === 0) return;

    deps.logger.info(
      { added: added.length, changed: changed.length, removed: removed.length },
      'graph delta pushed',
    );
    deps.broadcast({
      type: 'delta',
      delta: { version, computedAt: new Date().toISOString(), added, changed, removed },
    });
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void refresh().catch((err) => deps.logger.warn({ err }, 'graph refresh failed'));
    }, SETTLE_MS);
  }

  try {
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(config.agentsDir, {
      ignoreInitial: true,
      // The mount is read-only, so nothing here can write back into it by accident. The
      // watcher is a reader of a reader.
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    watcher.on('add', schedule).on('change', schedule).on('unlink', schedule);
    watcherClose = () => watcher.close();
    deps.logger.info({ dir: config.agentsDir }, 'watching the agent library for changes');
  } catch (err) {
    // No chokidar: the map still works, it just stops animating new agents in. Said once,
    // at boot, rather than pretended away.
    deps.logger.warn(
      { err },
      'chokidar is unavailable — /ws/graph will not push deltas; clients refetch /api/graph',
    );
  }

  return {
    version: () => version,
    brainCompleteness: () => brain,
    refresh,
    async close() {
      closed = true;
      if (timer) clearTimeout(timer);
      if (watcherClose) await watcherClose();
    },
  };
}
