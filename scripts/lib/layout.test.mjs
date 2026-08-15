/**
 * Tests for the layout engine. The two that matter are DETERMINISM and STABILITY —
 * they are the whole reason ADR-003 and ADR-006 exist. Everything else is guard rails.
 *
 *   node --test scripts/lib/layout.test.mjs
 *   npm test                      (via the scripts/__tests__ shim)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLayout, toStoredPositions, mulberry32, LAYOUT } from './layout.mjs';
import { branchAngle, ADR_001_DEPARTMENTS } from './departments.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

const NOW = '2026-08-15T00:00:00.000Z';
const opts = (extra = {}) => ({ now: NOW, ...extra });

/** A synthetic library across all seven branches — the engine is pure, so fixtures beat
 *  reading `agents/`, which another agent owns and fills on its own schedule. */
function library(count = 42) {
  const depts = ADR_001_DEPARTMENTS.map((d) => d.id);
  const statuses = ['live', 'draft', 'failing'];
  const agents = [];
  for (let i = 0; i < count; i++) {
    const department = depts[i % depts.length];
    agents.push({
      slug: `agent-${String(i).padStart(3, '0')}`,
      department,
      name: `Agent ${i}`,
      cluster: `cluster-${i % 4}`,
      icon: 'building',
      status: statuses[i % 3],
      breaks_into: i % 4 === 0 ? [`leaf-${i}-a`, `leaf-${i}-b`, `leaf-${i}-c`] : [],
      builds_on: i > 6 ? [`agent-${String(i - 7).padStart(3, '0')}`] : [],
      schedule: i % 5 === 0 ? '0 6 * * 1' : undefined,
    });
  }
  return agents;
}

const positionsOf = (payload) => new Map(payload.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

/* ── determinism ───────────────────────────────────────────────────────────── */

test('determinism: the same input twice produces byte-identical output', () => {
  const agents = library();
  const a = computeLayout(agents, {}, opts());
  const b = computeLayout(agents, {}, opts());
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('determinism: input order does not change the layout', () => {
  const agents = library();
  const shuffled = [...agents].reverse();
  const a = computeLayout(agents, {}, opts());
  const b = computeLayout(shuffled, {}, opts());
  assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes));
  assert.equal(a.version, b.version);
});

test('determinism: rebuilding an unchanged repo is exactly the identity function', () => {
  // The CI gate diffs `positions.json` byte for byte (ADR-003), so "close enough" is not
  // enough — sub-pixel creep would churn the file on every build. Nothing is thawed when
  // nothing is new, so nothing can move at all.
  const agents = library();
  const first = computeLayout(agents, {}, opts());
  const stored = toStoredPositions(first);
  const second = computeLayout(agents, stored.positions, opts());
  assert.deepEqual(toStoredPositions(second).positions, stored.positions);
  assert.equal(second.version, first.version);

  const third = computeLayout(agents, toStoredPositions(second).positions, opts());
  assert.deepEqual(toStoredPositions(third).positions, stored.positions, 'and it stays a fixed point');
});

test('determinism: the version hash tracks layout-relevant frontmatter only', () => {
  const agents = library(12);
  const base = computeLayout(agents, {}, opts()).version;

  const cosmetic = agents.map((a) => ({ ...a, description: 'reworded', the_human: 'x' }));
  assert.equal(computeLayout(cosmetic, {}, opts()).version, base, 'prose edits must not rehash');

  // index 1 is `draft` in the fixture's status cycle — flipping it is a real change.
  const structural = agents.map((a, i) => (i === 1 ? { ...a, status: 'live' } : a));
  assert.notEqual(computeLayout(structural, {}, opts()).version, base, 'status change must rehash');
});

test('mulberry32 is stable and seed-dependent', () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  const c = mulberry32(2);
  const seqA = [a(), a(), a()];
  assert.deepEqual(seqA, [b(), b(), b()]);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

/* ── stability (the ADR-003 promise) ───────────────────────────────────────── */

test('stability: adding one agent leaves every existing node within epsilon', () => {
  const agents = library();
  const before = computeLayout(agents, {}, opts());
  const seed = toStoredPositions(before).positions;

  const after = computeLayout(
    [...agents, { slug: 'newcomer', department: 'marketing', name: 'Newcomer', cluster: 'cluster-1', status: 'draft' }],
    seed,
    opts(),
  );

  const wasAt = positionsOf(before);
  let max = 0;
  let worst = '';
  const moves = [];
  for (const n of after.nodes) {
    const p = wasAt.get(n.id);
    if (!p) continue; // the newcomer
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    moves.push(d);
    if (d > max) {
      max = d;
      worst = n.id;
    }
  }

  moves.sort((x, y) => x - y);
  const p95 = moves[Math.floor(moves.length * 0.95)];
  // Measured on this fixture (42 agents, 83 nodes): max 9.96px — all of it inside the
  // newcomer's own cluster, which is the intended "neighbourhood settles" behaviour —
  // p95 1.94px, median 0.22px. The bars sit just above the measurement so a physics
  // regression trips them and a rounding change does not.
  assert.ok(max < 12, `worst existing node moved ${max.toFixed(2)}px (${worst}); expected < 12`);
  assert.ok(p95 < 3, `p95 displacement ${p95.toFixed(2)}px; expected < 3`);
  assert.ok(after.nodes.some((n) => n.id === 'marketing/newcomer'), 'the new node exists');
});

test('stability: a new agent does not disturb other departments at all', () => {
  const agents = library();
  const before = computeLayout(agents, {}, opts());
  const seed = toStoredPositions(before).positions;
  const after = computeLayout(
    [...agents, { slug: 'newcomer', department: 'marketing', name: 'Newcomer', status: 'draft' }],
    seed,
    opts(),
  );

  // `chargeDistanceMax` (420px) means adjacent branches still feel each other faintly, so
  // this is not literally zero — it is sub-pixel. Measured worst case across the other six
  // departments: 0.63px, i.e. invisible at any zoom in the 30–300% budget.
  const wasAt = positionsOf(before);
  for (const n of after.nodes) {
    if (n.department === 'marketing') continue;
    const p = wasAt.get(n.id);
    if (!p) continue;
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    assert.ok(d < 1, `${n.id} in ${n.department} moved ${d.toFixed(2)}px when a marketing agent was added`);
  }
});

test('stability: removing an agent does not move the survivors at all', () => {
  // A removal introduces no unseeded node, so nothing thaws. The hole stays a hole rather
  // than the branch collapsing inward — which is what "stable between visits" means.
  const agents = library();
  const before = computeLayout(agents, {}, opts());
  const seed = toStoredPositions(before).positions;
  const after = computeLayout(agents.slice(1), seed, opts());

  const wasAt = positionsOf(before);
  for (const n of after.nodes) {
    assert.deepEqual({ x: n.x, y: n.y }, wasAt.get(n.id), `${n.id} moved after an unrelated removal`);
  }
});

test('stability: a re-seeded build only thaws the neighbourhood of what is new', () => {
  const agents = library();
  const seed = toStoredPositions(computeLayout(agents, {}, opts())).positions;

  // Two newcomers in one department: everything that moves must be in, or adjacent to,
  // that branch — never a node six branches away.
  const after = computeLayout(
    [
      ...agents,
      { slug: 'n-one', department: 'customer', name: 'One', status: 'live', breaks_into: ['a', 'b'] },
      { slug: 'n-two', department: 'customer', name: 'Two', status: 'draft' },
    ],
    seed,
    opts(),
  );

  const moved = after.nodes.filter((n) => {
    const p = seed[n.id];
    return p && (p.x !== n.x || p.y !== n.y);
  });
  assert.ok(moved.length > 0, 'the newcomers must have made room for themselves');
  for (const n of moved) {
    assert.equal(n.department, 'customer', `${n.id} (${n.department}) moved for a customer-branch drop`);
  }
});

/* ── shape: departments, branches, sizes ───────────────────────────────────── */

test('seven branches at the ADR-001 angles, sales at twelve o’clock', () => {
  const p = computeLayout(library(), {}, opts());
  assert.equal(p.departments.length, 7);
  assert.equal(p.departments[0].id, 'sales');
  assert.equal(p.departments[0].angle, -Math.PI / 2);
  p.departments.forEach((d, i) => assert.equal(d.angle, branchAngle(i, 7)));
});

test('each branch stays on its own ray — no two departments overlap', () => {
  const p = computeLayout(library(70), {}, opts());
  const centroid = new Map();
  for (const n of p.nodes) {
    if (n.kind === 'leaf') continue;
    const c = centroid.get(n.department) ?? { x: 0, y: 0, n: 0 };
    c.x += n.x;
    c.y += n.y;
    c.n++;
    centroid.set(n.department, c);
  }
  const angles = [...centroid.entries()].map(([id, c]) => ({ id, a: Math.atan2(c.y / c.n, c.x / c.n) }));
  for (const d of p.departments) {
    const found = angles.find((a) => a.id === d.id);
    let diff = Math.abs(found.a - d.angle) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    assert.ok(diff < 0.26, `${d.id} centroid is ${diff.toFixed(2)}rad off its branch ray`);
  }
});

test('node radii match the §2.1 sizes (payload r is a radius; spec quotes diameters)', () => {
  const p = computeLayout(library(), {}, opts());
  for (const n of p.nodes) {
    if (n.kind === 'anchor') assert.equal(n.r * 2, 44);
    if (n.kind === 'job') assert.ok(n.r * 2 >= 28 && n.r * 2 <= 32, `job diameter ${n.r * 2}`);
    if (n.kind === 'leaf') assert.ok(n.r * 2 >= 8 && n.r * 2 <= 10, `leaf diameter ${n.r * 2}`);
  }
  assert.equal(p.nodes.filter((n) => n.kind === 'anchor').length, 7);
});

test('every node is reachable from the core through tree edges (keyboard reachability)', () => {
  const p = computeLayout(library(), {}, opts());
  const children = new Map();
  for (const e of p.edges) {
    if (e.kind !== 'tree') continue;
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source).push(e.target);
  }
  const seen = new Set();
  const stack = ['core'];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  for (const n of p.nodes) assert.ok(seen.has(n.id), `${n.id} is unreachable from the core`);
});

test('collision: no two nodes overlap after simulation', () => {
  const p = computeLayout(library(70), {}, opts());
  for (let i = 0; i < p.nodes.length; i++) {
    for (let j = i + 1; j < p.nodes.length; j++) {
      const a = p.nodes[i];
      const b = p.nodes[j];
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > a.r + b.r, `${a.id} overlaps ${b.id}`);
    }
  }
});

/* ── status, badges, pulses ────────────────────────────────────────────────── */

test('pulse dots only travel edges of live branches (§2.1)', () => {
  const p = computeLayout(
    [
      { slug: 'alive', department: 'sales', name: 'A', status: 'live', breaks_into: ['x'] },
      { slug: 'asleep', department: 'deals', name: 'B', status: 'draft' },
    ],
    {},
    opts(),
  );
  const edge = (t) => p.edges.find((e) => e.target === t);
  assert.equal(edge('sales/_anchor').pulse, true, 'the spoke to a live branch pulses');
  assert.equal(edge('deals/_anchor').pulse, false, 'a dormant branch does not');
  assert.equal(edge('sales/alive').pulse, true);
  assert.equal(edge('deals/asleep').pulse, false);
});

test('edge curvature is slight, signed and stable per edge', () => {
  const a = computeLayout(library(20), {}, opts());
  const b = computeLayout(library(20), {}, opts());
  for (const [i, e] of a.edges.entries()) {
    assert.equal(e.curve, b.edges[i].curve, 'a branch must not re-bend between visits');
    assert.ok(Math.abs(e.curve) >= 0.1 && Math.abs(e.curve) <= 0.22, `curve ${e.curve} out of range`);
  }
});

test('badges: schedule sets the clock, approval pending is runtime-only (§3.2)', () => {
  const p = computeLayout(
    [
      { slug: 'cron', department: 'operations', name: 'C', status: 'live', schedule: '0 6 * * 1' },
      { slug: 'gate', department: 'operations', name: 'G', status: 'live', approval: 'required' },
    ],
    {},
    opts(),
  );
  assert.equal(p.nodes.find((n) => n.id === 'operations/cron').scheduled, true);
  assert.equal(p.nodes.find((n) => n.id === 'operations/gate').scheduled, false);
  assert.equal(
    p.nodes.find((n) => n.id === 'operations/gate').approvalPending,
    false,
    '`approval: required` is a capability, not a pending gate — the pulse comes from /ws/graph',
  );
});

test('an unknown status degrades to draft rather than rendering half-parsed', () => {
  const p = computeLayout([{ slug: 'odd', department: 'sales', name: 'O', status: 'banana' }], {}, opts());
  assert.equal(p.nodes.find((n) => n.id === 'sales/odd').status, 'draft');
});

test('an agent in an unknown department is excluded, loudly', () => {
  const warnings = [];
  const p = computeLayout(
    [{ slug: 'stray', department: 'legal', name: 'S', status: 'live' }],
    {},
    opts({ warn: (m) => warnings.push(m) }),
  );
  assert.equal(p.nodes.filter((n) => n.kind === 'job').length, 0);
  assert.match(warnings.join(' '), /legal/);
});

/* ── honest empty state (CLAUDE.md rule 9) ─────────────────────────────────── */

test('zero agents renders seven empty branches and a dark core, not fake data', () => {
  const p = computeLayout([], {}, opts());
  assert.equal(p.nodes.length, 7, 'the seven anchors and nothing else');
  assert.ok(p.nodes.every((n) => n.kind === 'anchor'));
  assert.equal(p.edges.length, 7);
  assert.equal(p.core.brainCompleteness, 0);
  assert.ok(p.departments.every((d) => d.totalCount === 0 && d.liveCount === 0));
  assert.ok(p.departments.every((d) => d.sublabels.length === 3));
});

test('sublabels come from the cluster registry, padded honestly when it is thin', () => {
  const clusters = { sales: ['lead-sourcing', 'enrichment', 'outreach-writing', 'targeting'], deals: ['pipeline'] };
  const p = computeLayout([], {}, opts({ clusters }));
  const sales = p.departments.find((d) => d.id === 'sales');
  const deals = p.departments.find((d) => d.id === 'deals');
  assert.deepEqual(sales.sublabels, ['lead-sourcing', 'enrichment', 'outreach-writing']);
  assert.deepEqual(deals.sublabels, ['pipeline', '', ''], 'invented cluster names are worse than a gap');
});

test('brain completeness is clamped to 0…1 and defaults to zero', () => {
  assert.equal(computeLayout([], {}, opts()).core.brainCompleteness, 0);
  assert.equal(computeLayout([], {}, opts({ brainCompleteness: 1.7 })).core.brainCompleteness, 1);
  assert.equal(computeLayout([], {}, opts({ brainCompleteness: -3 })).core.brainCompleteness, 0);
  assert.equal(computeLayout([], {}, opts({ brainCompleteness: 0.62 })).core.brainCompleteness, 0.62);
});

/* ── payload hygiene ───────────────────────────────────────────────────────── */

test('coordinates are rounded to one decimal and bounds contain every node', () => {
  const p = computeLayout(library(), {}, opts());
  for (const n of p.nodes) {
    assert.equal(n.x, Math.round(n.x * 10) / 10);
    assert.ok(n.x > p.bounds.x[0] && n.x < p.bounds.x[1], `${n.id} outside bounds`);
    assert.ok(n.y > p.bounds.y[0] && n.y < p.bounds.y[1], `${n.id} outside bounds`);
  }
  assert.equal(p.bounds.x[1] - Math.max(...p.nodes.map((n) => n.x)), LAYOUT.boundsPadding);
});

test('every edge endpoint resolves to a node or the core', () => {
  const p = computeLayout(library(), {}, opts());
  const ids = new Set(p.nodes.map((n) => n.id));
  ids.add('core');
  for (const e of p.edges) {
    assert.ok(ids.has(e.source), `dangling edge source ${e.source}`);
    assert.ok(ids.has(e.target), `dangling edge target ${e.target}`);
  }
});

test('a dangling builds_on is dropped rather than crashing the map', () => {
  const p = computeLayout(
    [{ slug: 'orphan', department: 'sales', name: 'O', status: 'draft', builds_on: ['does-not-exist'] }],
    {},
    opts(),
  );
  assert.equal(p.edges.filter((e) => e.kind === 'builds-on').length, 0);
});

test('toStoredPositions emits sorted, position-only data', () => {
  const p = computeLayout(library(10), {}, opts());
  const s = toStoredPositions(p);
  const keys = Object.keys(s.positions);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(s.version, p.version);
  for (const v of Object.values(s.positions)) assert.deepEqual(Object.keys(v), ['x', 'y']);
});

/* ── frontmatter subset reader ─────────────────────────────────────────────── */

test('frontmatter: reads the layout-relevant subset and skips nested blocks', () => {
  const fm = parseFrontmatter(`---
name: Account Enrichment
department: sales            # inline comment
cluster: enrichment
status: live
breaks_into: [firmographic-appender, tech-stack-detector]
builds_on:
  - database-mining
ladder:
  human-led: "A glance at the website before the call."
schedule: "0 6 * * 1"
approval: none
---
body`);
  assert.equal(fm.name, 'Account Enrichment');
  assert.equal(fm.department, 'sales');
  assert.equal(fm.status, 'live');
  assert.deepEqual(fm.breaks_into, ['firmographic-appender', 'tech-stack-detector']);
  assert.deepEqual(fm.builds_on, ['database-mining']);
  assert.equal(fm.schedule, '0 6 * * 1');
  assert.equal(fm.ladder, undefined, 'nested blocks are not layout-relevant');
});

test('frontmatter: a file without a front-matter block yields null (excluded, not guessed)', () => {
  assert.equal(parseFrontmatter('# Just a heading\n'), null);
  assert.equal(parseFrontmatter('---\nname: x\nno closing fence'), null);
});
