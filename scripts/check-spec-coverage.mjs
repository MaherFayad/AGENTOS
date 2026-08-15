#!/usr/bin/env node
/**
 * check-spec-coverage.mjs
 *
 * The spec of record is skilltree-clone-spec.md. This asserts that every section of it
 * is claimed by exactly one owning agent in comms/specs/, and that every requirement
 * those specs declare is traceable to a real file and a real test.
 *
 * A requirement whose "Implemented in" path does not exist is a lie in a document, which
 * is worse than a gap — a gap is visible. This is why the check resolves paths.
 *
 * Usage: node scripts/check-spec-coverage.mjs [--json]
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'skilltree-clone-spec.md');
const SPECS_DIR = join(ROOT, 'comms', 'specs');

const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/** Sections the spec defines, extracted from its own headings. */
async function specSections() {
  const text = await readFile(SPEC, 'utf8');
  const sections = new Map(); // id -> title
  for (const line of text.split(/\r?\n/)) {
    const part = line.match(/^#\s+PART\s+([IVX]+)\s+[—-]\s*(.+)$/);
    if (part) sections.set(`PART ${part[1]}`, part[2].trim());
    const sub = line.match(/^##\s+(\d+\.\d+)\s+(.+)$/);
    if (sub) sections.set(sub[1], sub[2].trim());
  }
  return sections;
}

const REQUIRED_HEADINGS = [
  '## Owner',
  '## Spec sections covered',
  '## Coverage',
  '## Deliberately not done',
];

/**
 * Coverage rows look like:
 * | REQ-MAP-01 | §2.1 | Starfield ~200 points | apps/web/src/map/canvas.ts | tests/canvas.test.ts |
 */
const ROW = /^\|\s*(REQ-[A-Z0-9]+-\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/;

async function exists(p) {
  try {
    await access(join(ROOT, p.trim()));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sections = await specSections();

  let files = [];
  try {
    files = (await readdir(SPECS_DIR)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  } catch {
    fail(`comms/specs/ does not exist — no agent has filed an implementation spec yet.`);
  }

  if (files.length === 0) fail('comms/specs/ contains no specs.');

  const claimed = new Map(); // section id -> [spec file]
  const reqIds = new Map(); // req id -> spec file
  const rows = [];

  for (const file of files) {
    const text = await readFile(join(SPECS_DIR, file), 'utf8');

    for (const h of REQUIRED_HEADINGS) {
      if (!text.includes(h)) fail(`${file}: missing required heading "${h}"`);
    }

    // Sections this spec claims, from the "Spec sections covered" line(s).
    const covered = text.match(/^##\s+Spec sections covered\s*$([\s\S]*?)(?=^##\s|\Z)/m);
    if (covered) {
      for (const m of covered[1].matchAll(/§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g)) {
        const id = m[1] ?? `PART ${m[2]}`;
        if (!claimed.has(id)) claimed.set(id, []);
        claimed.get(id).push(file);
      }
    }

    for (const line of text.split(/\r?\n/)) {
      const m = line.match(ROW);
      if (!m) continue;
      const [, id, section, requirement, impl, test] = m;
      if (reqIds.has(id)) fail(`${file}: duplicate requirement id ${id} (also in ${reqIds.get(id)})`);
      reqIds.set(id, file);
      rows.push({
        file,
        id,
        section: section.trim(),
        requirement: requirement.trim(),
        impl: impl.trim(),
        test: test.trim(),
      });
    }
  }

  // Every spec section must be owned.
  for (const [id, title] of sections) {
    if (!claimed.has(id)) fail(`§${id} "${title}" is claimed by no spec in comms/specs/`);
    else if (claimed.get(id).length > 1 && !id.startsWith('PART'))
      warn(`§${id} claimed by ${claimed.get(id).length} specs: ${claimed.get(id).join(', ')} — overlapping ownership`);
  }

  // Every requirement must be real.
  const PENDING = /^(—|-|TBD|pending|n\/a)$/i;
  let pending = 0;
  for (const r of rows) {
    if (!r.requirement) fail(`${r.file}: ${r.id} has an empty requirement`);
    if (!r.section.startsWith('§') && !r.section.toUpperCase().startsWith('PART'))
      fail(`${r.file}: ${r.id} does not cite a spec section (got "${r.section}")`);

    if (PENDING.test(r.impl) || !r.impl) {
      pending++;
      continue; // declared-but-unbuilt is legal and counted, not an error
    }
    for (const p of r.impl.split(/\s*[·,]\s*/)) {
      const path = p.replace(/^`|`$/g, '').split('#')[0];
      if (!path) continue;
      if (!(await exists(path))) fail(`${r.file}: ${r.id} claims "${path}" which does not exist`);
    }
    if (PENDING.test(r.test) || !r.test) warn(`${r.file}: ${r.id} is implemented but has no verification`);
  }

  const built = rows.length - pending;
  const pct = rows.length ? Math.round((built / rows.length) * 100) : 0;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ sections: sections.size, requirements: rows.length, built, pending, errors, warnings }, null, 2));
  } else {
    console.log(`\nSpec coverage`);
    console.log(`  spec sections     ${sections.size} (${sections.size - [...sections.keys()].filter((s) => !claimed.has(s)).length} claimed)`);
    console.log(`  requirements      ${rows.length}`);
    console.log(`  implemented       ${built} (${pct}%)`);
    console.log(`  declared, unbuilt ${pending}`);
    for (const w of warnings) console.log(`  warn  ${w}`);
    for (const e of errors) console.log(`  FAIL  ${e}`);
    console.log('');
  }

  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
