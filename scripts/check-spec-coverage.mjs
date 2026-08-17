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
 * The same rule now binds the **Spec §** column (ADR-034). A citation pointing nowhere is the
 * same lie as a path pointing nowhere, and until 2026-08-17 this column was checked for its
 * *prefix* only: `§99.9` passed, exit 0, silent — while `` `Plan §12` ``, the form ADR-013 rule 2
 * *requires* for Part Two work, FAILed. A gate that refuses the correct citation does not merely
 * miss things; it decides what a requirement is willing to claim to be about, and that
 * distortion is invisible in the output.
 *
 * Usage: node scripts/check-spec-coverage.mjs [--json]
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = join(ROOT, 'skilltree-clone-spec.md');
const PLAN = join(ROOT, 'AGENTOS-V2-PLAN.md');
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
    for (const m of row[1].matchAll(/(?<!Plan\s)§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g)) {
      owners.set(m[1] ?? `PART ${m[2]}`, row[2]);
    }
  }
  return owners;
}

const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/**
 * The spec of record, indexed twice for two different jobs.
 *
 * `sections` is the **completeness denominator** — the headings that must each be claimed by
 * exactly one agent. It is unchanged: `PART <ROMAN>` and `<n>.<m>`, nothing else. ADR-013 rule 1
 * keeps this narrow deliberately.
 *
 * `ids` is the **citation index** — everything a requirement row may legally point at, which is
 * strictly wider, because the spec numbers one level deeper than it gives headings to. §2.5's
 * seven widget types are `1.`–`7.` in an ordered list, §2.6's six are `1.`–`6.`, and Part VII's
 * honest flags are `1.`–`4.`; 44 requirement rows in `comms/specs/` cite them as `§2.5.1`,
 * `§2.6.3`, `PART VII.4`. **An index built from headings alone would manufacture 44 FAILs out of
 * 44 correct cells**, which is worse than the gap it closes — so the ordinal of a top-level
 * numbered item inside a container is a citable id, and `§2.5.9` FAILs because §2.5 has seven.
 *
 * Fenced code is skipped: a numbered line inside the PART IV frontmatter example is not a
 * section. Skipping it can only make the index narrower, never wider, which is the safe
 * direction for everything except a false FAIL — and a numbered list in a code fence produces
 * an id nobody cites either way.
 */
async function specIndex() {
  const text = await readFile(SPEC, 'utf8');
  const sections = new Map(); // id -> title  (the denominator)
  const ids = new Set(); //          (what a citation may resolve to)
  let container = null;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;

    const part = line.match(/^#\s+PART\s+([IVX]+)\s+[—-]\s*(.+)$/);
    if (part) {
      container = `PART ${part[1]}`;
      sections.set(container, part[2].trim());
      ids.add(container);
      continue;
    }
    const sub = line.match(/^##\s+(\d+\.\d+)\s+(.+)$/);
    if (sub) {
      container = sub[1];
      sections.set(container, sub[2].trim());
      ids.add(container);
      continue;
    }
    // Any other heading keeps the container: a prose subheading inside §2.5 does not end §2.5.
    if (/^#{1,6}\s/.test(line)) continue;

    const item = container && line.match(/^(\d+)\.\s/);
    if (item) ids.add(`${container}.${item[1]}`);
  }
  return { sections, ids };
}

/**
 * `AGENTOS-V2-PLAN.md`'s citable ids. Part Two is cited as `Plan §12` / `Plan §23.8` and never
 * as a bare `§12` (ADR-013 rule 2 — a bare `§` always means the spec of record, which has no
 * §10). The plan numbers `## 12.` at the top level and `### 23.8` below it, so headings are the
 * whole index here; the ordinal rule the spec needs has no counterpart, because no row cites a
 * third plan level and inventing ids for one would only make this half of the check permissive.
 *
 * **This does not widen the coverage denominator.** ADR-013 rule 1 is untouched: the plan is
 * still absent from `sections`, still absent from BOARD's `## Spec coverage` table, and a plan
 * section still cannot be *claimed*. It can now be *cited*, which is a different column and a
 * different promise.
 *
 * Returns `null` when the plan is missing, which is reported rather than silently accepted —
 * a checker whose input became empty and which grades the empty result as a pass is the exact
 * defect BOARD records against `identity-model.test.mjs`.
 */
async function planIds() {
  let text;
  try {
    text = await readFile(PLAN, 'utf8');
  } catch {
    return null;
  }
  const ids = new Set();
  for (const line of text.split(/\r?\n/)) {
    const top = line.match(/^##\s+(\d+)\.\s/);
    if (top) {
      ids.add(top[1]);
      continue;
    }
    const sub = line.match(/^###\s+(\d+\.\d+)\s/);
    if (sub) ids.add(sub[1]);
  }
  return ids;
}

/**
 * What a **Spec §** cell is allowed to say, settled once (ADR-034) instead of being decided by
 * whether a string happens to begin with `§`.
 *
 * A cell is a `·`- or `,`-separated list. Each element is one of:
 *
 *   **primary** — the authority the requirement derives from. Exactly the three forms below, and
 *     every one of them is *resolved against its document*. A row must carry at least one.
 *       `§2.3` · `§2.5.1`   the spec of record
 *       `PART V` · `PART VII.4`  the spec of record
 *       `Plan §12` · `Plan §23.8`  AGENTOS-V2-PLAN.md
 *
 *   **supporting** — a real cross-reference this checker cannot resolve, accepted as an
 *     addition and never as the whole citation:
 *       `BOARD rule 9`      one of CLAUDE.md's nine standing rules
 *       `thread-model §4.2` a section of another comms/ document
 *     These are **not** resolved, and that is stated here and on BOARD rather than implied. A
 *     supporting element alone leaves the row with no primary citation, so it FAILs — which is
 *     what stops "accepted" from decaying into "unchecked".
 *
 * Markdown wrapping is stripped first: every one of `design-system.md`'s Part Two rows writes
 * the citation as `` `Plan §12` ``, and the old prefix test failed all of them on the backtick.
 */
function classifyCitation(raw) {
  const el = raw.replace(/[`*]/g, '').trim();
  if (!el) return null;
  let m;
  if ((m = el.match(/^§\s*(\d+(?:\.\d+)*)$/))) return { kind: 'spec', id: m[1], el };
  if ((m = el.match(/^PART\s+([IVX]+(?:\.\d+)*)$/i)))
    return { kind: 'part', id: `PART ${m[1].toUpperCase()}`, el };
  if ((m = el.match(/^Plan\s*§\s*(\d+(?:\.\d+)*)$/i))) return { kind: 'plan', id: m[1], el };
  if (/^BOARD\s+rule\s+\d+$/i.test(el)) return { kind: 'supporting', el };
  if (/^[A-Za-z][\w-]*\s+§\s*\d+(?:\.\d+)*$/.test(el)) return { kind: 'supporting', el };
  return { kind: 'unreadable', el };
}

const PRIMARY = new Set(['spec', 'part', 'plan']);

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
  const { sections, ids: specCitable } = await specIndex();
  const planCitable = await planIds();
  if (planCitable === null)
    warn('AGENTOS-V2-PLAN.md is missing — every `Plan §n` citation is accepted unchecked');

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
    // `(?<!Plan\s)` so a spec that also names its Part Two work does not accidentally *claim*
    // `§23.8` of a spec of record that has no §23. Claiming stays spec-of-record-only (ADR-013
    // rule 1); citing is the other column.
    if (covered) {
      for (const m of covered[1].matchAll(/(?<!Plan\s)§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g)) {
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
  let citesResolved = 0;
  let citesUnresolvable = 0;
  for (const r of rows) {
    if (!r.requirement) fail(`${r.file}: ${r.id} has an empty requirement`);

    // The Spec § column, resolved rather than prefix-matched. See classifyCitation.
    const cites = String(r.section ?? '')
      .split(/\s*[·,]\s*/)
      .map(classifyCitation)
      .filter(Boolean);
    const primary = cites.filter((c) => PRIMARY.has(c.kind));
    if (primary.length === 0)
      fail(`${r.file}: ${r.id} cites no spec or plan section (got "${r.section}")`);
    for (const c of primary) {
      if (c.kind === 'plan') {
        if (planCitable === null) {
          citesUnresolvable++;
        } else if (planCitable.has(c.id)) {
          citesResolved++;
        } else {
          fail(`${r.file}: ${r.id} cites "${c.el}", which AGENTOS-V2-PLAN.md does not have`);
        }
      } else if (specCitable.has(c.id)) {
        citesResolved++;
      } else {
        fail(`${r.file}: ${r.id} cites "${c.el}", which skilltree-clone-spec.md does not have`);
      }
    }
    citesUnresolvable += cites.filter((c) => c.kind === 'supporting').length;
    for (const c of cites.filter((c) => c.kind === 'unreadable'))
      warn(`${r.file}: ${r.id} has a citation element this gate cannot read — "${c.el}"`);

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
    console.log(
      JSON.stringify(
        {
          sections: sections.size,
          requirements: rows.length,
          built,
          pending,
          citesResolved,
          citesUnresolvable,
          errors,
          warnings,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\nSpec coverage`);
    console.log(`  spec sections     ${sections.size} (${sections.size - [...sections.keys()].filter((s) => !claimed.has(s)).length} claimed)`);
    console.log(`  requirements      ${rows.length}`);
    console.log(`  implemented       ${built} (${pct}%)`);
    console.log(`  declared, unbuilt ${pending}`);
    // Printed so "the Spec § column is checked now" is never read as wider than it is: the
    // second number is the part that is accepted on its shape and resolved against nothing.
    console.log(`  citations         ${citesResolved} resolved · ${citesUnresolvable} accepted unresolved`);
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
