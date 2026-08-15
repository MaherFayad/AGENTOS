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
 * Completeness is the fraction of the interview's ~20 questions that COMPANY.md actually
 * answers, measured as `## ` headings present. Honest at zero: no COMPANY.md ⇒ 0, and the
 * galaxy renders as a bare core dot rather than a full swirl (CLAUDE.md rule 9).
 *
 * `runner-engineer` owns the interview (§3.3) and may replace this with a real score by
 * writing `company/.brain.json` → `{ "completeness": 0…1 }`; that file wins if present.
 */
const BRAIN_QUESTION_COUNT = 20;
async function brainCompleteness() {
  const override = await readJson(join(ROOT, 'company', '.brain.json'), null);
  if (override && Number.isFinite(override.completeness)) {
    return Math.min(1, Math.max(0, override.completeness));
  }
  const companyPath = join(ROOT, 'company', 'COMPANY.md');
  if (!(await exists(companyPath))) return 0;
  const text = await readFile(companyPath, 'utf8');
  const answered = text
    .split(/\r?\n/)
    .filter((l) => /^##\s+\S/.test(l))
    .filter((_, i, arr) => arr.length > 0).length;
  return Math.min(1, answered / BRAIN_QUESTION_COUNT);
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

  const payload = computeLayout(agents, previous, {
    departments,
    clusters,
    brainCompleteness: await brainCompleteness(),
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
  log(`  brain         ${Math.round(payload.core.brainCompleteness * 100)}% complete (§3.3)`);
  log(`  bounds        x ${payload.bounds.x.join(' … ')}   y ${payload.bounds.y.join(' … ')}`);
  for (const w of warnings) log(`  warn  ${w}`);
  log(`\n  → ${POSITIONS.replace(ROOT, '.')}   (committed)`);
  log(`  → ${ARTIFACT.replace(ROOT, '.')}   (build artifact)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
