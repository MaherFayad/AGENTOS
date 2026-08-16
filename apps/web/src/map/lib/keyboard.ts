/**
 * Keyboard navigation for the galaxy. Pure — no React, no DOM.
 *
 * The map is a spatial graph with ~150 nodes. Making each one a tab stop would mean 150
 * presses to cross the shell, which is technically "reachable" and practically unusable.
 * So the node layer is a **roving tabindex**: one tab stop into the graph, then the arrows
 * move spatially and Tab leaves. That is the same pattern a tree view uses, and it is what
 * makes "every node reachable by keyboard" true rather than nominal.
 *
 * Spec: §2.1 (the interaction budget is mouse-first; this is the equivalent path),
 * Part VI acceptance (a11y).
 */

import type { GraphNode } from '@agnetos/contracts';

export type ArrowDirection = 'left' | 'right' | 'up' | 'down';

const UNIT: Record<ArrowDirection, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/**
 * The half-angle of the cone an arrow key searches, in radians (60°). Wide enough that a
 * branch running at 51.4° (the ADR-001 spoke angle) is still reachable with one arrow;
 * narrow enough that "right" never selects something above you.
 */
const CONE = Math.PI / 3;

/**
 * Nearest node in the pressed direction. Distance is penalised by angular deviation, so a
 * node dead ahead beats a slightly closer one off to the side — otherwise arrowing along a
 * branch drifts sideways into a neighbouring department.
 */
export function nodeInDirection(
  nodes: readonly GraphNode[],
  fromId: string | null,
  direction: ArrowDirection,
): string | null {
  const from = nodes.find((n) => n.id === fromId);
  if (!from) return nodes[0]?.id ?? null;

  const u = UNIT[direction];
  let best: string | null = null;
  let bestScore = Infinity;

  for (const n of nodes) {
    if (n.id === from.id) continue;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) continue;
    const cos = (dx * u.x + dy * u.y) / dist;
    if (cos < Math.cos(CONE)) continue;
    // 1 at dead-ahead, growing as the node drifts off-axis.
    const score = dist / (cos * cos);
    if (score < bestScore) {
      bestScore = score;
      best = n.id;
    }
  }
  return best;
}

/**
 * Where the roving focus starts, and where `Home` returns to: the anchor of the department
 * currently in focus, or the first anchor. Never a leaf — landing on an unlabelled 8px dot
 * tells a screen-reader user nothing about where they are.
 */
export function entryNode(nodes: readonly GraphNode[], department: string | null): string | null {
  const anchors = nodes.filter((n) => n.kind === 'anchor');
  if (department) {
    const mine = anchors.find((n) => n.department === department);
    if (mine) return mine.id;
  }
  return anchors[0]?.id ?? nodes[0]?.id ?? null;
}

/** Tab order *within* a branch, for `[` / `]`: cycle the seven anchors. */
export function siblingAnchor(
  nodes: readonly GraphNode[],
  fromId: string | null,
  step: 1 | -1,
): string | null {
  const anchors = nodes.filter((n) => n.kind === 'anchor');
  if (anchors.length === 0) return null;
  const from = nodes.find((n) => n.id === fromId);
  const index = anchors.findIndex((a) => a.department === from?.department);
  const next = index === -1 ? 0 : (index + step + anchors.length) % anchors.length;
  return anchors[next].id;
}

/**
 * The label a screen reader hears. Everything the sighted treatments encode — the copper
 * ring, the 45% dim, the amber halo, the clock badge — has to be in this string, or the
 * non-visual map is a different map.
 *
 * Two i18n properties this function has to hold and did not before 2026-08-17:
 *
 *   1. The fragments come from the catalogue (`map.node.aria.*`). They are their own keys
 *      rather than reuses of `map.node.state.*`: a chip that reads "Failing" and a phrase
 *      spoken as "failing its audit" are two registers, and MSA separates them further
 *      than English does.
 *   2. The join is `Intl.ListFormat`, never `', '`. The Arabic list separator is `، `
 *      (U+060C) — hardcoding the Latin comma is the same class of mistake as hardcoding a
 *      left margin, and it is the kind that survives a visual RTL review because the glyph
 *      is nearly invisible at label size.
 *
 * Stays pure: the caller passes `t` and `locale`, so this file still has no React import
 * and the keyboard tests can call it with a stub.
 */
export function nodeAriaLabel(
  node: GraphNode,
  departmentLabel: string,
  t: (key: NodeAriaKey) => string,
  locale = 'en',
): string {
  const parts: string[] = [node.label];
  if (node.kind === 'anchor') parts.push(t('map.node.aria.branch'));
  else parts.push(departmentLabel);
  if (node.cluster) parts.push(node.cluster);
  parts.push(
    node.status === 'live'
      ? t('map.node.aria.live')
      : node.status === 'failing'
        ? t('map.node.aria.failing')
        : t('map.node.aria.dormant'),
  );
  if (node.scheduled) parts.push(t('map.node.aria.scheduled'));
  if (node.approvalPending) parts.push(t('map.node.aria.awaitingApproval'));
  return new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(parts);
}

export type NodeAriaKey =
  | 'map.node.aria.branch'
  | 'map.node.aria.live'
  | 'map.node.aria.failing'
  | 'map.node.aria.dormant'
  | 'map.node.aria.scheduled'
  | 'map.node.aria.awaitingApproval';
