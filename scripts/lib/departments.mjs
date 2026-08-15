/**
 * The seven canonical departments, for Node-side callers.
 *
 * ADR-001 is the decision of record and `packages/contracts/src/departments.ts` is its
 * TypeScript form (owner: `agent-library-curator`). Node cannot import that file's types
 * package at build time without a compile step, so this module **reads it** and falls back
 * to the ADR-001 table verbatim if it is not there yet.
 *
 * It never invents a department: if the TS file exists but disagrees with ADR-001 in order
 * or slug, the TS file wins and a warning is printed, because a silent divergence between
 * the map's angles and the CHART's tab order is the exact bug ADR-001 was written to stop.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** ADR-001 §Decision, table rows 0–6. Order is significant. */
const ADR_001 = [
  { id: 'sales', label: 'Sales' },
  { id: 'deals', label: 'Deals' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operations', label: 'Operations' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'customer', label: 'Customer' },
  { id: 'back-office', label: 'Back Office' },
];

/** ADR-001: `index × 360/7`, starting at −90° so `sales` sits at twelve o'clock. */
export function branchAngle(index, count = 7) {
  return (-Math.PI / 2) + (index * 2 * Math.PI) / count;
}

/**
 * Parse the ordered `{ id, label }` pairs out of the contracts package without executing
 * it. Deliberately dumb: it matches the two fields in source order and stops at the first
 * shape it does not recognise, rather than guessing.
 */
function parseDepartmentsTs(source) {
  // Strategy 1 — the tuple table the contracts package actually uses:
  //   const ORDERED = [ ['sales', 'Sales'], … ] as const;
  const tuples = [...source.matchAll(/\[\s*'([a-z0-9-]+)'\s*,\s*'([^']+)'\s*\]/g)].map((m) => ({
    id: m[1],
    label: m[2],
  }));
  if (tuples.length === 7) return tuples;

  // Strategy 2 — an object-literal table, should it ever be written that way.
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
    if (parsed.length === 7) {
      table = parsed;
      const drift = parsed
        .map((d, i) => (d.id === ADR_001[i].id ? null : `${i}: ${ADR_001[i].id} → ${d.id}`))
        .filter(Boolean);
      if (drift.length) {
        warn(
          `departments.ts diverges from ADR-001 (${drift.join(', ')}). ` +
            `Using departments.ts; stored positions will need a migration.`,
        );
      }
    } else {
      warn(
        `departments.ts found but ${parsed.length} departments parsed (expected 7). ` +
          `Falling back to the ADR-001 table.`,
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
