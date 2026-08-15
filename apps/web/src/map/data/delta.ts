/**
 * Apply a `/ws/graph` delta without reshuffling the galaxy (§2.1 live updates).
 *
 * Existing node coordinates stay frozen. Added nodes keep the positions the layout
 * engine already solved. Removed ids drop out. That is the weekly-drop animation,
 * not a refetch.
 */

import type { GraphDelta, GraphNode, GraphPayload } from '@agnetos/contracts';

export function applyGraphDelta(payload: GraphPayload, delta: GraphDelta): GraphPayload {
  const removed = new Set(delta.removed);
  const byId = new Map<string, GraphNode>();

  for (const node of payload.nodes) {
    if (removed.has(node.id)) continue;
    byId.set(node.id, node);
  }

  for (const node of delta.changed) {
    if (removed.has(node.id)) continue;
    const existing = byId.get(node.id);
    // Freeze the coordinate the visitor already has. Status / badges may change.
    byId.set(node.id, existing ? { ...node, x: existing.x, y: existing.y } : node);
  }

  for (const node of delta.added) {
    if (removed.has(node.id) || byId.has(node.id)) continue;
    byId.set(node.id, node);
  }

  return {
    ...payload,
    version: delta.version || payload.version,
    core: delta.core ?? payload.core,
    nodes: [...byId.values()],
    edges: delta.edges ?? payload.edges,
  };
}

/** Overlay §3.3 completeness from a `hello` frame without touching positions. */
export function applyBrainCompleteness(payload: GraphPayload, value: number): GraphPayload {
  const c = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  if (c === payload.core.brainCompleteness) return payload;
  return { ...payload, core: { ...payload.core, brainCompleteness: c } };
}
