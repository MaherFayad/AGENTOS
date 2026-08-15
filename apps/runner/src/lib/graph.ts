/**
 * `GET /api/graph` — serve the **stored** layout artifact (ADR-003).
 *
 * ADR-003 is the whole of this file's design: "precomputed once per skills-repo change and
 * stored, then hydrated client-side". This route reads `apps/web/public/graph.json` and
 * returns it. It does not run the force simulation, it does not fall back to a simulation
 * when the file is missing, and it does not invent positions for nodes it can see in
 * `agents/` but not in the artifact.
 *
 * When there is no artifact it answers **503 `graph_not_built`** with a hint naming the
 * command that builds one. A map drawn from a live simulation would look right and be
 * subtly different on every request — the exact failure ADR-003 exists to prevent, and the
 * kind that is discovered months later by someone wondering why a node moved.
 *
 * `core.brainCompleteness` is produced once by `computeLayout` (build-graph + watcher),
 * never overlaid here — one number, one producer (§3.3).
 */
import { readFile } from 'node:fs/promises';
import type { GraphReadBody } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { RunnerConfig } from './config';

export interface GraphOverlay {
  /** Agents with an approval gate open right now — the map pulses these amber (§3.2). */
  approvalPending: readonly string[];
}

/** True when a stored artifact exists. Backs `StatusResponse.graphBuilt`. */
export async function graphIsBuilt(config: RunnerConfig): Promise<boolean> {
  try {
    await readFile(config.graphFile, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the stored payload and overlay the one field only a running runner can know:
 *
 *   `nodes[].approvalPending` §3.2, true while a run of that agent waits at its gate.
 *
 * Everything else — positions, edges, departments, `core.brainCompleteness`, the version
 * hash — is passed through byte-equivalent from the artifact. `approvalPending` cannot
 * come from the artifact because it is a fact about *now*, and the artifact is a fact
 * about the last build. Brain completeness is baked by the layout engine at build/watch
 * time (ADR-003 opts); `/ws/graph` `hello` carries the live watcher value for particles
 * between builds.
 */
export async function readGraph(
  config: RunnerConfig,
  overlay: GraphOverlay = { approvalPending: [] },
): Promise<GraphReadBody> {
  let source: string;
  try {
    source = await readFile(config.graphFile, 'utf8');
  } catch {
    throw new ApiError('graph_not_built', 'The map layout has not been built yet.', {
      hint: 'Run `npm run graph:build` once (it reads agents/ and writes the layout). The map is empty until then — that is an honest empty state, not a failure.',
      retryable: false,
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(source) as Record<string, unknown>;
  } catch (err) {
    throw new ApiError('graph_not_built', 'The stored map layout is not valid JSON.', {
      hint: 'Re-run `npm run graph:build` to regenerate it. The file is reproducible from agents/, so deleting it loses nothing.',
      cause: err,
    });
  }

  if (Array.isArray(payload.nodes)) {
    const pending = new Set(overlay.approvalPending);
    payload.nodes = payload.nodes.map((node) => {
      if (typeof node !== 'object' || node === null) return node;
      const row = node as Record<string, unknown>;
      // Written unconditionally, not only when true: a node left with the artifact's stale
      // `true` after its approval was decided would pulse amber forever.
      return { ...row, approvalPending: pending.has(String(row.id)) };
    });
  }

  return payload;
}
