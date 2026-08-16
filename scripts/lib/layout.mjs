/**
 * THE LAYOUT ENGINE — one engine, two callers, one stored artifact (ADR-003).
 *
 *   computeLayout(agents, previousPositions, options) -> GraphPayload
 *
 * Pure. Deterministic. Dependency-free (ADR-006 — d3-force's `jiggle()` is
 * `Math.random()`, which would make CI's run-twice-and-diff check flap). It implements the
 * four forces §2.1 names — link, manyBody, radial-per-department, collide — with the same
 * velocity-Verlet integration d3-force uses, so the resulting *feel* is d3's.
 *
 * Callers: `scripts/build-graph.mjs` (build/CI) and the runner's chokidar watcher.
 * Payload shape: `packages/contracts/src/graph.ts` + `comms/contracts/graph-layout.md`.
 *
 * The stability rule is the point of the file (ADR-003): nodes that already have
 * coordinates keep them and are pinned for the first `pinTicks`, so adding an agent moves
 * that agent's neighbourhood and never the whole galaxy.
 */

import { createHash } from 'node:crypto';
import { ADR_001_DEPARTMENTS, branchAngle } from './departments.mjs';

/* ── tuning ────────────────────────────────────────────────────────────────── */

export const LAYOUT = {
  /** ADR-003: fixed tick count, no convergence test — a convergence test is an input we
   *  cannot reproduce from the repo alone. */
  ticks: 400,
  /** Previously-placed nodes are `fx`/`fy` for this long, then released into a low-alpha
   *  relax phase so new neighbours settle against them without shoving the galaxy. */
  pinTicks: 200,
  alphaStart: 1,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
  /** Radial force target per depth: core, anchor, job, leaf. */
  ringRadius: [0, 320, 560, 690],
  ringStrength: [0, 0.28, 0.1, 0.05],
  /** Lateral spring holding a branch on its ADR-001 ray. d3 has no such force; this is why
   *  ADR-006 exists. Leaves are held loosest so clusters can fan out (§2.2). */
  branchStrength: [0, 0.6, 0.22, 0.07],
  /** manyBody. `distanceMax` is what makes distant departments provably unaffected by a
   *  new agent — see the stability test. */
  charge: { anchor: -900, job: -260, leaf: -70 },
  chargeDistanceMax: 420,
  chargeDistanceMin: 2,
  link: {
    'core-anchor': { distance: 320, strength: 0.5 },
    'anchor-job': { distance: 150, strength: 0.35 },
    'job-leaf': { distance: 58, strength: 0.7 },
    'builds-on': { distance: 190, strength: 0.05 },
  },
  collidePadding: [0, 26, 20, 8],
  collideStrength: 0.85,
  /**
   * Sticky positions. A node that already had coordinates keeps them **exactly** unless
   * the simulation wants to move it further than this, in which case it takes the new
   * place. Kills the sub-pixel creep that would otherwise churn `positions.json` on every
   * rebuild.
   */
  stickyEpsilon: 1.5,
  /**
   * How far the ripple from a new node reaches. A previously-placed node is released after
   * `pinTicks` only if it lies within this distance of a node that has no stored position;
   * everything further away stays pinned for the whole run.
   *
   * This is ADR-003's "only new nodes are free to find a place", taken literally. It also
   * makes the determinism gate provable rather than empirical: with nothing new in the
   * repo, no node is ever released, so a rebuild is the identity function.
   */
  thawRadius: 420,
  /** Node radii in px. Spec §2.1 quotes diameters: anchor 44, job 28–32, leaf 8–10. */
  radius: { anchor: 22, jobMin: 14, jobMax: 16, leafMin: 4, leafMax: 5 },
  /** Padding added to the payload bounds so the initial camera never clips a label. */
  boundsPadding: 160,
};

/* ── deterministic primitives ──────────────────────────────────────────────── */

/** mulberry32 — 32-bit, seeded, no global state. The only randomness in the engine. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a. Used to derive per-edge curvature so a branch does not re-bend between visits. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const round1 = (n) => Math.round(n * 10) / 10;

/* ── normalisation ─────────────────────────────────────────────────────────── */

const VALID_STATUS = new Set(['live', 'draft', 'failing']);

/**
 * Accepts raw frontmatter records and returns the layout-relevant projection, sorted by
 * id so iteration order — and therefore the whole simulation — is input-order independent.
 */
function normalise(agents, departmentIds, warn) {
  const seen = new Set();
  const out = [];

  for (const a of agents ?? []) {
    const department = String(a.department ?? '').trim();
    const slug = String(a.slug ?? '').trim();
    if (!slug) {
      warn(`agent with no slug skipped (${a.name ?? 'unnamed'})`);
      continue;
    }
    if (!departmentIds.has(department)) {
      warn(`${department}/${slug}: department "${department}" is not one of the seven (ADR-001) — excluded`);
      continue;
    }
    const id = `${department}/${slug}`;
    if (seen.has(id)) {
      warn(`${id}: duplicate agent id — second one excluded`);
      continue;
    }
    seen.add(id);

    const status = VALID_STATUS.has(a.status) ? a.status : 'draft';
    const leaves = (Array.isArray(a.breaks_into) ? a.breaks_into : [])
      .map((l) => String(l).trim())
      .filter(Boolean);

    out.push({
      id,
      slug,
      department,
      name: String(a.name ?? slug),
      cluster: a.cluster ? String(a.cluster) : null,
      icon: a.icon ? String(a.icon) : null,
      status,
      scheduled: Boolean(a.schedule),
      /** §3.2: `approval: required` is a capability; a *pending gate* is runtime state the
       *  runner pushes over `/ws/graph`. A stored payload is never born pulsing. */
      approvalPending: Boolean(a.approvalPending),
      leaves: [...new Set(leaves)],
      buildsOn: (Array.isArray(a.builds_on) ? a.builds_on : []).map((b) => String(b).trim()).filter(Boolean),
    });
  }

  out.sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  return out;
}

/**
 * A registry cluster is `{slug, label}` (owner: `agent-library-curator`), and §2.2 renders
 * the caption **verbatim** — `SEQUENCING & SEND`, ampersand and all. So the sub-label is
 * `label`, never the slug. A bare string is accepted too, because the contract's
 * illustrative JSON showed strings and a registry that predates the object form must not
 * silently produce `[object Object]` under seven department names.
 */
function clusterLabel(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object') return String(entry.label ?? entry.slug ?? '').trim();
  return '';
}

/* ── graph construction ────────────────────────────────────────────────────── */

function buildGraph(normalised, departments, clusters) {
  const nodes = [];
  const edges = [];
  const byId = new Map();

  const push = (n) => {
    nodes.push(n);
    byId.set(n.id, n);
    return n;
  };

  for (const d of departments) {
    push({
      id: `${d.id}/_anchor`,
      kind: 'anchor',
      label: d.label,
      department: d.id,
      cluster: null,
      icon: null,
      status: 'draft',
      scheduled: false,
      approvalPending: false,
      depth: 1,
      r: LAYOUT.radius.anchor,
    });
    edges.push({ source: 'core', target: `${d.id}/_anchor`, kind: 'tree' });
  }

  for (const a of normalised) {
    const anchorId = `${a.department}/_anchor`;
    const r =
      LAYOUT.radius.jobMin + (a.leaves.length > 0 ? 1 : 0) + (a.status === 'live' ? 1 : 0);
    push({
      id: a.id,
      kind: 'job',
      label: a.name,
      department: a.department,
      cluster: a.cluster,
      icon: a.icon,
      status: a.status,
      scheduled: a.scheduled,
      approvalPending: a.approvalPending,
      depth: 2,
      r: Math.min(r, LAYOUT.radius.jobMax),
    });
    edges.push({ source: anchorId, target: a.id, kind: 'tree' });

    for (const leaf of a.leaves) {
      push({
        id: `${a.id}/${leaf}`,
        kind: 'leaf',
        label: leaf,
        department: a.department,
        cluster: a.cluster,
        icon: null,
        status: a.status === 'failing' ? 'failing' : a.status,
        scheduled: false,
        approvalPending: false,
        depth: 3,
        r: a.status === 'live' ? LAYOUT.radius.leafMax : LAYOUT.radius.leafMin,
      });
      edges.push({ source: a.id, target: `${a.id}/${leaf}`, kind: 'tree' });
    }
  }

  // builds_on → prerequisite edges. Resolved by slug across the whole library
  // (frontmatter invariant 2), which is why the index is keyed by bare slug too.
  const bySlug = new Map();
  for (const a of normalised) if (!bySlug.has(a.slug)) bySlug.set(a.slug, a.id);
  for (const a of normalised) {
    for (const dep of a.buildsOn) {
      const sourceId = bySlug.get(dep) ?? (byId.has(dep) ? dep : null);
      if (!sourceId || sourceId === a.id) continue; // dangling refs fail the *validator*, not the map
      edges.push({ source: sourceId, target: a.id, kind: 'builds-on' });
    }
  }

  // Cluster sub-labels: first three from the registry, padded honestly (§2.1).
  const departmentMeta = departments.map((d) => {
    const registry = (Array.isArray(clusters?.[d.id]) ? clusters[d.id] : []).map(clusterLabel).filter(Boolean);
    const present = [...new Set(normalised.filter((a) => a.department === d.id).map((a) => a.cluster).filter(Boolean))];
    const source = registry.length ? registry : present;
    const sublabels = [source[0] ?? '', source[1] ?? '', source[2] ?? ''];
    const mine = normalised.filter((a) => a.department === d.id);
    return {
      id: d.id,
      label: d.label,
      angle: d.angle,
      sublabels,
      anchor: `${d.id}/_anchor`,
      liveCount: mine.filter((a) => a.status === 'live').length,
      totalCount: mine.length,
    };
  });

  return { nodes, edges, byId, departmentMeta };
}

/** An edge pulses when its downstream subtree is alive (§2.1 "edges of live branches"). */
function markPulses(nodes, edges) {
  const live = new Set(nodes.filter((n) => n.status === 'live').map((n) => n.id));
  const children = new Map();
  for (const e of edges) {
    if (e.kind !== 'tree') continue;
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source).push(e.target);
  }
  const liveBelow = new Map();
  const walk = (id, guard = new Set()) => {
    if (liveBelow.has(id)) return liveBelow.get(id);
    if (guard.has(id)) return false;
    guard.add(id);
    let alive = live.has(id);
    for (const c of children.get(id) ?? []) if (walk(c, guard)) alive = true;
    liveBelow.set(id, alive);
    return alive;
  };
  walk('core');

  for (const e of edges) {
    e.pulse = e.kind === 'tree' && (liveBelow.get(e.target) ?? false);
    const h = hashString(`${e.source}->${e.target}`);
    // ±0.10…0.22 — "slight quadratic curve", deterministic per edge.
    e.curve = round1(((h % 13) / 100 + 0.1) * (h & 1 ? 1 : -1) * 100) / 100;
  }
}

/* ── seeding ───────────────────────────────────────────────────────────────── */

function seedPositions(nodes, byId, edges, previous, departments, rand) {
  const angleOf = new Map(departments.map((d) => [d.id, d.angle]));
  const parent = new Map();
  for (const e of edges) if (e.kind === 'tree') parent.set(e.target, e.source);

  for (const n of nodes) {
    const prev = previous?.[n.id];
    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
      n.x = prev.x;
      n.y = prev.y;
      n.seeded = true; // eligible for pinning, and for the sticky snap-back
      n.seedX = prev.x;
      n.seedY = prev.y;
      continue;
    }
    n.seeded = false;

    const angle = angleOf.get(n.department) ?? 0;
    const p = byId.get(parent.get(n.id));
    const radius = LAYOUT.ringRadius[n.depth];
    if (p && Number.isFinite(p.x)) {
      // Grow outward from the parent, so a new agent appears *next to its branch*.
      const spread = (rand() - 0.5) * 0.35;
      n.x = p.x + Math.cos(angle + spread) * (radius - LAYOUT.ringRadius[p.depth] || 90);
      n.y = p.y + Math.sin(angle + spread) * (radius - LAYOUT.ringRadius[p.depth] || 90);
    } else {
      const spread = (rand() - 0.5) * 0.4;
      n.x = Math.cos(angle + spread) * radius;
      n.y = Math.sin(angle + spread) * radius;
    }
    // Gaussian-ish jitter breaks perfect collinearity so collide has something to resolve.
    n.x += (rand() + rand() - 1) * 24;
    n.y += (rand() + rand() - 1) * 24;
  }
}

/* ── the four forces ───────────────────────────────────────────────────────── */

function linkSpec(edge, byId) {
  if (edge.kind === 'builds-on') return LAYOUT.link['builds-on'];
  const s = edge.source === 'core' ? { kind: 'core' } : byId.get(edge.source);
  const t = byId.get(edge.target);
  if (!s || !t) return null;
  if (s.kind === 'core') return LAYOUT.link['core-anchor'];
  if (s.kind === 'anchor') return LAYOUT.link['anchor-job'];
  return LAYOUT.link['job-leaf'];
}

/**
 * Decide which previously-placed nodes are allowed to move at all. A seeded node thaws if
 * it is near an unseeded one, or is its tree parent. With no unseeded nodes, nothing thaws
 * and the simulation cannot change anything — see LAYOUT.thawRadius.
 */
function markThawed(nodes, edges, byId) {
  const fresh = nodes.filter((n) => !n.seeded);
  for (const n of nodes) n.thawed = !n.seeded;
  if (fresh.length === 0) return;

  const r2 = LAYOUT.thawRadius * LAYOUT.thawRadius;
  for (const n of nodes) {
    if (n.thawed) continue;
    for (const f of fresh) {
      const dx = f.x - n.x;
      const dy = f.y - n.y;
      if (dx * dx + dy * dy <= r2) {
        n.thawed = true;
        break;
      }
    }
  }
  // A new node's parent always thaws, however far away it sits, so a branch can lengthen.
  for (const e of edges) {
    if (e.kind !== 'tree' || e.source === 'core') continue;
    const t = byId.get(e.target);
    const s = byId.get(e.source);
    if (t && s && !t.seeded) s.thawed = true;
  }
}

function simulate(nodes, edges, byId, departments, options) {
  const { ticks, pinTicks } = options;
  const angleOf = new Map(departments.map((d) => [d.id, d.angle]));

  for (const n of nodes) {
    n.vx = 0;
    n.vy = 0;
  }

  // Precompute the link list once — `core` is a fixed point at the origin, not a node.
  const links = [];
  for (const e of edges) {
    const spec = linkSpec(e, byId);
    if (!spec) continue;
    const s = e.source === 'core' ? null : byId.get(e.source);
    const t = byId.get(e.target);
    if (!t) continue;
    links.push({ s, t, distance: spec.distance, strength: spec.strength });
  }

  let alpha = LAYOUT.alphaStart;

  for (let tick = 0; tick < ticks; tick++) {
    const early = tick < pinTicks;
    /** A seeded node is immovable while pinned, and permanently if nothing new is near it. */
    const isFixed = (n) => n.seeded && (early || !n.thawed);

    // ── link ──────────────────────────────────────────────────────────────
    for (const l of links) {
      const sx = l.s ? l.s.x + l.s.vx : 0;
      const sy = l.s ? l.s.y + l.s.vy : 0;
      let dx = l.t.x + l.t.vx - sx;
      let dy = l.t.y + l.t.vy - sy;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const k = ((dist - l.distance) / dist) * alpha * l.strength;
      dx *= k;
      dy *= k;
      l.t.vx -= dx;
      l.t.vy -= dy;
      if (l.s) {
        l.s.vx += dx;
        l.s.vy += dy;
      }
    }

    // ── manyBody (naive N², distance-capped — ~150 nodes, see ADR-006) ────
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > LAYOUT.chargeDistanceMax * LAYOUT.chargeDistanceMax) continue;
        if (d2 < LAYOUT.chargeDistanceMin) {
          dx = LAYOUT.chargeDistanceMin;
          dy = 0;
          d2 = LAYOUT.chargeDistanceMin * LAYOUT.chargeDistanceMin;
        }
        const qa = LAYOUT.charge[a.kind];
        const qb = LAYOUT.charge[b.kind];
        const fa = (qb * alpha) / d2;
        const fb = (qa * alpha) / d2;
        a.vx += dx * fa;
        a.vy += dy * fa;
        b.vx -= dx * fb;
        b.vy -= dy * fb;
      }
    }

    // ── radial per department + branch spring ─────────────────────────────
    for (const n of nodes) {
      const radius = LAYOUT.ringRadius[n.depth];
      const rs = LAYOUT.ringStrength[n.depth];
      const dx = n.x || 1e-6;
      const dy = n.y || 1e-6;
      const r = Math.sqrt(dx * dx + dy * dy);
      const k = ((radius - r) * rs * alpha) / r;
      n.vx += dx * k;
      n.vy += dy * k;

      // Hold the branch on its ADR-001 ray: spring away the lateral component.
      const angle = angleOf.get(n.department);
      if (angle === undefined) continue;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const proj = n.x * ux + n.y * uy;
      const latx = n.x - ux * proj;
      const laty = n.y - uy * proj;
      const bs = LAYOUT.branchStrength[n.depth] * alpha;
      n.vx -= latx * bs;
      n.vy -= laty * bs;
      // Never let a branch fold back through the core.
      if (proj < radius * 0.25) {
        n.vx += ux * (radius * 0.25 - proj) * 0.3 * alpha;
        n.vy += uy * (radius * 0.25 - proj) * 0.3 * alpha;
      }
    }

    // ── integrate ─────────────────────────────────────────────────────────
    for (const n of nodes) {
      if (isFixed(n)) {
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= 1 - LAYOUT.velocityDecay;
      n.vy *= 1 - LAYOUT.velocityDecay;
      n.x += n.vx;
      n.y += n.vy;
    }

    // ── collide (position-space, one relaxation pass) ─────────────────────
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const ra = a.r + LAYOUT.collidePadding[a.depth];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const rb = b.r + LAYOUT.collidePadding[b.depth];
        const want = ra + rb;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= want * want || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((want - d) / d) * LAYOUT.collideStrength * 0.5;
        dx *= push;
        dy *= push;
        const aFixed = isFixed(a);
        const bFixed = isFixed(b);
        if (aFixed && bFixed) continue;
        if (!bFixed) {
          b.x += dx * (aFixed ? 2 : 1);
          b.y += dy * (aFixed ? 2 : 1);
        }
        if (!aFixed) {
          a.x -= dx * (bFixed ? 2 : 1);
          a.y -= dy * (bFixed ? 2 : 1);
        }
      }
    }

    alpha *= 1 - LAYOUT.alphaDecay;
  }

  // Sticky snap-back: undo sub-epsilon creep on nodes that already had a home, so an
  // unchanged repo rebuilds to identical bytes (see LAYOUT.stickyEpsilon).
  for (const n of nodes) {
    if (!n.seeded) continue;
    if (Math.hypot(n.x - n.seedX, n.y - n.seedY) < LAYOUT.stickyEpsilon) {
      n.x = n.seedX;
      n.y = n.seedY;
    }
  }
}

/* ── version hash ──────────────────────────────────────────────────────────── */

/** ADR-003: `sha256(sorted agent slugs + their layout-relevant frontmatter)`. */
export function layoutVersion(normalised, departments) {
  const h = createHash('sha256');
  h.update(departments.map((d) => `${d.id}:${d.angle.toFixed(6)}`).join('|'));
  for (const a of normalised) {
    h.update(
      `\n${a.id}|${a.cluster ?? ''}|${a.icon ?? ''}|${a.status}|${a.scheduled ? 1 : 0}|` +
        `${a.leaves.join(',')}|${a.buildsOn.join(',')}`,
    );
  }
  return `sha256:${h.digest('hex')}`;
}

/* ── the entry point ───────────────────────────────────────────────────────── */

/**
 * @param {Array<object>} agents  normalised-ish frontmatter records: `{slug, department,
 *        name, cluster, icon, status, breaks_into, builds_on, schedule, approvalPending}`
 * @param {Record<string,{x:number,y:number}>} [previousPositions] from
 *        `agents/_registry/positions.json` — the reason the map is stable across clones
 * @param {object} [options] `{departments, clusters, brainCompleteness, brainAnswered,
 *        brainTotal, seed, ticks, pinTicks, now, warn}`. The three `brain*` values are
 *        inputs measured by `lib/brain-completeness.mjs`; this engine never reads
 *        `company/` itself (ADR-003).
 * @returns {import('../../packages/contracts/src/graph.js').GraphPayload}
 */
export function computeLayout(agents, previousPositions = {}, options = {}) {
  const warn = options.warn ?? (() => {});
  const departments =
    options.departments ??
    ADR_001_DEPARTMENTS.map((d, index) => ({ ...d, index, angle: branchAngle(index, 7) }));
  const departmentIds = new Set(departments.map((d) => d.id));

  const normalised = normalise(agents, departmentIds, warn);
  const { nodes, edges, byId, departmentMeta } = buildGraph(normalised, departments, options.clusters);
  markPulses(nodes, edges);

  const rand = mulberry32(options.seed ?? 0x5ee7);
  seedPositions(nodes, byId, edges, previousPositions, departments, rand);
  markThawed(nodes, edges, byId);
  simulate(nodes, edges, byId, departments, {
    ticks: options.ticks ?? LAYOUT.ticks,
    pinTicks: options.pinTicks ?? LAYOUT.pinTicks,
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const outNodes = nodes.map((n) => {
    const x = round1(n.x);
    const y = round1(n.y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    return {
      id: n.id,
      kind: n.kind,
      label: n.label,
      department: n.department,
      cluster: n.cluster,
      icon: n.icon,
      status: n.status,
      scheduled: n.scheduled,
      approvalPending: n.approvalPending,
      depth: n.depth,
      x,
      y,
      r: n.r,
    };
  });

  const pad = LAYOUT.boundsPadding;
  const bounds = Number.isFinite(minX)
    ? { x: [round1(minX - pad), round1(maxX + pad)], y: [round1(minY - pad), round1(maxY + pad)] }
    : { x: [-pad, pad], y: [-pad, pad] };

  const completeness = Number.isFinite(options.brainCompleteness)
    ? Math.min(1, Math.max(0, options.brainCompleteness))
    : 0;

  // §3.3 — the count behind the fraction. Carried so the number is auditable against
  // COMPANY.md by anyone holding the payload, and so the UI can say "0 of 20 answered"
  // without keeping its own copy of the interview's length. `null` means "not measured",
  // which is a different claim from zero and is rendered differently.
  const brainTotal =
    Number.isInteger(options.brainTotal) && options.brainTotal > 0 ? options.brainTotal : null;
  const brainAnswered =
    Number.isInteger(options.brainAnswered) && brainTotal !== null
      ? Math.min(brainTotal, Math.max(0, options.brainAnswered))
      : null;

  return {
    version: layoutVersion(normalised, departments),
    computedAt: options.now ?? new Date().toISOString(),
    bounds,
    core: { x: 0, y: 0, brainCompleteness: completeness, brainAnswered, brainTotal },
    departments: departmentMeta,
    nodes: outNodes,
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
      curve: e.curve,
      pulse: e.pulse,
    })),
  };
}

/** Extract the committed half of the artifact (ADR-003: positions survive; the rest is
 *  re-derived from frontmatter on every build). */
export function toStoredPositions(payload) {
  const positions = {};
  for (const n of [...payload.nodes].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    positions[n.id] = { x: n.x, y: n.y };
  }
  return { version: payload.version, computedAt: payload.computedAt, positions };
}
