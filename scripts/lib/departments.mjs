/**
 * The canonical departments, for Node-side callers.
 *
 * ADR-001 is the decision of record, amended by ADR-041 (`product`, appended at index 7),
 * and `packages/contracts/src/departments.ts` is its TypeScript form (owner:
 * `agent-library-curator`). Node cannot import that file's types package at build time
 * without a compile step, so this module **reads it** and falls back to the table below
 * verbatim if it is not there yet.
 *
 * It never invents a department: if the TS file exists but disagrees with the table in
 * order or slug, the TS file wins and a warning is printed, because a silent divergence
 * between the map's angles and the CHART's tab order is the exact bug ADR-001 was written
 * to stop.
 *
 * **The count is not hardcoded, and that is a fix and not a tidy-up (ADR-041).** Both
 * checks below used to read `=== 7`, so the day an eighth department landed in
 * `departments.ts` this module parsed eight, matched neither branch, warned *"expected 7"*
 * and **fell back to the seven** — the map would have placed every `product` node at
 * angle 0, in the middle of `sales`, with a warning nobody reads on a build that exits 0.
 * A count is not an invariant; agreement with `departments.ts` is.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** ADR-001 §Decision rows 0–6, plus ADR-041's row 7. Order is significant. */
const ADR_001 = [
  { id: 'product', label: 'Product' },
  { id: 'design', label: 'Design' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'ai', label: 'AI' },
  { id: 'intelligence', label: 'Intelligence' },
];

/**
 * ADR-001: `index × 360/count`, starting at −90° so `product` sits at twelve o'clock (ADR-042).
 *
 * `count` defaults to the table's length rather than to a literal: a caller that forgets to
 * pass it gets the current department set, not the 2026-08-15 one.
 */
export function branchAngle(index, count = ADR_001.length) {
  return (-Math.PI / 2) + (index * 2 * Math.PI) / count;
}

/**
 * Parse the ordered `{ id, label }` pairs out of the contracts package without executing it.
 *
 * **This function was blind and it is the reason ADR-041 touched this file.** It matched a
 * literal tuple table — `[ ['sales', 'Sales'], … ]` — that `departments.ts` has not contained
 * since ADR-035 split the enum into `DEPARTMENT_SLUGS` (a slug tuple) and `DEPARTMENT_LABELS`
 * (an object). It therefore parsed **zero** departments from a file with seven in it, on every
 * build, and `loadDepartments` fell back to the hardcoded table below — which agreed, so
 * nothing ever looked wrong. A cross-file agreement check that reads neither file is not a
 * check (BRIEF: *checkers go blind silently*). Verified by running it: before this change,
 * `loadDepartments(repoRoot)` warned `0 departments parsed` against the real file.
 *
 * It now reads the two declarations the file actually has, and still refuses to guess: a
 * slug with no label is dropped, because a department with no tab-bar text is not a
 * department this module may invent one for.
 */
function parseDepartmentsTs(source) {
  const slugBlock = /export const DEPARTMENT_SLUGS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source);
  const labelBlock = /export const DEPARTMENT_LABELS[^=]*=\s*\{([\s\S]*?)\n\}/.exec(source);
  if (slugBlock && labelBlock) {
    const slugs = [...slugBlock[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    /** `sales: 'Sales'` and `'back-office': 'Back Office'` are both legal object keys. */
    const labels = new Map(
      [...labelBlock[1].matchAll(/(?:'([a-z0-9-]+)'|([A-Za-z_$][\w$]*))\s*:\s*'([^']*)'/g)].map((m) => [
        m[1] ?? m[2],
        m[3],
      ]),
    );
    const pairs = slugs.filter((id) => labels.has(id)).map((id) => ({ id, label: labels.get(id) }));
    if (pairs.length === slugs.length && pairs.length > 0) return pairs;
  }

  // Legacy shapes, kept so this never regresses to zero silently again.
  const tuples = [...source.matchAll(/\[\s*'([a-z0-9-]+)'\s*,\s*'([^']+)'\s*\]/g)].map((m) => ({
    id: m[1],
    label: m[2],
  }));
  if (tuples.length > 0) return tuples;

  const objects = [...source.matchAll(/(?:id|slug)\s*:\s*['"`]([a-z0-9-]+)['"`][\s\S]{0,160}?label\s*:\s*['"`]([^'"`]+)['"`]/g)].map(
    (m) => ({ id: m[1], label: m[2] }),
  );
  return objects.length ? objects : tuples;
}

/**
 * @param {string} root repo root
 * @param {(msg: string) => void} [warn]
 * @returns {{id: string, label: string, angle: number, index: number}[]}
 */
export function loadDepartments(root, warn = () => {}) {
  const tsPath = join(root, 'packages', 'contracts', 'src', 'departments.ts');
  let table = ADR_001;

  if (existsSync(tsPath)) {
    const parsed = parseDepartmentsTs(readFileSync(tsPath, 'utf8'));
    if (parsed.length > 0) {
      table = parsed;
      const drift = parsed
        .map((d, i) => (d.id === ADR_001[i]?.id ? null : `${i}: ${ADR_001[i]?.id ?? '(none)'} → ${d.id}`))
        .filter(Boolean);
      if (drift.length || parsed.length !== ADR_001.length) {
        warn(
          `departments.ts diverges from this module's table (${drift.join(', ') || `${ADR_001.length} → ${parsed.length}`}). ` +
            `Using departments.ts; stored positions will need a migration.`,
        );
      }
    } else {
      warn(
        'departments.ts found but no departments parsed — the tuple table has changed shape. ' +
          'Falling back to the local table.',
      );
    }
  } else {
    warn('packages/contracts/src/departments.ts not present — using the ADR-001 table.');
  }

  return table.map((d, index) => ({ ...d, index, angle: branchAngle(index, table.length) }));
}

/**
 * Clusters registry (ADR-001): `{ "sales": ["lead-sourcing", …] }`, owned by
 * `agent-library-curator`. Missing file is not an error — it means no agents have landed
 * yet, and the map renders the honest empty branch.
 */
export function loadClusters(root) {
  const p = join(root, 'agents', '_registry', 'clusters.json');
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export { ADR_001 as ADR_001_DEPARTMENTS };
