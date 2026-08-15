#!/usr/bin/env node
/**
 * seed-agents.mjs — the one-shot migration agent from Part IV.
 *
 * Normalizes external agent libraries to our frontmatter. Sources: gtmagents/gtm-agents
 * (Apache-2.0), wshobson/agents (MIT), contains-studio/agents.
 *
 * ── The two rules that shape this script ─────────────────────────────────────
 *
 * 1. **It stages, it does not publish.** Output goes to `agents/_incoming/`, which the
 *    validator skips and the map never reads. Promotion is a deliberate `git mv` by a
 *    human who has read the agent. Part VII.3: their 137 agents are marketing volume;
 *    sixty runnable ones with live status halos beat a hundred and thirty-seven dead
 *    ones, and deleting a weak import is the job, not a failure of the import.
 *
 * 2. **A raw import cannot pass validation.** `replaces`, the three `ladder` rungs and
 *    `the_human` are judgements about manual work that no normalizer can make honestly,
 *    so they are emitted as placeholders that `validate-frontmatter.mjs` rejects on
 *    purpose. An agent promoted without a human writing those four sentences fails CI
 *    immediately. That is the curation gate, made mechanical.
 *
 * Dry run is the default. Nothing is written without `--write`.
 *
 * Usage:
 *   node scripts/seed-agents.mjs                      # plan only, writes nothing
 *   node scripts/seed-agents.mjs --source wshobson    # one source
 *   node scripts/seed-agents.mjs --write              # stage into agents/_incoming/
 *   node scripts/seed-agents.mjs --refresh --write    # git pull the caches first
 *   node scripts/seed-agents.mjs --unmapped           # list what our taxonomy rejects
 */

import { readFile, writeFile, mkdir, readdir, access, copyFile } from 'node:fs/promises';
import { join, dirname, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { parseFrontmatter, parseConnectorRegistry, toSlug } from './validate-frontmatter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.seed-cache');
const INCOMING = join(ROOT, 'agents', '_incoming');
const LICENCES = join(INCOMING, '_licences');
const MANIFEST = join(INCOMING, 'MANIFEST.json');

/* ------------------------------------------------------------------ *
 * Sources
 * ------------------------------------------------------------------ */

const SOURCES = [
  { name: 'gtm-agents', repo: 'https://github.com/gtmagents/gtm-agents.git', licence: 'Apache-2.0' },
  { name: 'wshobson', repo: 'https://github.com/wshobson/agents.git', licence: 'MIT' },
  { name: 'contains-studio', repo: 'https://github.com/contains-studio/agents.git', licence: null },
];

const LICENCE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];

/* ------------------------------------------------------------------ *
 * Taxonomy mapping (ADR-001)
 *
 * First match wins. Anything unmatched goes to the unmapped report and is NOT staged —
 * ADR-001: "Anything that doesn't map cleanly is a signal the department set is wrong,
 * not that the agent needs forcing." Forcing an engineering agent into `operations`
 * because it has to go somewhere is how a curated library becomes a junk drawer.
 * ------------------------------------------------------------------ */

const RULES = [
  [/\b(lead|prospect|icp|list.?build|scrap(e|ing))\b/i, 'sales', 'lead-sourcing'],
  [/\b(enrich|firmograph|technograph)\b/i, 'sales', 'enrichment'],
  [/\b(cold.?email|outreach|sdr|copywriter.*outbound)\b/i, 'sales', 'outreach-writing'],
  [/\b(sequence|cadence|follow.?up.*outbound)\b/i, 'sales', 'sequencing-and-send'],
  [/\b(pipeline|deal|opportunit|crm.?hygiene)\b/i, 'deals', 'pipeline-hygiene'],
  [/\b(proposal|quote|rfp|sow|statement of work)\b/i, 'deals', 'proposals'],
  [/\b(forecast|quota|revenue.?predict)\b/i, 'deals', 'forecasting'],
  [/\b(negotiat|pricing.?strategy|discount)\b/i, 'deals', 'negotiation'],
  [/\b(content|blog|copywrit|editorial|newsletter)\b/i, 'marketing', 'content'],
  [/\b(brand|voice|tone.?of.?voice|positioning)\b/i, 'marketing', 'brand'],
  [/\b(social|distribution|repurpos|seo|publish)\b/i, 'marketing', 'distribution'],
  [/\b(ads?|paid|ppc|meta.?ads|google.?ads|campaign.?budget)\b/i, 'marketing', 'paid-acquisition'],
  [/\b(analytics|attribution|funnel.?report)\b/i, 'marketing', 'campaign-analytics'],
  [/\b(project|delivery|sprint|standup|meeting|transcript)\b/i, 'operations', 'delivery'],
  [/\b(workflow|automat|integration|ops.?bot)\b/i, 'operations', 'automation'],
  [/\b(audit|qa|quality|review.?process|compliance.?check)\b/i, 'operations', 'quality-and-audit'],
  [/\b(schedul|calendar|capacity|resourc)\b/i, 'operations', 'scheduling'],
  [/\b(research|deep.?dive|due.?diligence|company.?profile)\b/i, 'intelligence', 'company-research'],
  [/\b(market|trend|signal|news.?monitor)\b/i, 'intelligence', 'market-signals'],
  [/\b(competit|battlecard|win.?loss)\b/i, 'intelligence', 'competitive'],
  [/\b(report|dashboard.?summary|kpi.?digest)\b/i, 'intelligence', 'reporting'],
  [/\b(onboard|kickoff|activation)\b/i, 'customer', 'onboarding'],
  [/\b(support|ticket|helpdesk|triage)\b/i, 'customer', 'support'],
  [/\b(churn|retention|renewal|health.?score)\b/i, 'customer', 'retention'],
  [/\b(feedback|nps|voice.?of.?customer|survey)\b/i, 'customer', 'voice-of-customer'],
  [/\b(invoice|billing|account(s|ing)|expense|finance|cash)\b/i, 'back-office', 'finance'],
  [/\b(contract|legal|nda|terms)\b/i, 'back-office', 'contracts-and-legal'],
  [/\b(recruit|hiring|hr|people.?ops|onboarding.?employee)\b/i, 'back-office', 'people'],
  [/\b(procure|vendor|supplier)\b/i, 'back-office', 'procurement'],
  [/\b(pdpl|gdpr|privacy|policy|regulat)\b/i, 'back-office', 'compliance'],
];

/**
 * Upstream tool names we can actually authenticate → our connector names.
 * Values MUST be keys in `agents/_registry/connectors.json`. The seeder loads that
 * file at start and drops any mapping whose target is not registered — inventing a
 * `wired_into` name the runner cannot grant is how a staged import becomes a 422.
 */
const TOOL_MAP = {
  exa: 'exa', firecrawl: 'firecrawl',
  websearch: 'exa', web_search: 'exa', 'web-search': 'web-search',
  webfetch: 'web-fetch', web_fetch: 'web-fetch', 'web-fetch': 'web-fetch',
  gmail: 'gmail', email: 'gmail', slack: 'slack', hubspot: 'hubspot',
  postgres: 'postgres', sql: 'postgres', database: 'postgres', git: 'git',
  langfuse: 'langfuse', workspace: 'workspace',
  company: 'company-brain', 'company-brain': 'company-brain',
};

/**
 * Phase from the shape of the work (§2.6.3 columns). Deliberately coarse — a wrong guess
 * here moves one card one column and a human fixes it in a second; a clever guess that is
 * subtly wrong is harder to notice.
 */
function inferPhase(text) {
  if (/\b(orchestrat|monitor|loop|agent.?team|workflow.?engine|escalat)\b/i.test(text)) return '4-orchestrate';
  if (/\b(write|draft|generat|creat|produc|design|compos)\b/i.test(text)) return '3-generate';
  if (/\b(classif|extract|score|parse|enrich|detect|analy[sz]e)\b/i.test(text)) return '2-capture';
  return '1-foundation';
}

const ICON_BY_CLUSTER = {
  'lead-sourcing': 'database', enrichment: 'building', 'outreach-writing': 'send',
  'sequencing-and-send': 'repeat', targeting: 'target', 'pipeline-hygiene': 'filter',
  proposals: 'file-text', forecasting: 'trending-up', negotiation: 'handshake', handover: 'package',
  content: 'pen-line', brand: 'shield-check', distribution: 'share-2', 'paid-acquisition': 'megaphone',
  'campaign-analytics': 'bar-chart-3', delivery: 'calendar-check', automation: 'workflow',
  'quality-and-audit': 'clipboard-check', scheduling: 'clock', 'internal-comms': 'message-square',
  'company-research': 'microscope', 'market-signals': 'radar', 'second-brain': 'brain',
  competitive: 'crosshair', reporting: 'bar-chart-2', onboarding: 'rocket', support: 'life-buoy',
  retention: 'heart-handshake', 'voice-of-customer': 'speech', 'success-reviews': 'award',
  finance: 'receipt', 'contracts-and-legal': 'scale', people: 'users', procurement: 'truck',
  compliance: 'shield',
};

/* ------------------------------------------------------------------ *
 * Reading upstream files
 * ------------------------------------------------------------------ */

const SKIP_FILES = /^(readme|license|licence|contributing|code_of_conduct|changelog|security)/i;

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function walk(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.name.endsWith('.md') && !SKIP_FILES.test(e.name)) out.push(full);
  }
  return out;
}

/**
 * Upstream frontmatter is written for their tools, not ours: long unquoted descriptions
 * full of colons, embedded examples, occasional YAML we would reject. Try the strict
 * parser, then fall back to pulling the three keys we need by hand. A source repo's YAML
 * habits are not our problem to fix, only to read.
 */
function readUpstream(text) {
  try {
    const { data, body } = parseFrontmatter(text);
    if (data && typeof data === 'object' && data.name) return { fm: data, body };
  } catch { /* fall through */ }

  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text.replace(/^﻿/, ''));
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm.name ? { fm, body: text.slice(m[0].length) } : null;
}

function classify(name, description, filePath) {
  const haystack = `${name} ${description} ${filePath}`;
  for (const [re, department, cluster] of RULES) {
    if (re.test(haystack)) return { department, cluster };
  }
  return null;
}

function mapTools(raw, knownConnectors) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  const out = new Set();
  for (const t of list) {
    const mapped = TOOL_MAP[String(t).toLowerCase().trim()];
    if (!mapped) continue;
    if (knownConnectors && !knownConnectors.has(mapped)) continue;
    out.add(mapped);
  }
  return [...out];
}

const yamlString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;

/* ------------------------------------------------------------------ *
 * Normalization
 * ------------------------------------------------------------------ */

function render(agent, provenance) {
  const { name, slug, description, department, cluster, tier, phase, icon, wiredInto, body } = agent;
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${yamlString(description)}`,
    `department: ${department}`,
    `cluster: ${cluster}`,
    `icon: ${icon}`,
    `tier: ${tier}`,
    `phase: ${phase}`,
    'status: draft',
  ];
  if (wiredInto.length) lines.push(`wired_into: [${wiredInto.join(', ')}]`);
  lines.push(
    // Placeholders that FAIL validation on purpose — see the header of this file.
    'replaces: "TODO"',
    'ladder:',
    '  human-led: "TODO"',
    '  assisted: "TODO"',
    '  autonomous: "TODO"',
    'the_human: nothing',
    'approval: none',
    '---',
    '',
    '> **STAGED IMPORT — NOT CURATED.** This file fails `validate-frontmatter.mjs` by',
    '> design. Before promoting it out of `agents/_incoming/`, a human must write four',
    '> sentences no importer can write honestly:',
    '>',
    '> - `replaces` — the manual work this retires, with contempt for it. It renders in a',
    ">   quote box and it is the line people screenshot (§2.3.8).",
    '> - the three `ladder` rungs — and they must actually escalate: human-led is a glance,',
    '>   autonomous is unattended on a schedule.',
    '> - `the_human` — never "nothing". Every agent leaves a human owning strategy or audit.',
    '>',
    '> Also confirm `wired_into`. The runner\'s tool allowlist is exactly that list (§3.2),',
    '> so anything the imported body does not actually use must come off before promotion.',
    '>',
    `> Promote with: \`git mv agents/_incoming/${department}/${slug} agents/${department}/${slug}\``,
    '>',
    '> Or delete it. Deleting a weak import is the job, not a failure of the import.',
    '',
    body.trim(),
    '',
    '## Provenance',
    '',
    provenance,
    '',
  );
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function ensureClone(source, { refresh, write }) {
  const dir = join(CACHE, source.name);
  if (await exists(join(dir, '.git'))) {
    if (refresh) git(['pull', '--ff-only'], dir);
    return dir;
  }
  if (!write) return null; // dry run does not touch the network
  await mkdir(CACHE, { recursive: true });
  git(['clone', '--depth', '1', source.repo, dir], CACHE);
  return dir;
}

async function findLicence(dir) {
  for (const f of LICENCE_FILES) if (await exists(join(dir, f))) return f;
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const refresh = argv.includes('--refresh');
  const showUnmapped = argv.includes('--unmapped');
  const only = argv.includes('--source') ? argv[argv.indexOf('--source') + 1] : null;

  const sources = SOURCES.filter((s) => !only || s.name === only);
  if (!sources.length) {
    console.error(`unknown source "${only}" — known: ${SOURCES.map((s) => s.name).join(', ')}`);
    process.exit(2);
  }

  let knownConnectors = null;
  const connectorsPath = join(ROOT, 'agents', '_registry', 'connectors.json');
  if (await exists(connectorsPath)) {
    try {
      const result = parseConnectorRegistry(JSON.parse(await readFile(connectorsPath, 'utf8')));
      if (result.errors.length) {
        for (const m of result.errors) console.error(`  connectors.json: ${m}`);
      }
      knownConnectors = result.names;
      for (const target of new Set(Object.values(TOOL_MAP))) {
        if (!knownConnectors.has(target)) {
          console.error(`  seeder TOOL_MAP target "${target}" is not in the connector registry — it will never be emitted`);
        }
      }
    } catch (e) {
      console.error(`  agents/_registry/connectors.json is not valid JSON: ${e.message}`);
    }
  } else {
    console.error('  agents/_registry/connectors.json is missing — staged wired_into will be empty (invariant 5)');
  }

  const staged = [];
  const skipped = [];
  const unmapped = [];
  const manifest = [];

  for (const source of sources) {
    const dir = await ensureClone(source, { refresh, write });
    if (!dir) { skipped.push(`${source.name}: not cloned yet (dry run does not clone — re-run with --write)`); continue; }

    const licenceFile = await findLicence(dir);
    if (!licenceFile) {
      // Refusing to stage from a source whose licence we cannot find is cheaper than
      // discovering later that we cannot ship what we built on it.
      skipped.push(`${source.name}: no LICENSE file found in the clone — refusing to import`);
      continue;
    }
    const sha = git(['rev-parse', 'HEAD'], dir);

    if (write) {
      await mkdir(LICENCES, { recursive: true });
      await copyFile(join(dir, licenceFile), join(LICENCES, `${source.name}-${licenceFile}`));
    }

    for (const file of await walk(dir)) {
      const relPath = relative(dir, file).split(sep).join('/');
      const parsed = readUpstream(await readFile(file, 'utf8'));
      if (!parsed) { skipped.push(`${source.name}/${relPath}: no readable frontmatter`); continue; }

      const name = String(parsed.fm.name ?? basename(file, '.md'))
        .split(/[-_\s]+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
        .trim();
      const slug = toSlug(name);
      const description = String(parsed.fm.description ?? '').split(/(?<=\.)\s/)[0].slice(0, 200).trim()
        || `Imported from ${source.name}.`;

      const hit = classify(name, description, relPath);
      if (!hit) { unmapped.push(`${source.name}/${relPath} — "${name}"`); continue; }

      const target = join(INCOMING, hit.department, slug, 'SKILL.md');
      const promoted = join(ROOT, 'agents', hit.department, slug, 'SKILL.md');

      if (await exists(promoted)) { skipped.push(`${slug}: already curated at agents/${hit.department}/${slug}/`); continue; }
      if (await exists(target)) { skipped.push(`${slug}: already staged`); continue; }

      const agent = {
        name, slug, description,
        department: hit.department,
        cluster: hit.cluster,
        icon: ICON_BY_CLUSTER[hit.cluster] ?? 'bot',
        tier: 'assisted', // every import lands mid-ladder; the ladder is written by a human
        phase: inferPhase(`${name} ${description} ${parsed.body.slice(0, 2000)}`),
        wiredInto: mapTools(parsed.fm.tools, knownConnectors),
        body: parsed.body,
      };

      const provenance = [
        `Imported from \`${source.repo.replace(/\.git$/, '')}\` — \`${relPath}\` at commit \`${sha}\`.`,
        `Upstream licence: ${source.licence ?? 'see file'} — full text kept at`,
        `\`agents/_incoming/_licences/${source.name}-${licenceFile}\`.`,
        `Normalized to Part IV frontmatter by \`scripts/seed-agents.mjs\` on ${new Date().toISOString().slice(0, 10)}.`,
        'The upstream body above is unmodified; only the frontmatter was replaced.',
      ].join('\n');

      if (write) {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, render(agent, provenance), 'utf8');
      }
      staged.push(`${hit.department}/${slug}  ← ${source.name}/${relPath}`);
      manifest.push({
        slug, name, source: source.name, upstream: relPath, commit: sha,
        licence: source.licence ?? 'unknown', licenceFile: `agents/_incoming/_licences/${source.name}-${licenceFile}`,
        department: hit.department, cluster: hit.cluster, phase: agent.phase,
        staged: `agents/_incoming/${hit.department}/${slug}/SKILL.md`,
        promoteTo: `agents/${hit.department}/${slug}/SKILL.md`,
        importedAt: new Date().toISOString(),
      });
    }
  }

  if (write && manifest.length) {
    await mkdir(INCOMING, { recursive: true });
    const prior = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : [];
    const bySlug = new Map(prior.map((e) => [e.slug, e]));
    for (const e of manifest) bySlug.set(e.slug, e);
    await writeFile(MANIFEST, `${JSON.stringify([...bySlug.values()], null, 2)}\n`, 'utf8');
  }

  console.log(`\nSeed import — ${write ? 'STAGED' : 'DRY RUN (nothing written)'}`);
  console.log(`  sources        ${sources.map((s) => s.name).join(', ')}`);
  console.log(`  would stage    ${staged.length}`);
  console.log(`  skipped        ${skipped.length}`);
  console.log(`  unmapped       ${unmapped.length}  (taxonomy rejected them — not forced anywhere)`);
  for (const s of staged) console.log(`    + ${s}`);
  for (const s of skipped) console.log(`    · ${s}`);
  if (showUnmapped) for (const u of unmapped) console.log(`    ? ${u}`);
  else if (unmapped.length) console.log('    (re-run with --unmapped to list them)');
  if (!write) console.log('\n  Re-run with --write to clone and stage into agents/_incoming/.');
  console.log('  Nothing reaches the map until a human writes replaces + ladder + the_human');
  console.log('  and git mv\'s the folder out of _incoming. Curate to ~60; delete the rest.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
