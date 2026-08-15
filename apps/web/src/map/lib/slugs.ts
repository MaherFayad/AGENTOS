import type { GraphNode } from '@agnetos/contracts';

/** Job drawer slug — leaves resolve to their parent job. Anchors have none. */
export function jobSlug(node: GraphNode): string | null {
  if (node.kind === 'anchor') return null;
  const parts = node.id.split('/');
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

export function agentSegment(slug: string): string {
  return slug.split('/')[1] ?? slug;
}

export function cycleId(ids: readonly string[], current: string | null, step: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const index = current ? ids.indexOf(current) : -1;
  const from = index < 0 ? 0 : index;
  return ids[(from + step + ids.length) % ids.length] ?? null;
}
