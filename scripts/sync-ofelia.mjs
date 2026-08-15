#!/usr/bin/env node
/**
 * sync-ofelia.mjs — regenerate infra/ofelia/config.ini from agents/** /SKILL.md (§3.2)
 * plus the ADR-008 system prune job (§3.5).
 *
 *   node scripts/sync-ofelia.mjs
 *
 * Source of truth for agent jobs: the `schedule:` field in frontmatter. A *agent* job
 * that exists in this file but not in frontmatter is a bug; this script rewrites the
 * file wholesale so that cannot happen by accumulation.
 *
 * System jobs (ops.prune) are not frontmatter — they are emitted every rewrite so a
 * hand-edit is never the only copy. ADR-008: nightly POST /api/ops/prune, never on
 * the user request path.
 *
 * It does not HUP ofelia — the runner does that after a schedule commit, and reports
 * `ofeliaSynced: false` when the reload did not happen.
 *
 * Owner: runner-engineer (agent jobs). System prune block: observability-engineer
 * (ADR-008). Job *shape* is infra-compose-engineer's.
 */
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS = join(ROOT, 'agents');
const OUT = join(ROOT, 'infra', 'ofelia', 'config.ini');

export const HEADER = `; ============================================================================
; GENERATED FILE — DO NOT EDIT BY HAND.
;
; Source of truth (agent jobs): the \`schedule:\` field in agents/**/SKILL.md
;                               (spec §3.2, Part IV).
; System jobs (ADR-008):        ops.prune — emitted every rewrite; not frontmatter.
; Generator:       scripts/sync-ofelia.mjs
; Trigger:         the runner runs the generator after a schedule commit, then
;                  \`docker compose kill -s HUP ofelia\` to reload.
;
; An *agent* job that exists here but not in frontmatter is a BUG. System jobs
; (job-run "ops/prune") are intentional and re-emitted on every rewrite.
; The generator rewrites this file wholesale; anything you type by hand is gone
; on the next schedule change.
;
; To schedule an agent: POST /api/schedule, or edit its frontmatter and commit.
; ============================================================================

[global]
; Log to stdout so \`docker compose logs ofelia\` is the whole story.
save-only-on-error = false
`;

export const EXAMPLE = `; ----------------------------------------------------------------------------
; EXAMPLE AGENT JOB — this is the exact shape the generator emits for frontmatter
; schedules. It is commented out because an example that actually fired would be a
; fake number in the run history (CLAUDE.md rule 9). Live agent jobs are appended
; below the system block.
; ----------------------------------------------------------------------------
;
; [job-run "sales/account-enrichment"]
; schedule = 0 6 * * 1
; image    = curlimages/curl:8.11.1
; network  = agnetos_cc
; delete   = true
; command  = curl -fsS -X POST http://runner:8787/api/run
;            -H "Content-Type: application/json"
;            -d "{\\"agent\\":\\"sales/account-enrichment\\",\\"inputs\\":{}}"
`;

/** Nightly retention (ADR-008). UTC 03:00. Never on the user request path. */
export const PRUNE_CRON = '0 3 * * *';

/**
 * @returns {string}
 */
export function renderPruneJob() {
  return [
    '; ----------------------------------------------------------------------------',
    '; SYSTEM JOB — ADR-008 retention. Not from frontmatter; always emitted.',
    '; POST /api/ops/prune -> ops.prune() (90d spans / 400d ledger / forever daily).',
    '; Langfuse project retention must match 90 days (operator / infra UI setting).',
    '; ----------------------------------------------------------------------------',
    '[job-run "ops/prune"]',
    `schedule = ${PRUNE_CRON}`,
    'image    = curlimages/curl:8.11.1',
    'network  = agnetos_cc',
    'delete   = true',
    'command  = curl -fsS -X POST http://runner:8787/api/ops/prune',
    '',
  ].join('\n');
}

/** @typedef {{ agent: string, cron: string }} OfeliaJob */

/**
 * @param {string} source
 * @returns {string | null}
 */
export function readSchedule(source) {
  const fence = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fence) return null;
  const line = /^schedule:\s*(.*)$/m.exec(fence[1] ?? '');
  if (!line) return null;
  const raw = (line[1] ?? '').replace(/#.*$/, '').trim();
  if (raw === '' || raw === 'null' || raw === '~' || raw === '""' || raw === "''") return null;
  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw;
  const cron = unquoted.trim();
  return cron === '' ? null : cron;
}

/**
 * @param {OfeliaJob} job
 * @returns {string}
 */
export function renderJob(job) {
  const payload = JSON.stringify({ agent: job.agent, inputs: {} }).replace(/"/g, '\\"');
  return [
    `[job-run "${job.agent}"]`,
    `schedule = ${job.cron}`,
    `image    = curlimages/curl:8.11.1`,
    `network  = agnetos_cc`,
    `delete   = true`,
    `command  = curl -fsS -X POST http://runner:8787/api/run -H "Content-Type: application/json" -d "${payload}"`,
    '',
  ].join('\n');
}

/**
 * @param {OfeliaJob[]} jobs
 * @returns {string}
 */
export function renderConfig(jobs) {
  const live =
    jobs.length === 0
      ? '; No scheduled agents in frontmatter. That is an honest empty state, not a missing feature.\n'
      : jobs.map(renderJob).join('\n');
  return `${HEADER}\n${EXAMPLE}\n${renderPruneJob()}\n${live}`;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} agentsDir
 * @returns {Promise<OfeliaJob[]>}
 */
export async function collectJobs(agentsDir) {
  /** @type {OfeliaJob[]} */
  const jobs = [];
  if (!(await exists(agentsDir))) return jobs;

  for (const dept of (await readdir(agentsDir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    if (dept.name.startsWith('_') || dept.name.startsWith('.')) continue;
    const deptPath = join(agentsDir, dept.name);
    for (const folder of (await readdir(deptPath, { withFileTypes: true })).filter((d) => d.isDirectory())) {
      const file = join(deptPath, folder.name, 'SKILL.md');
      if (!(await exists(file))) continue;
      const cron = readSchedule(await readFile(file, 'utf8'));
      if (!cron) continue;
      jobs.push({ agent: `${dept.name}/${folder.name}`, cron });
    }
  }
  jobs.sort((a, b) => a.agent.localeCompare(b.agent));
  return jobs;
}

async function main() {
  const jobs = await collectJobs(AGENTS);
  await writeFile(OUT, renderConfig(jobs), 'utf8');
  const summary = jobs.length === 0 ? 'no jobs' : jobs.map((j) => `${j.agent} @ ${j.cron}`).join(', ');
  console.log(`ofelia config: ${jobs.length} job(s) — ${summary}`);
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
