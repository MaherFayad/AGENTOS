#!/usr/bin/env node
/**
 * check-comms.mjs
 *
 * comms/ is the only channel between agents (ADR-000). "If it isn't written here, it
 * didn't happen" is a rule the project bets on, so the channel itself has to be checked
 * like any other interface — a message with a typo'd `status` is a message nobody
 * answers, and a contract with no named owner is a contract two agents will both edit.
 *
 * What this asserts:
 *   1. Every comms/inbox/**\/*.md has frontmatter with all six required keys, a known
 *      `type`, and a known `status`.
 *   2. Every inbox directory is a real agent (or _all), and every `to:` names real ones.
 *   3. Every comms/contracts/*.md names an owner.
 *   4. Every comms/decisions/ADR-*.md has a Status line with a known value.
 *   5. Every agent on the BOARD.md roster has a comms/status/<agent>.md.
 *
 * Usage: node scripts/check-comms.mjs [--json]
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provenance } from './lib/provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMS = join(ROOT, 'comms');
const BOARD = join(COMMS, 'BOARD.md');

const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/** comms/README.md — the message frontmatter block. All six are required. */
const REQUIRED_MESSAGE_KEYS = ['from', 'to', 'type', 're', 'status', 'created'];

const MESSAGE_TYPES = new Set([
  'question',
  'decision-request',
  'blocker',
  'handoff-notice',
  'review-request',
  'fyi',
]);

const MESSAGE_STATUSES = new Set(['open', 'answered', 'closed']);

/** comms/templates/adr.md + the accepted ADRs. */
const ADR_STATUSES = new Set(['proposed', 'accepted', 'superseded', 'rejected', 'draft']);

/** Files whose name starts with `_` are templates/broadcast markers, not content. */
const isTemplate = (name) => name.startsWith('_');

/**
 * Find the `## Answer` section and report whether it has a heading and whether anything
 * was actually written under it.
 *
 * This used to be `/^##\s+Answer\s*$/m`, and it was wrong in BOTH directions at once —
 * which is the interesting part, because a checker that is only wrong in one direction
 * gets noticed:
 *
 *   TOO STRICT. It demanded a bare `## Answer` and rejected
 *   `## Answer — design-system-guardian, 2026-08-16T21:22`. Attributing and dating an
 *   answer is *better* practice than not — on a long thread it is the only way to tell who
 *   replied and when — so the check was failing the good version and passing the lazy one.
 *   Four correctly-answered messages went red and took `npm run verify` down with them,
 *   before it reached a single test.
 *
 *   TOO LOOSE. `comms/templates/message.md` ends with a bare `## Answer` and nothing under
 *   it. Copy the template, flip `status: answered`, write nothing — and the old check
 *   passed it. That is the actual protocol violation this rule exists to catch: a message
 *   marked answered that answers nothing. It could not see it.
 *
 * A red gate that is wrong about the thing it is gating teaches people to skip the gate.
 * That is the expensive failure, not the four minutes of red.
 */
function answerSection(text) {
  // Any `## Answer` heading, with optional trailing attribution after — / – / - / : / (.
  const m = /^##\s+Answer\b[^\n]*$/m.exec(text);
  if (!m) return { heading: false, body: '' };
  const after = text.slice(m.index + m[0].length);
  // Stop at the next heading of any level; whatever is between is the answer.
  const next = /^#{1,6}\s/m.exec(after);
  const body = (next ? after.slice(0, next.index) : after)
    // A horizontal rule or an HTML comment is not an answer.
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return { heading: true, body };
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function listDir(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Minimal YAML-ish frontmatter reader. Deliberately not a YAML dependency: this script is
 * plain Node ESM so it runs in CI before any install step and on a fresh clone.
 * Handles `key: value` and `key: [a, b]` — which is all the message schema uses.
 */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    // Strip a trailing `# comment`, but not a `#channel` inside quotes.
    if (!/^['"]/.test(value)) value = value.replace(/\s+#.*$/, '').trim();
    value = value.replace(/^['"]|['"]$/g, '');
    out[kv[1]] = value;
  }
  return out;
}

/** `to:` is one slug, a `[a, b]` list, or `all`. */
function recipients(value) {
  const v = String(value ?? '').trim();
  if (!v) return [];
  if (v.startsWith('[')) {
    return v
      .slice(1, v.endsWith(']') ? -1 : undefined)
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return [v];
}

/** The roster table in BOARD.md is the authoritative agent list. */
async function rosterFromBoard() {
  if (!(await exists(BOARD))) {
    fail('comms/BOARD.md does not exist — there is no roster to check against.');
    return new Set();
  }
  const text = await readFile(BOARD, 'utf8');
  const section = /^##\s+Roster & ownership\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(text);
  const slugs = new Set();

  if (section) {
    for (const line of section[1].split(/\r?\n/)) {
      // | `design-system-guardian` | Part I — … | contracts/design-tokens.md |
      const m = /^\|\s*`([a-z0-9-]+)`\s*\|/.exec(line);
      if (m) slugs.add(m[1]);
    }
    // The orchestrator is named in prose beneath the table, not in it.
    for (const m of section[1].matchAll(/`(commandcenter-orchestrator)`/g)) slugs.add(m[1]);
  }

  if (slugs.size === 0) fail('comms/BOARD.md: could not parse any agent from "## Roster & ownership".');
  return slugs;
}

async function checkInbox(roster) {
  const inbox = join(COMMS, 'inbox');
  let count = 0;

  for (const dir of await listDir(inbox)) {
    if (!dir.isDirectory()) continue;

    // A message addressed to nobody is a message nobody reads.
    if (dir.name !== '_all' && !roster.has(dir.name)) {
      fail(`comms/inbox/${dir.name}/ is not an agent on the BOARD roster (and is not _all).`);
    }

    for (const entry of await listDir(join(inbox, dir.name))) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || isTemplate(entry.name)) continue;
      count++;

      const rel = `comms/inbox/${dir.name}/${entry.name}`;
      const text = await readFile(join(inbox, dir.name, entry.name), 'utf8');
      const fm = parseFrontmatter(text);

      if (!fm) {
        fail(`${rel}: no frontmatter block (see comms/templates/message.md).`);
        continue;
      }

      for (const key of REQUIRED_MESSAGE_KEYS) {
        if (!(key in fm) || fm[key] === '') fail(`${rel}: missing required frontmatter key "${key}".`);
      }

      if (fm.type && !MESSAGE_TYPES.has(fm.type))
        fail(`${rel}: unknown type "${fm.type}" — expected one of ${[...MESSAGE_TYPES].join(' | ')}.`);

      if (fm.status && !MESSAGE_STATUSES.has(fm.status))
        fail(`${rel}: unknown status "${fm.status}" — expected open | answered | closed.`);

      if (fm.from && !roster.has(fm.from))
        fail(`${rel}: from "${fm.from}" is not on the BOARD roster.`);

      for (const to of recipients(fm.to)) {
        if (to !== 'all' && !roster.has(to))
          fail(`${rel}: to "${to}" is not on the BOARD roster (use "all" for a broadcast).`);
      }

      // A broadcast lives in _all and says so; the two must agree or half the team misses it.
      const isBroadcast = recipients(fm.to).includes('all');
      if (isBroadcast && dir.name !== '_all')
        fail(`${rel}: "to: all" but filed under ${dir.name}/ — broadcasts go in comms/inbox/_all/.`);
      if (!isBroadcast && dir.name === '_all')
        fail(`${rel}: filed in _all/ but "to: ${fm.to}" — set "to: all" or move it.`);
      if (!isBroadcast && !recipients(fm.to).includes(dir.name))
        warn(`${rel}: "to: ${fm.to}" does not include the folder it is filed under.`);

      // README: "<YYYYMMDD-HHmm>-<sender-slug>-<topic-slug>.md"
      if (!/^\d{8}-\d{4}-[a-z0-9-]+\.md$/.test(entry.name))
        warn(`${rel}: filename does not follow <YYYYMMDD-HHmm>-<sender>-<topic>.md.`);

      // An answered/closed message must actually contain the answer.
      if (fm.status === 'answered' || fm.status === 'closed') {
        const a = answerSection(text);
        if (!a.heading) {
          fail(
            `${rel}: status "${fm.status}" but no "## Answer" heading. ` +
              `Append one (comms/README.md: answering = appending "## Answer" to the same file), ` +
              `or set status: open.`,
          );
        } else if (!a.body) {
          fail(
            `${rel}: "## Answer" heading is present but empty — status "${fm.status}" claims ` +
              `an answer that was never written. This is the one the old check could not see.`,
          );
        }
      }
    }
  }
  return count;
}

async function checkContracts() {
  const dir = join(COMMS, 'contracts');
  let count = 0;

  for (const entry of await listDir(dir)) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || isTemplate(entry.name)) continue;
    count++;

    const rel = `comms/contracts/${entry.name}`;
    const text = await readFile(join(dir, entry.name), 'utf8');

    // "**Owner:** `runner-engineer`" — rule 2: contracts have exactly one owner, and the
    // owner is named IN the file so nobody has to cross-reference BOARD.md to edit safely.
    const owner = /^\s*\*\*Owner:\*\*\s*(.+)$/m.exec(text);
    if (!owner) {
      fail(`${rel}: no "**Owner:**" line. Every contract names its owner (comms/README.md rule 2).`);
      continue;
    }
    if (!/`[a-z0-9-]+`/.test(owner[1]))
      fail(`${rel}: "**Owner:**" line names no agent slug in backticks (got "${owner[1].trim()}").`);
  }

  if (count === 0) fail('comms/contracts/ contains no contracts.');
  return count;
}

async function checkDecisions() {
  const dir = join(COMMS, 'decisions');
  let count = 0;
  const numbers = new Map();

  for (const entry of await listDir(dir)) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || isTemplate(entry.name)) continue;
    // README.md is the directory's own documentation — the ADR numbering rule and the
    // AGENTOS-V2-PLAN concordance (ADR-013, amendment 2026-08-17). It is not a decision and
    // has no Status. This restores what line 15 already documents ("every
    // comms/decisions/ADR-*.md"); the implementation was scanning every .md instead, which
    // made it impossible to put the allocation warning in the one directory where the
    // failing method — `ls` and take the next integer — is actually practised.
    if (entry.name.toLowerCase() === 'readme.md') continue;
    count++;

    const rel = `comms/decisions/${entry.name}`;
    const text = await readFile(join(dir, entry.name), 'utf8');

    if (!/^ADR-\d{3}-[a-z0-9-]+\.md$/.test(entry.name))
      warn(`${rel}: name does not follow ADR-NNN-slug.md.`);

    const num = /^ADR-(\d{3})/.exec(entry.name)?.[1];
    if (num) {
      if (numbers.has(num))
        fail(`${rel}: ADR number ${num} is also used by ${numbers.get(num)} — two decisions, one id.`);
      else numbers.set(num, entry.name);
    }

    // Both header styles in use: a `- **Status:** accepted` bullet, and an inline
    // `**Date:** … · **Status:** accepted` line. Match the field, not the line shape.
    const status = /\*\*Status:\*\*\s*([^\n·|]+)/.exec(text);
    if (!status) {
      fail(`${rel}: no "**Status:**" line. An ADR without a status is a draft nobody can rely on.`);
      continue;
    }
    const value = status[1].trim().toLowerCase().replace(/[`*]/g, '').split(/\s|\(/)[0];
    if (!ADR_STATUSES.has(value))
      fail(`${rel}: unknown status "${status[1].trim()}" — expected one of ${[...ADR_STATUSES].join(' | ')}.`);
  }

  if (count === 0) fail('comms/decisions/ contains no ADRs.');
  return count;
}

async function checkStatus(roster) {
  for (const agent of [...roster].sort()) {
    const p = join(COMMS, 'status', `${agent}.md`);
    if (!(await exists(p)))
      fail(`comms/status/${agent}.md is missing — every agent on the roster has a heartbeat file.`);
  }

  // The reverse: a status file for an agent nobody rostered is a stale slug.
  for (const entry of await listDir(join(COMMS, 'status'))) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || isTemplate(entry.name)) continue;
    const slug = basename(entry.name, '.md');
    if (!roster.has(slug))
      warn(`comms/status/${entry.name}: "${slug}" is not on the BOARD roster.`);
  }
  return roster.size;
}

async function main() {
  const roster = await rosterFromBoard();

  const messages = await checkInbox(roster);
  const contracts = await checkContracts();
  const decisions = await checkDecisions();
  const agents = await checkStatus(roster);

  // comms/ moves faster than any other tree here — thirteen agents append to it
  // concurrently — so a comms result is even more time-sensitive than a token one.
  const prov = provenance(ROOT, 'comms');

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({ provenance: prov, agents, messages, contracts, decisions, errors, warnings }, null, 2),
    );
  } else {
    console.log('\nComms check');
    console.log(`  checked at        ${prov.line}`);
    console.log(`  roster agents     ${agents}`);
    console.log(`  inbox messages    ${messages}`);
    console.log(`  contracts         ${contracts}`);
    console.log(`  decisions         ${decisions}`);
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
