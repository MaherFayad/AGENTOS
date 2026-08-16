#!/usr/bin/env node
/**
 * build-graph.mjs — precompute the MAP layout once per skills-repo change (§2.1, ADR-003).
 *
 *   node scripts/build-graph.mjs [--check] [--quiet]
 *
 * Reads   `agents/{department}/{agent}/SKILL.md` front-matter
 *       + `agents/_registry/clusters.json`   (ADR-001, owner: agent-library-curator)
 *       + `agents/_registry/positions.json`  (previous coordinates — the stability seed)
 *       + `company/COMPANY.md`               (§3.3 brain completeness)
 * Writes  `apps/web/public/graph.json`       (gitignored build artifact)
 *       + `agents/_registry/positions.json`  (committed — this is what makes the map
 *                                             stable across clones)
 *
 * `--check` writes nothing and exits non-zero if the artifact on disk differs from a fresh
 * computation. That is CI's determinism gate (ADR-003: "runs it twice, diffs").
 *
 * Runs on a bare clone: no dependencies outside `node:` builtins (ADR-006).
 */

import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeLayout, toStoredPositions } from './lib/layout.mjs';
import { loadDepartments, loadClusters } from './lib/departments.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { describeBrain, measureBrainFile } from './lib/brain-completeness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = join(ROOT, 'agents');
const POSITIONS = join(ROOT, 'agents', '_registry', 'positions.json');
const ARTIFACT = join(ROOT, 'apps', 'web', 'public', 'graph.json');

const QUIET = process.argv.includes('--quiet');
const CHECK = process.argv.includes('--check');

const warnings = [];
const warn = (m) => warnings.push(m);
const log = (m) => !QUIET && console.log(m);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p, fallback) {
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Walk `agents/{department}/{agent}/SKILL.md`. Anything else under `agents/` is ignored,
 *  including `_registry/`. */
async function collectAgents(departmentIds) {
  if (!(await exists(AGENTS_DIR))) return [];
  const agents = [];

  for (const dept of (await readdir(AGENTS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    if (dept.name.startsWith('_') || dept.name.startsWith('.')) continue;
    if (!departmentIds.has(dept.name)) {
      warn(`agents/${dept.name}/ is not one of the seven departments (ADR-001) — skipped`);
      continue;
    }
    const deptPath = join(AGENTS_DIR, dept.name);
    for (const folder of (await readdir(deptPath, { withFileTypes: true })).filter((d) => d.isDirectory())) {
      const file = join(deptPath, folder.name, 'SKILL.md');
      if (!(await exists(file))) {
        warn(`agents/${dept.name}/${folder.name}/ has no SKILL.md — skipped`);
        continue;
      }
      const fm = parseFrontmatter(await readFile(file, 'utf8'));
      if (!fm) {
        warn(`agents/${dept.name}/${folder.name}/SKILL.md has no front-matter — excluded from the map`);
        continue;
      }
      if (fm.department && fm.department !== dept.name) {
        // Frontmatter invariant 1. The validator fails the build; the map just tells the truth.
        warn(`agents/${dept.name}/${folder.name}: department "${fm.department}" ≠ path — using the path`);
      }
      agents.push({ ...fm, slug: folder.name, department: dept.name });
    }
  }

  return agents;
}

/**
 * §3.3 — the galaxy's particle count and brightness scale with Second Brain completeness.
 *
 * The measurement itself lives in `lib/brain-completeness.mjs` (counted from the
 * `<!-- UNANSWERED: Qn -->` markers, which is the only signal in COMPANY.md a template
 * cannot fake). This function only decides *which* producer to believe.
 *
 * `runner-engineer` owns the interview (§3.3) and publishes `company/.brain.json` →
 * `{ completeness, answered, total }` from `apps/runner/src/lib/brain.ts`. That snapshot
 * wins **only when it does not claim more than the markers admit.** Where the two
 * disagree we take the lower and warn: two independent producers of one number is a
 * standing hazard (it shipped a 45%-complete galaxy over a 0/20 brain once), and the
 * asymmetry means a disagreement can cost brightness but can never invent it —
 * CLAUDE.md rule 9, and brain.ts's own "never nudged upward".
 */
async function brainMeasurement() {
  const measured = await measureBrainFile(join(ROOT, 'company', 'COMPANY.md'), { warn });

  const override = await readJson(join(ROOT, 'company', '.brain.json'), null);
  if (!override || !Number.isFinite(override.completeness)) return measured;

  const value = Math.min(1, Math.max(0, override.completeness));
  const total =
    Number.isInteger(override.total) && override.total > 0 ? override.total : measured.total;
  const snapshot = {
    value,
    answered: Number.isInteger(override.answered)
      ? Math.min(total, Math.max(0, override.answered))
      : Math.round(value * total),
    total,
    unanswered: measured.unanswered,
    source: 'company/.brain.json',
  };

  if (snapshot.value <= measured.value) return snapshot;

  warn(
    `company/.brain.json claims ${Math.round(snapshot.value * 100)}% (${describeBrain(snapshot)}) but ` +
      `company/COMPANY.md still carries ${measured.unanswered.length} UNANSWERED markers ` +
      `(${describeBrain(measured)}). Using the markers — a completeness may never exceed what the ` +
      'file admits (§3.3, CLAUDE.md rule 9).',
  );
  return measured;
}

function stable(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const departments = loadDepartments(ROOT, warn);
  const departmentIds = new Set(departments.map((d) => d.id));
  const clusters = loadClusters(ROOT);

  const agents = await collectAgents(departmentIds);
  const stored = await readJson(POSITIONS, null);
  const previous = stored?.positions ?? {};

  const brain = await brainMeasurement();

  const payload = computeLayout(agents, previous, {
    departments,
    clusters,
    brainCompleteness: brain.value,
    brainAnswered: brain.answered,
    brainTotal: brain.total,
    // `computedAt` is the only non-deterministic field, so --check ignores it and the
    // committed positions file carries the previous value when nothing moved.
    now: new Date().toISOString(),
    warn,
  });

  const positions = toStoredPositions(payload);

  if (CHECK) {
    const onDisk = await readJson(POSITIONS, null);
    const same =
      onDisk &&
      onDisk.version === positions.version &&
      stable(onDisk.positions) === stable(positions.positions);
    for (const w of warnings) log(`  warn  ${w}`);
    if (!same) {
      console.error(
        'build-graph --check: agents/_registry/positions.json is stale or non-deterministic.\n' +
          '  Run `node scripts/build-graph.mjs` and commit the result.',
      );
      process.exit(1);
    }
    log('build-graph --check: layout is reproducible and committed.');
    return;
  }

  // Keep the previous `computedAt` when nothing about the layout changed, so a rebuild
  // does not produce a git diff that says nothing (ADR-003's determinism, in practice).
  if (stored && stored.version === positions.version && stable(stored.positions) === stable(positions.positions)) {
    positions.computedAt = stored.computedAt;
  }

  await mkdir(dirname(POSITIONS), { recursive: true });
  await writeFile(POSITIONS, stable(positions), 'utf8');

  await mkdir(dirname(ARTIFACT), { recursive: true });
  await writeFile(ARTIFACT, stable(payload), 'utf8');

  const live = payload.nodes.filter((n) => n.status === 'live').length;
  log(`\nMAP layout — ${payload.version.slice(0, 19)}…`);
  log(`  departments   ${payload.departments.length}`);
  log(`  agents        ${agents.length}`);
  log(`  nodes         ${payload.nodes.length}  (${live} live)`);
  log(`  edges         ${payload.edges.length}  (${payload.edges.filter((e) => e.pulse).length} pulsing)`);
  // The percentage alone is unauditable — it is exactly what hid a fabricated 45%. Printing
  // the count and the source next to it makes the number checkable against the file.
  log(
    `  brain         ${Math.round(payload.core.brainCompleteness * 100)}% complete — ` +
      `${describeBrain(brain)} · ${brain.source} (§3.3)`,
  );
  log(`  bounds        x ${payload.bounds.x.join(' … ')}   y ${payload.bounds.y.join(' … ')}`);
  for (const w of warnings) log(`  warn  ${w}`);
  log(`\n  → ${POSITIONS.replace(ROOT, '.')}   (committed)`);
  log(`  → ${ARTIFACT.replace(ROOT, '.')}   (build artifact)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
