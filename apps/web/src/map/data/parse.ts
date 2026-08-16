/**
 * Defensive parse of `GET /api/graph` / `public/graph.json` into the contract shape.
 *
 * A payload that does not parse is `null` — the map then shows the honest empty state
 * rather than inventing nodes (standing rule 9). We never fill `liveCount` or fabricate
 * a department that is not in the payload.
 */

import type {
  GraphBounds,
  GraphCore,
  GraphDepartment,
  GraphEdge,
  GraphEdgeKind,
  GraphNode,
  GraphNodeKind,
  GraphNodeStatus,
  GraphPayload,
} from '@agnetos/contracts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const KINDS: ReadonlySet<string> = new Set(['anchor', 'job', 'leaf']);
const STATUSES: ReadonlySet<string> = new Set(['live', 'draft', 'failing']);
const EDGE_KINDS: ReadonlySet<string> = new Set(['tree', 'builds-on']);

function parseBounds(raw: unknown): GraphBounds | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.x) || !Array.isArray(raw.y) || raw.x.length !== 2 || raw.y.length !== 2) {
    return null;
  }
  const x0 = num(raw.x[0]);
  const x1 = num(raw.x[1]);
  const y0 = num(raw.y[0]);
  const y1 = num(raw.y[1]);
  if (x0 === null || x1 === null || y0 === null || y1 === null) return null;
  return { x: [x0, x1], y: [y0, y1] };
}

/** A whole count, or `null` for "not measured" — never coerced to 0, which is a claim. */
const count = (value: unknown): number | null => {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
};

function parseCore(raw: unknown): GraphCore | null {
  if (!isRecord(raw)) return null;
  const x = num(raw.x);
  const y = num(raw.y);
  const brain = num(raw.brainCompleteness);
  if (x === null || y === null) return null;
  const completeness = brain === null ? 0 : Math.min(1, Math.max(0, brain));
  const brainTotal = count(raw.brainTotal);
  const answered = count(raw.brainAnswered);
  return {
    x,
    y,
    brainCompleteness: completeness,
    // A count without its denominator says nothing, and a count above it is a lie the map
    // would repeat in words. Both drop to "not measured" rather than being rendered.
    brainTotal: brainTotal !== null && brainTotal > 0 ? brainTotal : null,
    brainAnswered:
      brainTotal !== null && brainTotal > 0 && answered !== null && answered <= brainTotal
        ? answered
        : null,
  };
}

function parseDepartment(raw: unknown): GraphDepartment | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const label = str(raw.label);
  const angle = num(raw.angle);
  const anchor = str(raw.anchor);
  const liveCount = num(raw.liveCount);
  const totalCount = num(raw.totalCount);
  if (!id || !label || angle === null || !anchor || liveCount === null || totalCount === null) {
    return null;
  }
  const rawSubs = Array.isArray(raw.sublabels) ? raw.sublabels : [];
  const subs = [0, 1, 2].map((i) => (typeof rawSubs[i] === 'string' ? rawSubs[i] : '')) as [
    string,
    string,
    string,
  ];
  return { id, label, angle, sublabels: subs, anchor, liveCount, totalCount };
}

function parseNode(raw: unknown): GraphNode | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const kind = str(raw.kind);
  const label = str(raw.label);
  const department = str(raw.department);
  const status = str(raw.status);
  const x = num(raw.x);
  const y = num(raw.y);
  const r = num(raw.r);
  const depth = num(raw.depth);
  if (!id || !kind || !KINDS.has(kind) || !label || !department) return null;
  if (!status || !STATUSES.has(status) || x === null || y === null || r === null) return null;
  return {
    id,
    kind: kind as GraphNodeKind,
    label,
    department,
    cluster: typeof raw.cluster === 'string' && raw.cluster.length > 0 ? raw.cluster : null,
    icon: typeof raw.icon === 'string' && raw.icon.length > 0 ? raw.icon : null,
    status: status as GraphNodeStatus,
    scheduled: Boolean(raw.scheduled),
    approvalPending: Boolean(raw.approvalPending),
    depth: depth ?? (kind === 'anchor' ? 1 : kind === 'job' ? 2 : 3),
    x,
    y,
    r,
  };
}

function parseEdge(raw: unknown): GraphEdge | null {
  if (!isRecord(raw)) return null;
  const source = str(raw.source);
  const target = str(raw.target);
  const kind = str(raw.kind);
  const curve = num(raw.curve);
  if (!source || !target || !kind || !EDGE_KINDS.has(kind) || curve === null) return null;
  return {
    source,
    target,
    kind: kind as GraphEdgeKind,
    curve,
    pulse: Boolean(raw.pulse),
  };
}

/** `null` means "this is not a graph payload" — never a half-built map. */
export function parseGraphPayload(json: unknown): GraphPayload | null {
  if (!isRecord(json)) return null;
  const version = str(json.version);
  const computedAt = str(json.computedAt);
  const bounds = parseBounds(json.bounds);
  const core = parseCore(json.core);
  if (!version || !computedAt || !bounds || !core) return null;
  if (!Array.isArray(json.departments) || !Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
    return null;
  }

  const departments: GraphDepartment[] = [];
  for (const row of json.departments) {
    const d = parseDepartment(row);
    if (d) departments.push(d);
  }

  const nodes: GraphNode[] = [];
  for (const row of json.nodes) {
    const n = parseNode(row);
    if (n) nodes.push(n);
  }

  const edges: GraphEdge[] = [];
  for (const row of json.edges) {
    const e = parseEdge(row);
    if (e) edges.push(e);
  }

  return { version, computedAt, bounds, core, departments, nodes, edges };
}
