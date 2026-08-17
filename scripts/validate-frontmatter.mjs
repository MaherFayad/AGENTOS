#!/usr/bin/env node
/**
 * validate-frontmatter.mjs
 *
 * Frontmatter is the single source of truth for MAP, CHART and DASHBOARDS (Part IV).
 * Everything those three views render comes from agents/{department}/{slug}/SKILL.md, so
 * a file that parses "mostly" is worse than a file that fails: a half-parsed agent renders
 * as a node with a blank drawer and nobody finds out until a demo.
 *
 * Therefore: a file with any error is **excluded from the map with a warning**, never
 * rendered half-parsed. `--json` emits that exclusion list so the graph builder and the
 * repo watcher can act on it instead of re-implementing the rules.
 *
 * Dependency-free by design — this runs in CI, in the repo watcher before layout
 * recompute, and in a pre-commit hook, none of which should need an install first. That
 * is also why the YAML parser below is hand-rolled: it accepts the documented subset of
 * YAML the schema uses and rejects everything else loudly.
 *
 * Usage:
 *   node scripts/validate-frontmatter.mjs           # human report, exit 1 on any error
 *   node scripts/validate-frontmatter.mjs --json    # machine-readable exit report
 *   node scripts/validate-frontmatter.mjs --strict  # warnings count as errors
 *
 * Importable: `import { validateAll, parseFrontmatter } from './validate-frontmatter.mjs'`
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = join(ROOT, 'agents');
const REGISTRY = join(ROOT, 'agents', '_registry', 'clusters.json');
const CONNECTORS = join(ROOT, 'agents', '_registry', 'connectors.json');
const CONTRACT_TS = join(ROOT, 'packages', 'contracts', 'src', 'frontmatter.ts');

/* ------------------------------------------------------------------ *
 * The schema, mirrored from packages/contracts/src/frontmatter.ts.
 * checkContractDrift() below asserts the two agree, so this duplication
 * cannot rot silently (ADR-002: "the validators check that they agree").
 * ------------------------------------------------------------------ */

const DEPARTMENTS = ['sales', 'deals', 'marketing', 'operations', 'intelligence', 'customer', 'back-office'];
const TIERS = ['human-led', 'assisted', 'autonomous'];
const PHASES = ['1-foundation', '2-capture', '3-generate', '4-orchestrate'];
const STATUSES = ['live', 'draft', 'failing'];
const APPROVALS = ['none', 'required'];
const INPUT_TYPES = ['text', 'url', 'number', 'select', 'textarea', 'date'];
/** ADR-009. `none` is the opt-out for an agent whose deliverable is a side effect. */
const PRODUCES = ['md', 'json', 'pdf', 'txt', 'none'];
const DEFAULT_PRODUCES = 'md';

/**
 * The concrete tools that can create a file in the scratch workspace (ADR-009, invariant 7).
 *
 * Derived against the connector registry's `tools` rather than against a list of connector
 * *names*, so the check stays true the day `runner-engineer` adds a connector that grants
 * file tools. MCP families (`mcp__x__*`) are deliberately not counted: whether a given MCP
 * server can write the run's cwd is not knowable from its name, and guessing yes is how
 * `company-interview` came to declare two connectors, neither of which could write the
 * `output.md` its own system prompt demanded.
 */
const ARTIFACT_WRITE_TOOLS = ['Write', 'Edit', 'Bash'];

const REQUIRED = ['name', 'description', 'department', 'cluster', 'icon', 'tier', 'phase', 'status', 'replaces', 'ladder', 'the_human'];
const OPTIONAL = ['breaks_into', 'builds_on', 'wired_into', 'produces', 'inputs', 'schedule', 'approval', 'deliver'];
const KNOWN_FIELDS = new Set([...REQUIRED, ...OPTIONAL]);
const STRING_ARRAY_FIELDS = ['breaks_into', 'builds_on', 'wired_into'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INPUT_KEY_RE = /^[a-z][a-z0-9_]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_RE = /^[#@][a-z0-9][a-z0-9._-]*$/;

/**
 * Offline lucide name list. Authoritative source is node_modules/lucide-react when it is
 * installed (see loadLucideNames); this list is the fallback so the check still means
 * something before `npm install`. If a real lucide icon is missing here, adding it is a
 * one-line edit — that is cheaper than a blank glyph on a node nobody notices.
 */
const LUCIDE_FALLBACK = [
  'activity', 'alarm-clock', 'album', 'alert-circle', 'alert-triangle', 'archive', 'arrow-down',
  'arrow-left', 'arrow-right', 'arrow-up', 'award', 'banknote', 'bar-chart', 'bar-chart-2',
  'bar-chart-3', 'battery', 'bell', 'bell-ring', 'bookmark', 'book-open', 'bot', 'box', 'braces',
  'brain', 'brain-circuit', 'briefcase', 'building', 'building-2', 'calculator', 'calendar',
  'calendar-check', 'calendar-clock', 'calendar-days', 'camera', 'chart-line', 'check',
  'check-check', 'check-circle', 'chevron-down', 'chevron-right', 'circle', 'circle-dot',
  'clipboard', 'clipboard-check', 'clipboard-list', 'clock', 'cloud', 'code', 'coins', 'compass',
  'contact', 'cpu', 'credit-card', 'crosshair', 'database', 'download', 'ear', 'edit', 'external-link',
  'eye', 'file', 'file-check', 'file-search', 'file-signature', 'file-spreadsheet', 'file-text',
  'filter', 'flag', 'flame', 'folder', 'folder-open', 'gauge', 'gavel', 'gem', 'gift', 'git-branch',
  'git-commit', 'git-merge', 'globe', 'graduation-cap', 'grid', 'handshake', 'hard-drive', 'hash',
  'headphones', 'heart', 'heart-handshake', 'heart-pulse', 'history', 'home', 'image', 'inbox',
  'info', 'key', 'key-round', 'landmark', 'languages', 'layers', 'layout-dashboard', 'library',
  'life-buoy', 'lightbulb', 'line-chart', 'link', 'list', 'list-checks', 'list-filter', 'loader',
  'lock', 'log-in', 'mail', 'mail-check', 'mail-open', 'map', 'map-pin', 'megaphone', 'menu',
  'message-circle', 'message-square', 'messages-square', 'mic', 'microscope', 'monitor', 'moon',
  'more-horizontal', 'mouse-pointer-click', 'move', 'network', 'newspaper', 'notebook', 'package',
  'paperclip', 'pause', 'pen-line', 'pen-tool', 'percent', 'phone', 'pie-chart', 'pin', 'play',
  'plug', 'plus', 'presentation', 'printer', 'puzzle', 'quote', 'radar', 'radio', 'receipt',
  'recycle', 'refresh-cw', 'repeat', 'reply', 'rocket', 'rotate-cw', 'route', 'ruler', 'satellite',
  'save', 'scale', 'scan', 'scan-search', 'school', 'scissors', 'scroll-text', 'search',
  'search-check', 'send', 'server', 'settings', 'share-2', 'shield', 'shield-alert', 'shield-check',
  'shopping-cart', 'shuffle', 'sigma', 'signal', 'sliders', 'smartphone', 'sparkles', 'speech',
  'split', 'square-stack', 'star', 'sticky-note', 'stethoscope', 'sun', 'swatch-book', 'table',
  'tag', 'target', 'telescope', 'terminal', 'thermometer', 'thumbs-up', 'ticket', 'timer',
  'toggle-left', 'trash-2', 'trending-down', 'trending-up', 'trophy', 'truck', 'type', 'upload',
  'user', 'user-check', 'user-plus', 'users', 'users-round', 'video', 'wallet', 'wand-2', 'watch',
  'waves', 'workflow', 'wrench', 'zap',
];

/** Five-field cron only — see the contract's isCronExpression for why six is rejected. */
const CRON_BOUNDS = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];

export function isCronExpression(value) {
  const fields = String(value).trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => {
    const [min, max] = CRON_BOUNDS[i];
    return field.split(',').every((part) => {
      const [range, step, ...extra] = part.split('/');
      if (extra.length) return false;
      if (step !== undefined && !/^[1-9]\d*$/.test(step)) return false;
      if (range === '*') return true;
      const m = /^(\d+)(?:-(\d+))?$/.exec(range ?? '');
      if (!m) return false;
      const from = Number(m[1]);
      const to = m[2] === undefined ? from : Number(m[2]);
      return from >= min && to <= max && from <= to;
    });
  });
}

export function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ *
 * A deliberately small YAML subset parser.
 *
 * Supports: block mappings, block sequences (`- scalar`, `- {flow}`, `- key: value`),
 * flow sequences and mappings, single/double quoted scalars, literal (`|`) and folded
 * (`>`) block scalars, `#` comments outside quotes, booleans, numbers, null.
 * Rejects: anchors, aliases, tags, multi-document files, tabs for indentation.
 * ------------------------------------------------------------------ */

class YamlError extends Error {
  constructor(message, line) {
    super(line === undefined ? message : `line ${line + 1}: ${message}`);
  }
}

const isBlank = (l) => l.trim() === '' || l.trim().startsWith('#');
const indentOf = (l) => l.length - l.trimStart().length;

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

/** Split `a, b, {c: d}` on top-level commas, respecting quotes and nesting. */
function splitFlow(src) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  const tail = src.slice(start);
  if (tail.trim() !== '' || out.length) out.push(tail);
  return out.map((s) => s.trim()).filter((s, i, a) => !(s === '' && i === a.length - 1 && a.length > 1));
}

function unquote(s) {
  if (s.length >= 2 && s[0] === '"' && s.at(-1) === '"') {
    return s.slice(1, -1).replace(/\\(["\\ntr])/g, (_, c) => ({ n: '\n', t: '\t', r: '\r' }[c] ?? c));
  }
  if (s.length >= 2 && s[0] === "'" && s.at(-1) === "'") return s.slice(1, -1).replace(/''/g, "'");
  return null;
}

function parseScalar(raw, lineNo) {
  const s = raw.trim();
  if (s === '') return null;

  if (s[0] === '[' || s[0] === '{') {
    const close = s[0] === '[' ? ']' : '}';
    if (s.at(-1) !== close) throw new YamlError(`unterminated flow collection: ${s}`, lineNo);
    const inner = s.slice(1, -1).trim();
    if (s[0] === '[') return inner === '' ? [] : splitFlow(inner).map((v) => parseScalar(v, lineNo));
    if (inner === '') return {};
    const obj = {};
    for (const pair of splitFlow(inner)) {
      const i = indexOfTopLevelColon(pair);
      if (i === -1) throw new YamlError(`flow mapping entry is not "key: value": ${pair}`, lineNo);
      obj[pair.slice(0, i).trim()] = parseScalar(pair.slice(i + 1), lineNo);
    }
    return obj;
  }

  const unq = unquote(s);
  if (unq !== null) return unq;
  if (s === 'true' || s === 'false') return s === 'true';
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.includes(': ') || s.endsWith(':')) throw new YamlError(`ambiguous unquoted value containing ":" — quote it: ${s}`, lineNo);
  return s;
}

function indexOfTopLevelColon(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ':' && (i + 1 === s.length || /\s/.test(s[i + 1]))) return i;
  }
  return -1;
}

function nextContentLine(lines, from) {
  for (let i = from; i < lines.length; i++) if (!isBlank(lines[i])) return i;
  return -1;
}

function readBlockScalar(lines, state, parentIndent, style) {
  const chomp = style.includes('-');
  const folded = style.startsWith('>');
  const collected = [];
  let blockIndent = null;
  while (state.i < lines.length) {
    const raw = lines[state.i];
    if (raw.trim() === '') { collected.push(''); state.i++; continue; }
    const ind = indentOf(raw);
    if (ind <= parentIndent) break;
    if (blockIndent === null) blockIndent = ind;
    collected.push(raw.slice(blockIndent));
    state.i++;
  }
  while (collected.length && collected.at(-1) === '') collected.pop();
  const joined = folded ? collected.join(' ').replace(/\s+/g, ' ').trim() : collected.join('\n');
  return chomp ? joined : `${joined}\n`;
}

function parseSequence(lines, state, indent) {
  const arr = [];
  while (state.i < lines.length) {
    const raw = lines[state.i];
    if (isBlank(raw)) { state.i++; continue; }
    const ind = indentOf(raw);
    if (ind < indent) break;
    const line = stripComment(raw).trim();
    if (line !== '-' && !line.startsWith('- ')) break;
    if (ind > indent) throw new YamlError('unexpected indentation in sequence', state.i);

    const dashAt = raw.indexOf('-', ind);
    const after = raw.slice(dashAt + 1);
    const restCol = dashAt + 1 + (after.length - after.trimStart().length);
    const rest = line === '-' ? '' : line.slice(2).trim();

    if (rest === '') { arr.push(null); state.i++; continue; }

    // `- key: value` — a block mapping whose first line shares the dash's row. Rewrite the
    // line as if the dash were whitespace, then parse a normal mapping at that column.
    const isBlockMap = !'[{"\''.includes(rest[0]) && indexOfTopLevelColon(rest) !== -1;
    if (isBlockMap) {
      lines[state.i] = ' '.repeat(restCol) + rest;
      arr.push(parseMapping(lines, state, restCol));
      continue;
    }

    arr.push(parseScalar(rest, state.i));
    state.i++;
  }
  return arr;
}

function parseMapping(lines, state, indent) {
  const map = {};
  while (state.i < lines.length) {
    const raw = lines[state.i];
    if (isBlank(raw)) { state.i++; continue; }
    if (raw.includes('\t')) throw new YamlError('tab in indentation — YAML forbids it', state.i);
    const ind = indentOf(raw);
    if (ind < indent) break;
    if (ind > indent) throw new YamlError('unexpected indentation', state.i);
    const line = stripComment(raw).trim();
    if (line === '-' || line.startsWith('- ')) break;

    const colon = indexOfTopLevelColon(line);
    if (colon === -1) throw new YamlError(`expected "key: value", got: ${line}`, state.i);
    const key = line.slice(0, colon).trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new YamlError(`unsupported key: ${key}`, state.i);
    if (key in map) throw new YamlError(`duplicate key: ${key}`, state.i);
    const rest = line.slice(colon + 1).trim();
    const lineNo = state.i;
    state.i++;

    if (/^[|>][-+]?$/.test(rest)) { map[key] = readBlockScalar(lines, state, ind, rest); continue; }

    if (rest !== '') { map[key] = parseScalar(rest, lineNo); continue; }

    const next = nextContentLine(lines, state.i);
    if (next === -1) { map[key] = null; continue; }
    const nextIndent = indentOf(lines[next]);
    const nextLine = stripComment(lines[next]).trim();
    if ((nextLine === '-' || nextLine.startsWith('- ')) && nextIndent >= ind) {
      state.i = next;
      map[key] = parseSequence(lines, state, nextIndent);
    } else if (nextIndent > ind) {
      state.i = next;
      map[key] = parseMapping(lines, state, nextIndent);
    } else {
      map[key] = null;
    }
  }
  return map;
}

/**
 * Split a SKILL.md into frontmatter + body.
 * @returns {{data: object, body: string}}
 * @throws {YamlError}
 */
export function parseFrontmatter(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  if (lines[0].trim() !== '---') throw new YamlError('file does not open with a `---` frontmatter fence');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') { end = i; break; }
  }
  if (end === -1) throw new YamlError('frontmatter fence is never closed');

  const state = { i: 0 };
  const block = lines.slice(1, end);
  const data = block.length ? parseMapping(block, state, indentOf(block[nextContentLine(block, 0)] ?? '')) : {};
  if (state.i < block.length && nextContentLine(block, state.i) !== -1) {
    throw new YamlError('trailing content the parser could not attach to a key', state.i + 1);
  }
  return { data, body: lines.slice(end + 1).join('\n').trim() };
}

/* ------------------------------------------------------------------ *
 * Field checks
 * ------------------------------------------------------------------ */

const isStr = (v) => typeof v === 'string' && v.trim() !== '';

function checkStringArray(fm, field, err, ownSlug) {
  const v = fm[field];
  if (v === undefined) return [];
  if (!Array.isArray(v)) { err(`${field} must be a list, got ${typeof v}`); return []; }
  const seen = new Set();
  for (const entry of v) {
    if (!isStr(entry)) { err(`${field} contains a non-string entry`); continue; }
    if (!SLUG_RE.test(entry)) err(`${field}: "${entry}" is not a kebab-case slug`);
    if (seen.has(entry)) err(`${field}: "${entry}" listed twice`);
    if (entry === ownSlug) err(`${field}: an agent cannot reference itself`);
    seen.add(entry);
  }
  return v.filter(isStr);
}

function checkInputs(fm, err) {
  if (fm.inputs === undefined) return;
  if (!Array.isArray(fm.inputs)) { err('inputs must be a list'); return; }
  const keys = new Set();
  fm.inputs.forEach((f, i) => {
    const at = `inputs[${i}]`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) { err(`${at} must be a mapping`); return; }
    for (const k of Object.keys(f)) {
      if (!['key', 'label', 'type', 'required', 'options'].includes(k)) err(`${at}: unknown field "${k}"`);
    }
    if (!isStr(f.key)) err(`${at}.key is required`);
    else {
      if (!INPUT_KEY_RE.test(f.key)) err(`${at}.key "${f.key}" must be snake_case`);
      if (keys.has(f.key)) err(`${at}.key "${f.key}" is not unique — the run payload would lose one`);
      keys.add(f.key);
    }
    if (!isStr(f.label)) err(`${at}.label is required`);
    if (!INPUT_TYPES.includes(f.type)) err(`${at}.type "${f.type}" not in ${INPUT_TYPES.join(' | ')}`);
    if (f.required !== undefined && typeof f.required !== 'boolean') err(`${at}.required must be true or false`);
    if (f.type === 'select' && !(Array.isArray(f.options) && f.options.length > 0)) {
      err(`${at}: type "select" needs a non-empty options[]`);
    }
    if (f.options !== undefined && f.type !== 'select') err(`${at}: options[] is meaningless without type "select"`);
  });
}

function checkDeliver(fm, err) {
  const d = fm.deliver;
  if (d === undefined) return;
  if (!d || typeof d !== 'object' || Array.isArray(d)) { err('deliver must be a mapping like {slack: "#ops"}'); return; }
  const keys = Object.keys(d);
  for (const k of keys) if (!['slack', 'email'].includes(k)) err(`deliver: unknown target "${k}" — known targets are slack, email`);
  if (keys.length === 0) err('deliver is empty — omit the field instead');
  if (d.slack !== undefined && !(isStr(d.slack) && SLACK_RE.test(d.slack))) err(`deliver.slack "${d.slack}" must be a channel or DM starting with # or @`);
  if (d.email !== undefined && !(isStr(d.email) && EMAIL_RE.test(d.email))) err(`deliver.email "${d.email}" is not an email address`);
}

/**
 * Invariant 5: `wired_into` names must exist in this registry. Keys starting with `$`
 * are comments (JSON has no comment syntax) and are ignored. Shape is
 * `{ [slug]: { label, tools[], note?, available?, since? } }` — the same shape the runner's
 * CONNECTOR_REGISTRY uses, so a name that validates here is a name the runner can actually
 * grant.
 *
 * `available: false` / `since: "M9"` are optional and owned by `runner-engineer` (ADR-009
 * decision 5): a connector whose backing server is not wired yet. They are read defensively
 * — absent means available — so this validator does not need a change in a file it does not
 * own before the check can exist.
 *
 * @param {unknown} value
 * @returns {{ names: Set<string>, defs: Map<string, {tools: string[], available: boolean, since: string|null}>, errors: string[] }}
 */
export function parseConnectorRegistry(value) {
  const errors = [];
  const names = new Set();
  const defs = new Map();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { names, defs, errors: ['must be an object keyed by connector slug, not an array'] };
  }
  for (const [name, def] of Object.entries(value)) {
    if (name.startsWith('$')) continue;
    if (!SLUG_RE.test(name)) {
      errors.push(`"${name}" is not a kebab-case slug`);
      continue;
    }
    if (!def || typeof def !== 'object' || Array.isArray(def)) {
      errors.push(`${name} must be {label, tools, note?}`);
      continue;
    }
    for (const k of Object.keys(def)) {
      if (!['label', 'tools', 'note', 'available', 'since'].includes(k)) errors.push(`${name}: unknown field "${k}"`);
    }
    if (!isStr(def.label)) errors.push(`${name}.label is required`);
    if (!Array.isArray(def.tools) || def.tools.length === 0) {
      errors.push(`${name}.tools must be a non-empty list of tool names or prefix patterns`);
    } else {
      for (const t of def.tools) if (!isStr(t)) errors.push(`${name}.tools contains a non-string`);
    }
    if (def.note !== undefined && !isStr(def.note)) errors.push(`${name}.note must be a string`);
    if (def.available !== undefined && typeof def.available !== 'boolean') errors.push(`${name}.available must be true or false`);
    if (def.since !== undefined && !isStr(def.since)) errors.push(`${name}.since must be a milestone string like "M9"`);
    names.add(name);
    defs.set(name, {
      tools: Array.isArray(def.tools) ? def.tools.filter(isStr) : [],
      available: def.available !== false,
      since: isStr(def.since) ? def.since : null,
    });
  }
  if (names.size === 0) {
    errors.push('registry has no connectors — every wired_into name would fail invariant 5');
  }
  return { names, defs, errors };
}

/** ADR-009 invariant 7: can this connector create the run's `output.md`? */
export function connectorCanWriteArtifact(def) {
  return Boolean(def) && def.tools.some((t) => ARTIFACT_WRITE_TOOLS.includes(t));
}

function checkLadder(fm, err) {
  const l = fm.ladder;
  if (!l || typeof l !== 'object' || Array.isArray(l)) { err('ladder must be a mapping with all three rungs'); return; }
  for (const rung of TIERS) if (!isStr(l[rung])) err(`ladder.${rung} is required — the drawer renders all three rows (§2.3.9)`);
  for (const k of Object.keys(l)) if (!TIERS.includes(k)) err(`ladder: unknown rung "${k}"`);
  const rungs = TIERS.map((t) => l[t]).filter(isStr);
  if (rungs.length === 3 && new Set(rungs.map((s) => s.trim())).size !== 3) {
    err('the three ladder rungs must escalate — human-led is a glance, autonomous is unattended on a schedule');
  }
}

/* ------------------------------------------------------------------ *
 * Repo walk
 * ------------------------------------------------------------------ */

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

/** Every SKILL.md under agents/, skipping `_registry`, `_incoming` and dotfolders. */
async function findSkillFiles(dir, depth = 0, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || (depth === 0 && e.name.startsWith('_'))) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await findSkillFiles(full, depth + 1, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

async function loadLucideNames() {
  const pkg = join(ROOT, 'node_modules', 'lucide-react', 'dist', 'lucide-react.d.ts');
  if (await exists(pkg)) {
    const text = await readFile(pkg, 'utf8');
    const names = new Set();
    for (const m of text.matchAll(/declare const (\w+): (?:React\.)?ForwardRefExoticComponent/g)) {
      names.add(m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/(\d)([A-Za-z])/g, '$1-$2').toLowerCase());
    }
    if (names.size > 50) return { names, authoritative: true };
  }
  return { names: new Set(LUCIDE_FALLBACK), authoritative: false };
}

/**
 * ADR-002: "the prose contract is normative, the TypeScript is generated-by-hand from it,
 * and the validators check that they agree." This is that check — it reads the enum
 * literals out of the contract source and compares them to the ones above.
 */
async function checkContractDrift(err) {
  if (!(await exists(CONTRACT_TS))) {
    return; // packages/contracts not created yet — infra-compose-engineer owns the package
  }
  const text = await readFile(CONTRACT_TS, 'utf8');
  const pull = (name) => {
    const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`, 's').exec(text);
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  };
  for (const [name, ours] of [['DEPARTMENTS', DEPARTMENTS], ['TIERS', TIERS], ['PHASES', PHASES], ['STATUSES', STATUSES], ['APPROVALS', APPROVALS], ['INPUT_TYPES', INPUT_TYPES], ['PRODUCES', PRODUCES]]) {
    const theirs = pull(name);
    if (!theirs) { err(null, `packages/contracts/src/frontmatter.ts does not export ${name} — the validator and the types have diverged`); continue; }
    if (theirs.join('|') !== ours.join('|')) {
      err(null, `contract drift: ${name} is [${theirs.join(', ')}] in packages/contracts/src/frontmatter.ts but [${ours.join(', ')}] in this validator`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

export async function validateAll() {
  /** @type {Array<{path: string|null, message: string}>} */
  const errors = [];
  /** @type {Array<{path: string|null, message: string}>} */
  const warnings = [];
  const globalErr = (path, message) => errors.push({ path, message });
  const globalWarn = (path, message) => warnings.push({ path, message });

  await checkContractDrift(globalErr);

  // --- cluster registry (ADR-001) ---------------------------------
  let registry = null;
  if (!(await exists(REGISTRY))) {
    globalErr('agents/_registry/clusters.json', 'cluster registry is missing — every agent fails cluster validation without it');
  } else {
    try {
      registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
    } catch (e) {
      globalErr('agents/_registry/clusters.json', `is not valid JSON: ${e.message}`);
    }
  }
  /** @type {Record<string, Set<string>>} */
  const clustersByDept = {};
  if (registry) {
    const keys = Object.keys(registry);
    for (const d of DEPARTMENTS) if (!keys.includes(d)) globalErr('agents/_registry/clusters.json', `no clusters registered for department "${d}"`);
    for (const k of keys) if (!DEPARTMENTS.includes(k)) globalErr('agents/_registry/clusters.json', `"${k}" is not one of the seven departments (ADR-001)`);
    for (const [dept, list] of Object.entries(registry)) {
      const set = new Set();
      if (!Array.isArray(list)) { globalErr('agents/_registry/clusters.json', `${dept} must be a list of {slug,label}`); continue; }
      if (list.length < 3) globalErr('agents/_registry/clusters.json', `${dept} has ${list.length} clusters — §2.1 renders three sub-labels per department`);
      for (const c of list) {
        if (!c || typeof c !== 'object' || !isStr(c.slug) || !isStr(c.label)) { globalErr('agents/_registry/clusters.json', `${dept} contains an entry that is not {slug,label}`); continue; }
        if (!SLUG_RE.test(c.slug)) globalErr('agents/_registry/clusters.json', `${dept}: cluster slug "${c.slug}" is not kebab-case`);
        if (set.has(c.slug)) globalErr('agents/_registry/clusters.json', `${dept}: cluster "${c.slug}" listed twice`);
        set.add(c.slug);
      }
      clustersByDept[dept] = set;
    }
  }

  // --- connector registry (invariant 5 — required, not optional) ----
  let connectors = null;
  /** @type {Map<string, {tools: string[], available: boolean, since: string|null}>} */
  let connectorDefs = new Map();
  if (!(await exists(CONNECTORS))) {
    globalErr(
      'agents/_registry/connectors.json',
      'connector registry is missing — invariant 5: a wired_into name that is not here is unknown_connector at run time (§3.2). Author the file; do not skip the check',
    );
  } else {
    try {
      const result = parseConnectorRegistry(JSON.parse(await readFile(CONNECTORS, 'utf8')));
      for (const m of result.errors) globalErr('agents/_registry/connectors.json', m);
      if (result.names.size) {
        connectors = result.names;
        connectorDefs = result.defs;
      }
    } catch (e) {
      globalErr('agents/_registry/connectors.json', `is not valid JSON: ${e.message}`);
    }
  }

  const { names: lucide, authoritative } = await loadLucideNames();

  // --- per-file ----------------------------------------------------
  const files = (await findSkillFiles(AGENTS_DIR)).sort();
  const parsed = [];
  const excluded = [];

  for (const file of files) {
    const path = rel(file);
    const fileErrors = [];
    const err = (m) => fileErrors.push(m);
    const warn = (m) => globalWarn(path, m);

    const segments = path.split('/');
    // agents / <department> / <slug> / SKILL.md
    if (segments.length !== 4) {
      excluded.push({ path, slug: null, errors: [`wrong path shape — every agent is agents/<department>/<slug>/SKILL.md, this is ${segments.length} segments deep`] });
      continue;
    }
    const [, pathDept, slug] = segments;

    let fm, body;
    try {
      ({ data: fm, body } = parseFrontmatter(await readFile(file, 'utf8')));
    } catch (e) {
      excluded.push({ path, slug, errors: [`frontmatter did not parse — ${e.message}`] });
      continue;
    }

    if (!fm || typeof fm !== 'object' || Array.isArray(fm)) {
      excluded.push({ path, slug, errors: ['frontmatter is not a mapping'] });
      continue;
    }

    for (const f of REQUIRED) if (fm[f] === undefined || fm[f] === null) err(`missing required field: ${f}`);
    for (const k of Object.keys(fm)) if (!KNOWN_FIELDS.has(k)) err(`unknown field "${k}" — a typo here renders as an empty drawer section, so it is an error, not a warning`);

    for (const f of ['name', 'description', 'cluster', 'icon', 'replaces', 'the_human']) {
      if (fm[f] !== undefined && !isStr(fm[f])) err(`${f} must be a non-empty string`);
    }

    if (!DEPARTMENTS.includes(fm.department)) err(`department "${fm.department}" is not one of the seven (ADR-001): ${DEPARTMENTS.join(', ')}`);
    if (fm.department !== undefined && fm.department !== pathDept) err(`department "${fm.department}" disagrees with the path segment "${pathDept}" — the MAP branch comes from the field, the watcher finds the file by path, and they must be the same branch`);
    if (!TIERS.includes(fm.tier)) err(`tier "${fm.tier}" is not one of ${TIERS.join(' | ')} — it is a CHART row`);
    if (!PHASES.includes(fm.phase)) err(`phase "${fm.phase}" is not one of ${PHASES.join(' | ')} — it is a CHART column`);
    if (!STATUSES.includes(fm.status)) err(`status "${fm.status}" is not one of ${STATUSES.join(' | ')}`);
    if (fm.approval !== undefined && !APPROVALS.includes(fm.approval)) err(`approval "${fm.approval}" is not one of ${APPROVALS.join(' | ')}`);

    if (isStr(fm.name)) {
      const expected = toSlug(fm.name);
      if (expected !== slug) err(`folder is "${slug}" but name "${fm.name}" kebab-cases to "${expected}" — cross-references resolve by slug, so this breaks every edge pointing here`);
    }

    if (isStr(fm.cluster) && registry && DEPARTMENTS.includes(fm.department)) {
      const known = clustersByDept[fm.department];
      if (known && !known.has(fm.cluster)) {
        err(`cluster "${fm.cluster}" is not registered for ${fm.department} — add it to agents/_registry/clusters.json in this commit, or use one of: ${[...known].join(', ')}`);
      }
    }

    if (isStr(fm.icon)) {
      if (!SLUG_RE.test(fm.icon)) err(`icon "${fm.icon}" must be a kebab-case lucide name`);
      else if (!lucide.has(fm.icon)) {
        err(`icon "${fm.icon}" does not resolve in lucide${authoritative ? '' : ' (offline list — if it really exists, add it to LUCIDE_FALLBACK in scripts/validate-frontmatter.mjs)'}`);
      }
    }

    // Placeholders left by scripts/seed-agents.mjs. An import promoted without a human
    // writing these four sentences is exactly the "137 dead agents" failure (Part VII.3).
    for (const [field, value] of [['replaces', fm.replaces], ['the_human', fm.the_human],
      ...TIERS.map((t) => [`ladder.${t}`, fm.ladder?.[t]])]) {
      if (isStr(value) && /^\s*TODO\b/i.test(value)) err(`${field} is still the import placeholder — a staged agent is not a curated one`);
    }

    if (isStr(fm.replaces)) {
      if (fm.replaces.trim().length < 12) err('replaces must be a sentence about the manual work, not a stub');
      else if (fm.replaces.trim().length < 25) warn('replaces is very short — it renders in a quote box and it is the line people screenshot (§2.3.8)');
      if (isStr(fm.description) && fm.replaces.trim() === fm.description.trim()) err('replaces repeats description — it is meant to name the manual work being retired, not the agent');
    }
    if (isStr(fm.the_human) && /^\s*(nothing|none|n\/a|nil)\.?\s*$/i.test(fm.the_human)) {
      err('the_human is never "nothing" — every agent leaves a human owning strategy or audit');
    }

    checkLadder(fm, err);
    checkInputs(fm, err);
    checkDeliver(fm, err);
    const breaksInto = checkStringArray(fm, 'breaks_into', err, slug);
    const buildsOn = checkStringArray(fm, 'builds_on', err, slug);
    const wiredInto = checkStringArray(fm, 'wired_into', err, slug);

    // ADR-009 invariant 7. An agent whose deliverable is a document but whose allowlist
    // contains nothing that can create a file does not fail — it *succeeds*, produces no
    // artifact, and reports `ok`. That is the one failure mode a validator has to catch,
    // because at run time it looks exactly like success.
    const produces = fm.produces === undefined ? DEFAULT_PRODUCES : fm.produces;
    if (fm.produces !== undefined && !PRODUCES.includes(fm.produces)) {
      err(`produces "${fm.produces}" is not one of ${PRODUCES.join(' | ')}`);
    }

    if (connectors) {
      for (const tool of wiredInto) {
        if (!connectors.has(tool)) {
          err(`wired_into "${tool}" is not in the connector registry — the runner would reject the run (§3.2). Wire the connector or drop the name; wired_into is the tool allowlist, not documentation`);
          continue;
        }
        const def = connectorDefs.get(tool);
        if (def && !def.available) {
          warn(`wired_into "${tool}" is declared but not wired yet${def.since ? ` (${def.since})` : ''} — it resolves to no tool at run time. Honest to declare, but the agent runs without it`);
        }
      }

      if (PRODUCES.includes(produces) && produces !== 'none') {
        const writers = wiredInto.filter((name) => connectorCanWriteArtifact(connectorDefs.get(name)));
        if (writers.length === 0) {
          err(
            `produces: ${produces}, but no connector in wired_into can write a file — the runner asks every agent to write \`output.md\` (prompt.ts) and extracts that file as the artifact (artifacts.ts). ` +
              `With nothing that grants ${ARTIFACT_WRITE_TOOLS.join('/')}, the run produces no artifact and still reports \`ok\`. ` +
              `Add \`workspace\` to wired_into, or set \`produces: none\` if this agent genuinely delivers only a side effect (ADR-009)`,
          );
        }
      }
    }

    if (fm.schedule !== undefined) {
      if (!isStr(fm.schedule)) err('schedule must be a quoted 5-field cron string');
      else if (!isCronExpression(fm.schedule)) err(`schedule "${fm.schedule}" is not a valid 5-field cron (ofelia would silently take a 6-field one to mean something else)`);
    }

    // Invariant 6, as amended by ADR-014 (accepted 2026-08-17). This used to warn. It is an
    // error now because a warning is not strong enough under a cascade: copying a file copies
    // the claim, so promoting or forking an agent carries `live` in its bytes into a place
    // that has never run anything — and no error is raised at any point. The resolved value
    // comes from ops.run_ledger keyed by agent_ref; the file's value is not read.
    if (fm.status !== undefined && fm.status !== 'draft' && STATUSES.includes(fm.status)) {
      err(
        `status: ${fm.status} is not authorable — a file may only ever declare \`draft\`. ` +
        `\`live\` and \`failing\` are computed from real runs (§3.5, ADR-014 §5, BOARD rule 9): ` +
        `set by the resolver from the ledger, never typed into a SKILL.md. A hand-set \`live\` ` +
        `is the LIVE counter lying, and copying this file would copy the lie`,
      );
    }
    if (!body || body.length < 40) warn('body is nearly empty — the body is the system prompt the runner hands to the agent (§3.2)');

    if (fileErrors.length) excluded.push({ path, slug, errors: fileErrors });
    else parsed.push({ path, slug, department: fm.department, cluster: fm.cluster, tier: fm.tier, phase: fm.phase, status: fm.status, breaksInto, buildsOn });
  }

  // --- cross-file --------------------------------------------------
  const bySlug = new Map();
  for (const a of parsed) {
    if (bySlug.has(a.slug)) globalErr(a.path, `duplicate agent slug "${a.slug}" (also ${bySlug.get(a.slug).path}) — slugs are the global cross-reference key`);
    else bySlug.set(a.slug, a);
  }

  const leafDots = new Set(parsed.flatMap((a) => a.breaksInto));
  for (const a of parsed) {
    for (const dep of a.buildsOn) {
      if (!bySlug.has(dep)) {
        // builds_on is a prerequisite *agent* and a map edge — a dangling one draws an
        // edge to a node that does not exist, so it excludes the file.
        excluded.push({ path: a.path, slug: a.slug, errors: [`builds_on "${dep}" resolves to no agent in the library — a prerequisite edge to a node that does not exist`] });
        bySlug.delete(a.slug);
      }
    }
    for (const leaf of a.breaksInto) {
      // breaks_into entries are leaf skill dots (contract invariant 4): they resolve to a
      // full agent if one exists, otherwise they *are* their own declaration and the map
      // synthesises the dot. Only a collision with something else is wrong.
      if (bySlug.has(leaf) && bySlug.get(leaf).department !== a.department) {
        globalWarn(a.path, `breaks_into "${leaf}" is a full agent in ${bySlug.get(leaf).department} — the chip will fly across departments (§2.3.5); intended?`);
      }
    }
  }
  for (const a of parsed) {
    if (bySlug.has(a.slug) && a.buildsOn.some((d) => !bySlug.has(d) && !leafDots.has(d))) bySlug.delete(a.slug);
  }

  const agents = parsed
    .filter((a) => bySlug.has(a.slug))
    .map(({ breaksInto, buildsOn, ...rest }) => rest);

  return {
    ok: errors.length === 0 && excluded.length === 0,
    checked: files.length,
    agents,
    excluded,
    warnings,
    errors,
    lucideAuthoritative: authoritative,
    connectorRegistry: connectors ? 'present' : 'absent',
    connectorCount: connectors ? connectors.size : 0,
  };
}

async function main() {
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  const report = await validateAll();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\nAgent frontmatter');
    console.log(`  files found       ${report.checked}`);
    console.log(`  valid (rendered)  ${report.agents.length}`);
    console.log(`  excluded from map ${report.excluded.length}`);
    const byDept = {};
    for (const a of report.agents) byDept[a.department] = (byDept[a.department] ?? 0) + 1;
    console.log(`  by department     ${DEPARTMENTS.map((d) => `${d} ${byDept[d] ?? 0}`).join(' · ')}`);
    if (!report.lucideAuthoritative) console.log('  note  lucide-react is not installed — icons checked against the offline list');
    if (report.connectorRegistry === 'present') console.log(`  connectors        ${report.connectorCount}`);
    else console.log('  connectors        absent — invariant 5 cannot be checked');
    for (const w of report.warnings) console.log(`  warn  ${w.path ?? 'repo'}: ${w.message}`);
    for (const e of report.errors) console.log(`  FAIL  ${e.path ?? 'repo'}: ${e.message}`);
    for (const x of report.excluded) {
      console.log(`  EXCLUDED  ${x.path}`);
      for (const e of x.errors) console.log(`            ${e}`);
    }
    console.log('');
  }

  const failed = !report.ok || (strict && report.warnings.length > 0);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
