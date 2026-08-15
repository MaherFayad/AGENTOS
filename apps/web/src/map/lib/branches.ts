/**
 * Where the labels go. Pure geometry over the payload — no React.
 *
 * §2.1: "Each department = a wide-tracked serif-caps label (18–20px, --ivory-2, +0.4em)
 * with 3 tiny sub-labels beneath … and a tree of nodes growing outward from an anchor."
 * §2.2: "Sub-cluster labels float in wide-tracked caps around node groups."
 *
 * Both placements are DERIVED from where the nodes actually ended up, never from a table
 * of hand-tuned offsets. A branch that grows a new agent pushes its own label outward, and
 * a cluster that gains a node re-centres its caption — because both are computed from the
 * same coordinates the nodes are drawn at.
 */

import type { GraphDepartment, GraphNode } from '@agnetos/contracts';

export interface Placed {
  x: number;
  y: number;
}

export interface BranchLabel extends Placed {
  department: string;
  label: string;
  sublabels: readonly string[];
  /** SVG `text-anchor`, chosen from which side of the core the branch is on. */
  anchor: 'start' | 'middle' | 'end';
  liveCount: number;
  totalCount: number;
}

/** How far past the branch's outermost node the caps label sits, in world units. */
const LABEL_CLEARANCE = 96;

/**
 * Place a department's label beyond the far end of its own branch, on the branch's ray.
 *
 * "Beyond the far end" is measured by projecting every node in the department onto the
 * ADR-001 ray and taking the maximum — so the label clears the tree instead of landing on
 * top of whichever node happened to grow furthest out.
 */
export function branchLabels(
  departments: readonly GraphDepartment[],
  nodes: readonly GraphNode[],
): BranchLabel[] {
  return departments.map((d) => {
    const ux = Math.cos(d.angle);
    const uy = Math.sin(d.angle);
    const mine = nodes.filter((n) => n.department === d.id);

    let reach = 0;
    for (const n of mine) reach = Math.max(reach, n.x * ux + n.y * uy);
    // An empty branch still gets a label — an unpopulated department is a fact worth
    // showing, not a department to hide (standing rule 9).
    if (mine.length === 0) reach = 320;

    const distance = reach + LABEL_CLEARANCE;
    return {
      department: d.id,
      label: d.label.toUpperCase(),
      sublabels: d.sublabels.filter(Boolean),
      x: ux * distance,
      y: uy * distance,
      // Branches at 3 and 9 o'clock read better pushed away from the core; the ones near
      // the vertical are centred, because `start`/`end` there would look arbitrary.
      anchor: Math.abs(ux) < 0.35 ? 'middle' : ux > 0 ? 'start' : 'end',
      liveCount: d.liveCount,
      totalCount: d.totalCount,
    };
  });
}

export interface ClusterLabel extends Placed {
  department: string;
  cluster: string;
  label: string;
  count: number;
}

/**
 * §2.2's floating sub-cluster captions. One per `cluster` value present in the department,
 * placed above the centroid of that cluster's nodes and pushed outward along the branch ray
 * so it sits *around* the group rather than through it.
 */
export function clusterLabels(
  nodes: readonly GraphNode[],
  department: string,
  angle: number,
): ClusterLabel[] {
  const groups = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (n.department !== department || !n.cluster) continue;
    if (n.kind === 'leaf') continue; // leaves inherit their job's cluster; they'd double-weight it
    const list = groups.get(n.cluster);
    if (list) list.push(n);
    else groups.set(n.cluster, [n]);
  }

  // Perpendicular to the branch ray — the direction with the most free space.
  const px = -Math.sin(angle);
  const py = Math.cos(angle);

  return [...groups.entries()]
    .map(([cluster, members]) => {
      const cx = members.reduce((sum, n) => sum + n.x, 0) / members.length;
      const cy = members.reduce((sum, n) => sum + n.y, 0) / members.length;
      const spread = Math.max(...members.map((n) => Math.hypot(n.x - cx, n.y - cy)), 0);
      const offset = spread + 46;
      return {
        department,
        cluster,
        label: cluster.replace(/-/g, ' ').toUpperCase(),
        count: members.length,
        x: cx + px * offset,
        y: cy + py * offset,
      };
    })
    .sort((a, b) => (a.cluster < b.cluster ? -1 : 1));
}

/** World-space centre of a department's nodes — the §2.2 watermark and camera target. */
export function departmentCentre(nodes: readonly GraphNode[], department: string): Placed | null {
  const mine = nodes.filter((n) => n.department === department);
  if (mine.length === 0) return null;
  const xs = mine.map((n) => n.x);
  const ys = mine.map((n) => n.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * Real live/total for a scope. Anchors are excluded: an anchor is a branch marker, not an
 * agent, and counting seven of them would inflate `N OF 22` by seven (standing rule 9).
 * Leaves are excluded too — `breaks_into` steps are sub-tasks of an agent, not agents.
 */
export function countAgents(
  nodes: readonly GraphNode[],
  department: string | null,
): { live: number; total: number } {
  let live = 0;
  let total = 0;
  for (const n of nodes) {
    if (n.kind !== 'job') continue;
    if (department !== null && n.department !== department) continue;
    total++;
    if (n.status === 'live') live++;
  }
  return { live, total };
}
