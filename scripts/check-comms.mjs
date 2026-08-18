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

    // `_archive/` holds answered and closed messages, one subdirectory per agent. It is
    // deliberately outside this walk: rule 1 says an agent reads its *open* messages, and
    // that instruction only means something if answered mail actually leaves the inbox.
    // Nothing is deleted — the record moves, so the reading cost stops growing with it.
    if (dir.name === '_archive') continue;

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

/**
 * The reading budget.
 *
 * Rule 1 makes `BRIEF.md` the one file every dispatch reads in full, so its length is
 * multiplied by every agent that ever runs. `BOARD.md` grew from ~600 to over 1,300 lines
 * inside a single session while rule 1 still pointed at it, and the reading cost quietly
 * exceeded the work — roughly 4,000 lines ingested per dispatch before anything happened.
 *
 * A cap in prose is a preference; a cap in a gate is a mechanism. This is the mechanism.
 * When BRIEF outgrows it the answer is to *cut*, not to raise the number — the standing
 * findings earn their place by costing a session each, and the milestone section is
 * supposed to shrink as milestones close.
 */
const BRIEF_MAX_LINES = 150;

/**
 * Open mail is also read every dispatch (rule 1), so it is the same tax with a different
 * name. 137 sat open at once before rule 6 existed. This warns rather than fails: unlike
 * BRIEF, the count is not fully in any one agent's control — you cannot close a message
 * whose answer is with the user.
 */
const OPEN_MESSAGE_WARN = 60;

/**
 * `inbox/_all/` is read by **every agent on every dispatch**, so its length is multiplied by
 * the whole roster — the same arithmetic that put a 150-line cap on BRIEF, applied to the
 * one directory nobody owns.
 *
 * Measured 2026-08-18, and it is the finding that corrects the BRIEF cap rather than
 * confirming it: `_all` was **2,740 lines across 29 broadcasts — eighteen times the BRIEF
 * cap** — while per-agent open mail added another 220–2,180. A dispatch was reading roughly
 * 3,000–5,000 lines of inbox against a briefing capped at 150. **Capping BRIEF addressed
 * about 4% of the reading cost.** The cap was not wrong; it was aimed at the smaller half.
 *
 * A warn rather than a fail, and the distinction is deliberate: a broadcast is *correct* to
 * send at the moment of a milestone flip or a breaking contract change. What is not correct
 * is leaving it there afterwards. Its durable content belongs in BOARD, a contract, or
 * BRIEF; once it is there the announcement is tax, and archiving it loses nothing because
 * `_archive/` keeps the record. Failing the build would punish the send instead of the
 * hoard.
 */
const ALL_BROADCAST_LINE_WARN = 900;

/**
 * The line budget above is an **aggregate** control, and an aggregate cannot see the thing
 * that actually produces the hoard: one broadcast that outlived its event. Twenty-nine short
 * announcements are individually reasonable and collectively eighteen BRIEFs.
 *
 * So this is the per-file control, and it is deliberately mechanical about the one property
 * of a broadcast that *is* mechanical — its **age**. A broadcast is an event notification. An
 * event notification that is three weeks old is not notifying anyone of anything; whatever in
 * it was durable is either recorded in BOARD, a contract or BRIEF by now, or it never will be.
 *
 * Warn at 7 days, fail at 21. The gap is the point: 7 says *this has done its job, check that
 * its content landed*; 21 says *nobody is going to*. Neither punishes the send — the sender
 * has three weeks — which is the same reason the line budget is a warn. **A failing build here
 * is one `git mv` away from green**, and the fix is legal for anyone: `_all/` has no owner.
 *
 * Read from `created:` in the frontmatter, never from mtime. Every file in a fresh clone has
 * today's mtime, so an mtime-based gate is green on CI and on any machine that re-checked out
 * the tree — green for a reason that has nothing to do with the property being measured. That
 * is the checkers-go-blind-silently family, and it would have been invisible here because the
 * blindness only shows up somewhere other than the author's laptop.
 *
 * **What this instrument cannot see**, written down rather than discovered later:
 *   - a broadcast sent yesterday whose content was already recorded in a contract — the
 *     genuinely wasteful case, and the one no clock reaches. Judgement, not a gate.
 *   - whether the durable content actually landed anywhere. It measures age, and age is a
 *     *proxy*. Do not read a green here as "the content was filed"; that claim needs a reader.
 *   - a broadcast with a malformed or future `created:` — counted as age 0 and reported as
 *     unparseable rather than silently skipped, because a file a checker cannot read is the
 *     one place a hoard would learn to hide.
 */
const BROADCAST_AGE_WARN_DAYS = 7;
const BROADCAST_AGE_FAIL_DAYS = 21;

/** Whole days between an ISO-ish `created:` stamp and now; `null` if it will not parse. */
function ageInDays(created, now) {
  const t = Date.parse(String(created ?? '').trim());
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

async function checkReadingBudget(openCount) {
  const rel = 'comms/BRIEF.md';
  let text;
  try {
    text = await readFile(join(COMMS, 'BRIEF.md'), 'utf8');
  } catch {
    fail(`${rel} is missing — it is what comms/README.md rule 1 tells every agent to read.`);
    return;
  }

  // Total lines, not non-blank ones — and counted the way `wc -l` and every editor's gutter
  // count them, which took two corrections to get right.
  //
  // The first version counted non-blank lines and read 143 on a file `wc -l` called 177.
  // The second counted `split('\n').length`, which is one *more* than `wc -l` for any file
  // ending in a newline — the trailing '' after the final separator is not a line, and the
  // gate reported "151 lines" at a file every other tool called 150. Both are the same
  // defect: **the number a gate prints must be the number its reader can reproduce.** A cap
  // that is off by one is not a rounding error, it is a gate arguing with `wc`.
  //
  // This is the house defect (a declared value read as an observed one) found twice inside
  // the gate written to prevent it, which is roughly how often it is found everywhere else.
  const lines = text.replace(/\n$/, '').split('\n').length;
  if (lines > BRIEF_MAX_LINES) {
    fail(
      `${rel} is ${lines} lines, over its ${BRIEF_MAX_LINES}-line cap. ` +
        `Every dispatch reads this file in full, so its length is multiplied by every agent ` +
        `that ever runs. Cut it — do not raise the cap.`,
    );
  }

  if (openCount > OPEN_MESSAGE_WARN) {
    warn(
      `${openCount} open inbox messages (soft limit ${OPEN_MESSAGE_WARN}). Rule 1 makes ` +
        `agents read their open mail, so this is a tax every later dispatch pays. Answer ` +
        `and archive to comms/inbox/_archive/<agent>/ (rule 6), or say why they must stay open.`,
    );
  }

  // The broadcast budget — the larger half of the same cost, and the one that was missed.
  let broadcastLines = 0;
  let broadcastFiles = 0;
  const now = Date.now();
  for (const entry of await listDir(join(COMMS, 'inbox', '_all'))) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || isTemplate(entry.name)) continue;
    broadcastFiles++;
    const relFile = `comms/inbox/_all/${entry.name}`;
    const body = await readFile(join(COMMS, 'inbox', '_all', entry.name), 'utf8');
    broadcastLines += body.replace(/\n$/, '').split('\n').length;

    // Per-file age — the control the aggregate cannot express. See the constants above.
    const fm = parseFrontmatter(body);
    const age = ageInDays(fm?.created, now);
    if (age === null) {
      warn(
        `${relFile}: \`created:\` is missing or unparseable, so its age cannot be checked. ` +
          `Use the message template's \`yyyy-MM-ddTHH:mm\`.`,
      );
    } else if (age >= BROADCAST_AGE_FAIL_DAYS) {
      fail(
        `${relFile} is ${age} days old and still in _all/. A broadcast is an event ` +
          `notification; after ${BROADCAST_AGE_FAIL_DAYS} days it notifies nobody and is read ` +
          `by every agent on every dispatch. Put its durable content in BOARD, a contract or ` +
          `BRIEF — name where, do not assume it is already there — then ` +
          `\`git mv ${relFile} comms/inbox/_archive/_all/\`. Nothing is deleted, and a move is ` +
          `two paths: commit both.`,
      );
    } else if (age >= BROADCAST_AGE_WARN_DAYS) {
      warn(
        `${relFile} is ${age} days old (soft limit ${BROADCAST_AGE_WARN_DAYS}, hard limit ` +
          `${BROADCAST_AGE_FAIL_DAYS}). Check that its durable content landed in BOARD, a ` +
          `contract or BRIEF, then archive it to comms/inbox/_archive/_all/.`,
      );
    }
  }
  if (broadcastLines > ALL_BROADCAST_LINE_WARN) {
    warn(
      `comms/inbox/_all/ is ${broadcastLines} lines across ${broadcastFiles} broadcasts ` +
        `(soft limit ${ALL_BROADCAST_LINE_WARN}). Every agent reads this on every dispatch, so ` +
        `it is multiplied by the whole roster — at ${broadcastLines} lines it costs each one ` +
        `${Math.round(broadcastLines / BRIEF_MAX_LINES)}x the entire BRIEF. A broadcast is ` +
        `right to send and wrong to leave: put its durable content in BOARD, a contract or ` +
        `BRIEF, then move it to comms/inbox/_archive/_all/ (rule 6). Nothing is deleted.`,
    );
  }
}

async function main() {
  const roster = await rosterFromBoard();

  const messages = await checkInbox(roster);
  await checkReadingBudget(messages);
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
