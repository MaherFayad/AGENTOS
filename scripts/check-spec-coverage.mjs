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
const BOARD = join(ROOT, 'comms', 'BOARD.md');

/**
 * BOARD.md's coverage table is the authority on who owns which section. Without this,
 * a spec that merely *mentions* a section in prose claims it, and an accidental claim
 * masks another agent's real gap — the failure is silent and it points the wrong way.
 * Returns Map<sectionId, ownerAgent>.
 */
async function boardOwnership() {
  const text = await readFile(BOARD, 'utf8');
  const start = text.search(/^##\s+Spec coverage/m);
  const owners = new Map();
  if (start === -1) return owners;
  const rest = text.slice(start);
  const end = rest.slice(3).search(/^##\s/m);
  const table = end === -1 ? rest : rest.slice(0, end + 3);
  for (const line of table.split(/\r?\n/)) {
    const row = line.match(/^\|\s*(.+?)\s*\|\s*`([a-z-]+)`\s*\|/);
    if (!row) continue;
    for (const m of row[1].matchAll(/§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g)) {
      owners.set(m[1] ?? `PART ${m[2]}`, row[2]);
    }
  }
  return owners;
}

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
 *
 * Cells may contain escaped pipes (`\|`) — a union type like `human-led \| assisted` is
 * legitimate content, so split on unescaped delimiters only rather than on a naive
 * "everything that is not a pipe" regex.
 */
const ROW_START = /^\|\s*(REQ-[A-Z0-9]+-\d+)\s*\|/;

function splitRow(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  // leading empty cell from the row's opening pipe
  return cells[0] === '' ? cells.slice(1) : cells;
}

/** Only resolve cells that actually look like repo paths. */
const looksLikePath = (s) => s.includes('/') || /\.(ts|tsx|mjs|js|css|json|md|ya?ml)$/.test(s);

/** Markdown punctuation that can wrap a path in a table cell. `_` is NOT here: it is a
 *  legitimate path character and stripping it turns `scripts/__tests__` into a lie. */
const STRIP_LEAD = /^[`*([<"']+/;
const STRIP_TAIL = /[`*)\]>,;:."']+$/;

const cleanToken = (tok) => tok.replace(STRIP_LEAD, '').replace(STRIP_TAIL, '').split('#')[0].trim();

/**
 * Every path a coverage cell claims. **Both columns go through this**, because "resolve the
 * paths" must have exactly one reading — the Test column was previously resolved not at all,
 * so the gate's founding rule (*a requirement pointing at a file that does not exist is a lie
 * in a document*) was enforced on half the table.
 *
 * The two columns carry different forms, so the rule is about *shape*, not about which column
 * it came from. A `·`/`,`-separated element is either:
 *
 *   a **claim** — one bare token and nothing else. Resolved when it has a directory separator
 *     or a file extension. This is the rule the Implemented column has always used and it is
 *     unchanged, which is why `package.json` at the repo root keeps being checked.
 *
 *   **prose** — anything containing a space. Only its `/`-bearing tokens are resolved. So
 *     `node scripts/seed-agents.mjs` still checks the script it names — the half of that cell
 *     that can go stale — while `manual — see Test plan`, `negative fixture run` and
 *     `review — fidelity-qa-reviewer` stay prose. A bare filename inside a sentence
 *     (`provenance.mjs`, in an aside) also stays prose: it cannot be resolved without a
 *     directory, and only a resolvable claim can be a lie.
 *
 * A token starting with `/` is never a path: repo paths here are relative to ROOT, so a
 * leading slash means a URL route (`manual — open /p/:project/chart`), not a file.
 */
function pathsIn(cell) {
  const found = [];
  for (const element of String(cell ?? '').split(/\s*[·,]\s*/)) {
    const el = element.trim();
    if (!el) continue;
    const bare = cleanToken(el);
    if (!/\s/.test(bare)) {
      if (bare && !bare.startsWith('/') && looksLikePath(bare)) found.push(bare);
      continue;
    }
    for (const raw of el.split(/\s+/)) {
      const tok = cleanToken(raw);
      if (tok && !tok.startsWith('/') && tok.includes('/')) found.push(tok);
    }
  }
  return found;
}

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
  const specOwner = new Map(); // spec file -> owning agent
  const reqIds = new Map(); // req id -> spec file
  const rows = [];

  for (const file of files) {
    const text = await readFile(join(SPECS_DIR, file), 'utf8');

    for (const h of REQUIRED_HEADINGS) {
      if (!text.includes(h)) fail(`${file}: missing required heading "${h}"`);
    }

    const ownerBlock = text.match(/^##\s+Owner\s*$([\s\S]*?)(?=^##\s|\Z)/m);
    const ownerName = ownerBlock?.[1].match(/`([a-z-]+)`/);
    if (ownerName) specOwner.set(file, ownerName[1]);
    else fail(`${file}: "## Owner" does not name an agent in backticks`);

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
      const head = line.match(ROW_START);
      if (!head) continue;
      const cells = splitRow(line);
      const [id, section, requirement, impl, test] = cells;
      if (reqIds.has(id)) fail(`${file}: duplicate requirement id ${id} (also in ${reqIds.get(id)})`);
      reqIds.set(id, file);
      rows.push({ file, id, section, requirement, impl: impl ?? '', test: test ?? '' });
    }
  }

  // Every spec section must be owned.
  for (const [id, title] of sections) {
    if (!claimed.has(id)) fail(`§${id} "${title}" is claimed by no spec in comms/specs/`);
    else if (claimed.get(id).length > 1 && !id.startsWith('PART'))
      warn(`§${id} claimed by ${claimed.get(id).length} specs: ${claimed.get(id).join(', ')} — overlapping ownership`);
  }

  // A claim must match BOARD. An accidental claim (a section merely named in prose) would
  // otherwise mark another agent's gap as covered, and that failure points the wrong way.
  const owners = await boardOwnership();
  if (owners.size === 0) warn('comms/BOARD.md has no "Spec coverage" table — ownership is unverified');
  for (const [id, claimants] of claimed) {
    const owner = owners.get(id);
    if (!owner) {
      warn(`§${id} is claimed by ${claimants.join(', ')} but BOARD assigns it to nobody`);
      continue;
    }
    for (const file of new Set(claimants)) {
      const declared = specOwner.get(file);
      if (declared && declared !== owner)
        fail(
          `${file} (owner: ${declared}) claims §${id}, which BOARD assigns to ${owner} — ` +
            `move it under a "## Boundaries" heading if you only mean to reference it`,
        );
    }
  }

  // Every requirement must be real.
  //
  // The pending marker is anchored at the START of the cell, not at both ends. Both-ends
  // anchoring was correct about the bare `—` and one keystroke from being defeated: `— (owed)`
  // matched nothing, so it was graded as a real claim and emitted neither a FAIL nor a warn.
  // A near-miss passing silently is the same disease as an unenforced column.
  const PENDING = /^(—|-|TBD|pending|n\/a)(\s|$)/i;
  /** Declared-but-unbuilt: opens with a pending marker AND names no resolvable path. The
   *  second half keeps a cell like `— *(pinned by scripts/__tests__/x.test.mjs)*` out of the
   *  pending bucket, because it does name evidence. */
  const isPending = (cell, paths) => (!cell || PENDING.test(cell)) && paths.length === 0;

  let pending = 0;
  for (const r of rows) {
    if (!r.requirement) fail(`${r.file}: ${r.id} has an empty requirement`);
    if (!r.section.startsWith('§') && !r.section.toUpperCase().startsWith('PART'))
      fail(`${r.file}: ${r.id} does not cite a spec section (got "${r.section}")`);

    const implPaths = pathsIn(r.impl);
    const testPaths = pathsIn(r.test);

    // The Test column is resolved even when the requirement is declared-but-unbuilt: a test
    // path that does not exist is a lie in a document either way.
    for (const p of testPaths) {
      if (!(await exists(p))) fail(`${r.file}: ${r.id} cites test "${p}" which does not exist`);
    }

    if (isPending(r.impl, implPaths)) {
      pending++;
      continue; // declared-but-unbuilt is legal and counted, not an error
    }
    for (const p of implPaths) {
      if (!(await exists(p))) fail(`${r.file}: ${r.id} claims "${p}" which does not exist`);
    }
    if (isPending(r.test, testPaths)) warn(`${r.file}: ${r.id} is implemented but has no verification`);
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
