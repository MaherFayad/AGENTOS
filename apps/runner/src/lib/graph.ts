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
 */
import { readFile } from 'node:fs/promises';
import type { GraphReadBody } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { RunnerConfig } from './config';
import { computeBrainCompleteness } from './brain';

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
 * Read the stored payload and overlay the two fields only a running runner can know.
 *
 * Everything else — positions, edges, departments, the version hash — is passed through
 * byte-equivalent. The overlay is deliberately additive and deliberately tiny:
 *
 *   `core.brainCompleteness`  §3.3, computed from `company/` (never a constant).
 *   `nodes[].approvalPending` §3.2, true while a run of that agent waits at its gate.
 *
 * `approvalPending` cannot come from the artifact because it is a fact about *now*, and
 * the artifact is a fact about the last build. `brainCompleteness` could in principle be
 * baked in at build time; it is overlaid instead so the number cannot go stale between
 * builds while the galaxy is being asked to render it. Both are also pushed over
 * `/ws/graph`, from the same computation, so the two surfaces cannot disagree.
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

  const brain = await computeBrainCompleteness(config);
  const core = (typeof payload.core === 'object' && payload.core !== null ? payload.core : {}) as Record<
    string,
    unknown
  >;
  payload.core = { ...core, brainCompleteness: brain.value };

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
